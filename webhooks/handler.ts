import type { Scalekit } from "@scalekit-sdk/node";
import type { ArchestraClient } from "../archestra/client.ts";
import {
  isSupportedEventType,
  type DirectoryUserEventData,
  type ProcessResult,
  type ScalekitWebhookEvent,
  type SyncEventRecord,
} from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { logSync } from "../sync/logger.ts";
import { ensureOrganizationLink } from "../sync/organizationLink.ts";
import { InMemorySyncStore } from "../sync/store.ts";
import { processUserCreatedEvent } from "../sync/userCreateService.ts";
import { processUserDeletedEvent } from "../sync/userDeleteService.ts";
import { processUserUpdatedEvent } from "../sync/userUpdateService.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export interface WebhookHandlerDependencies {
  store: InMemorySyncStore;
  scalekit: Scalekit;
  archestraClient: ArchestraClient;
}

export function validateWebhookEventPayload(payload: unknown): payload is ScalekitWebhookEvent {
  if (!payload || typeof payload !== "object") return false;
  const event = payload as Partial<ScalekitWebhookEvent>;
  return (
    event.spec_version === "1" &&
    typeof event.id === "string" &&
    typeof event.type === "string" &&
    isSupportedEventType(event.type) &&
    typeof event.organization_id === "string" &&
    typeof event.occurred_at === "string" &&
    typeof event.data === "object"
  );
}

async function processWithSingleRetry(
  event: ScalekitWebhookEvent,
  process: () => Promise<void>,
): Promise<{ success: boolean; retryCount: 0 | 1; error?: string }> {
  try {
    await process();
    return { success: true, retryCount: 0 };
  } catch (firstError) {
    try {
      await process();
      return { success: true, retryCount: 1 };
    } catch (secondError) {
      return {
        success: false,
        retryCount: 1,
        error: `${String(firstError)} | retry: ${String(secondError)}`,
      };
    }
  }
}

async function handleDirectoryUserEvent(
  deps: WebhookHandlerDependencies,
  event: ScalekitWebhookEvent,
): Promise<{ success: boolean; retryCount: 0 | 1; error?: string }> {
  if (event.type === "organization.directory.user_created") {
    return await processWithSingleRetry(event, () =>
      processUserCreatedEvent(deps.store, deps.archestraClient, event)
    );
  }
  if (event.type === "organization.directory.user_updated") {
    const data = event.data as DirectoryUserEventData;
    if (data.active === false) {
      return await processWithSingleRetry(event, () =>
        processUserDeletedEvent(deps.store, deps.archestraClient, event)
      );
    }
    return await processWithSingleRetry(event, () =>
      processUserUpdatedEvent(deps.store, deps.archestraClient, event)
    );
  }
  if (event.type === "organization.directory.user_deleted") {
    return await processWithSingleRetry(event, () =>
      processUserDeletedEvent(deps.store, deps.archestraClient, event)
    );
  }
  return { success: true, retryCount: 0 };
}

export async function processWebhookEvent(
  deps: WebhookHandlerDependencies,
  payload: unknown,
): Promise<ProcessResult> {
  if (!validateWebhookEventPayload(payload)) {
    return {
      statusCode: 400,
      body: { error: "invalid_payload", message: "Webhook payload is invalid" },
    };
  }
  const event = payload;
  logSync("info", "webhook_received", {
    eventId: event.id,
    type: event.type,
    organizationId: event.organization_id,
  });

  await ensureOrganizationLink(
    deps.store,
    deps.scalekit,
    deps.archestraClient,
    event.organization_id,
  );

  const eventRecordBase: Omit<SyncEventRecord, "status" | "retryCount"> = {
    eventId: event.id,
    eventType: event.type,
    organizationId: event.organization_id,
    directoryUserId: "id" in event.data ? String(event.data.id) : undefined,
    occurredAt: event.occurred_at,
    receivedAt: nowIso(),
    rawPayload: payload,
  };
  deps.store.addSyncEvent({
    ...eventRecordBase,
    status: "received",
    retryCount: 0,
  });

  const result = await handleDirectoryUserEvent(deps, event);
  deps.store.addSyncEvent({
    ...eventRecordBase,
    status: result.success ? "succeeded" : "failed",
    retryCount: result.retryCount,
    failureCode: result.success ? undefined : "ARCH_RETRY_FAILED",
    failureMessage: result.error,
  });

  if (!result.success) {
    recordSyncStatus(deps.store, {
      organizationId: event.organization_id,
      lookupKey: "id" in event.data && "email" in event.data
        ? String((event.data as DirectoryUserEventData).email)
        : event.id,
      eventType: event.type,
      outcome: "failed",
      error: result.error,
    });
    logSync("error", "webhook_failed", {
      eventId: event.id,
      type: event.type,
      organizationId: event.organization_id,
      error: result.error,
    });
    return {
      statusCode: 424,
      body: {
        error: "archestra_sync_failed",
        eventId: event.id,
        message: result.error,
      },
    };
  }

  logSync("info", "webhook_succeeded", {
    eventId: event.id,
    type: event.type,
    organizationId: event.organization_id,
    retryCount: result.retryCount,
  });
  return {
    statusCode: 202,
    body: {
      status: "accepted",
      eventId: event.id,
    },
  };
}

