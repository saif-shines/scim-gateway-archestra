import type { ArchestraClient } from "../archestra/client.ts";
import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { InMemorySyncStore } from "./store.ts";
import { toNormalizedUserDeletePayload } from "./userDeleteTransform.ts";
import { logSync } from "./logger.ts";

function extractApiMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const candidates = [record.message, record.error, record.detail, record.reason];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function isAlreadyMissingMember(message: string): boolean {
  const normalized = message.toLowerCase();
  const hasMissingHint = normalized.includes("not found") ||
    normalized.includes("does not exist") ||
    normalized.includes("already removed") ||
    normalized.includes("no member");
  const hasMemberHint = normalized.includes("member") || normalized.includes("user");
  return hasMissingHint && hasMemberHint;
}

async function removeOrganizationMemberInviteApi(input: {
  organizationId: string;
  memberIdOrEmail: string;
}): Promise<{ status: "removed" | "already_missing"; message?: string }> {
  const appBaseUrl = Deno.env.get("ARCHESTRA_APP_BASE_URL")?.trim() || "http://localhost:3000";
  const sessionToken = Deno.env.get("ARCHESTRA_SESSION_TOKEN")?.trim();
  const cookieHeader = Deno.env.get("ARCHESTRA_INVITE_COOKIE_HEADER")?.trim() ||
    (sessionToken ? `archestra.session_token=${sessionToken}` : "");
  if (!cookieHeader) {
    throw new Error(
      "Missing invite/remove auth cookie. Set ARCHESTRA_SESSION_TOKEN or ARCHESTRA_INVITE_COOKIE_HEADER.",
    );
  }

  const endpoint = `${appBaseUrl}/api/auth/organization/remove-member`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: appBaseUrl,
      Referer: `${appBaseUrl}/settings/members`,
    },
    body: JSON.stringify({
      memberIdOrEmail: input.memberIdOrEmail,
      organizationId: input.organizationId,
    }),
  });

  const bodyText = await response.text();
  let bodyJson: unknown = undefined;
  if (bodyText.trim()) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = undefined;
    }
  }
  const apiMessage = extractApiMessage(bodyJson) ?? bodyText.trim();

  if (!response.ok) {
    if (response.status === 404 || (apiMessage && isAlreadyMissingMember(apiMessage))) {
      return { status: "already_missing", message: apiMessage };
    }
    throw new Error(`Remove member API ${response.status} /remove-member failed: ${apiMessage}`);
  }
  return { status: "removed", message: apiMessage || undefined };
}

export async function processUserDeletedEvent(
  store: InMemorySyncStore,
  _archestraClient: ArchestraClient,
  event: ScalekitWebhookEvent,
): Promise<void> {
  const user = toNormalizedUserDeletePayload(event);
  try {
    const orgLink = store.getOrganizationLink(user.organizationId);
    if (!orgLink?.archestraOrganizationId) {
      throw new Error(
        `Missing Archestra organization mapping for Scalekit org ${user.organizationId}`,
      );
    }
    const removeResult = await removeOrganizationMemberInviteApi({
      organizationId: orgLink.archestraOrganizationId,
      memberIdOrEmail: user.email,
    });
    recordSyncStatus(store, {
      organizationId: user.organizationId,
      lookupKey: user.email,
      userDisplayName: user.fullName,
      eventType: event.type,
      outcome: "success",
    });
    logSync("info", "user_delete_synced", {
      eventId: event.id,
      organizationId: user.organizationId,
      organizationMemberRemovalStatus: removeResult.status,
    });
  } catch (error) {
    recordSyncStatus(store, {
      organizationId: user.organizationId,
      lookupKey: user.email,
      userDisplayName: user.fullName,
      eventType: event.type,
      outcome: "failed",
      error: String(error),
    });
    logSync("error", "user_delete_failed", {
      eventId: event.id,
      organizationId: user.organizationId,
      error: String(error),
    });
    throw error;
  }
}

