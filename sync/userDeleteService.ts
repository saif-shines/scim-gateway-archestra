import type { ArchestraClient } from "../archestra/client.ts";
import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { InMemorySyncStore } from "./store.ts";
import { resolveMappedTeam } from "./teamMapping.ts";
import { toNormalizedUserDeletePayload } from "./userDeleteTransform.ts";
import { logSync } from "./logger.ts";

export async function processUserDeletedEvent(
  store: InMemorySyncStore,
  archestraClient: ArchestraClient,
  event: ScalekitWebhookEvent,
): Promise<void> {
  const user = toNormalizedUserDeletePayload(event);
  const stableUser = await archestraClient.updateUser({
    externalId: user.scalekitUserId,
    email: user.email,
    active: false,
    fullName: user.fullName,
  });
  try {
    const team = await resolveMappedTeam(store, archestraClient, {
      organizationId: user.organizationId,
      department: user.department,
      roleFallback: user.roleFallback,
    });
    await archestraClient.removeTeamMember(team.archestraTeamId, stableUser.id);
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
      userId: stableUser.id,
      removedTeamId: team.archestraTeamId,
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

