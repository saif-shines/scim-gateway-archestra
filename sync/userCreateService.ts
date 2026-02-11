import type { ArchestraClient } from "../archestra/client.ts";
import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { logSync } from "./logger.ts";
import { toNormalizedUserPayload } from "./userCreateTransform.ts";
import { InMemorySyncStore } from "./store.ts";
import { resolveMappedTeam } from "./teamMapping.ts";

function normalizeMemberRole(role?: string): string {
  return role?.trim() ? role.trim().toLowerCase() : "member";
}

export async function processUserCreatedEvent(
  store: InMemorySyncStore,
  archestraClient: ArchestraClient,
  event: ScalekitWebhookEvent,
): Promise<void> {
  const user = toNormalizedUserPayload(event);

  try {
    const createdUser = await archestraClient.upsertUser({
      externalId: user.scalekitUserId,
      email: user.email,
      preferredUsername: user.preferredUsername,
      givenName: user.givenName,
      familyName: user.familyName,
      fullName: user.fullName,
      active: user.active,
    });
    const team = await resolveMappedTeam(store, archestraClient, {
      organizationId: user.organizationId,
      department: user.department,
      roleFallback: user.roleFallback,
    });

    await archestraClient.addTeamMember(
      team.archestraTeamId,
      createdUser.id,
      normalizeMemberRole(user.roleFallback),
    );
    recordSyncStatus(store, {
      organizationId: user.organizationId,
      lookupKey: user.email,
      userDisplayName: user.fullName,
      eventType: event.type,
      outcome: "success",
    });
    logSync("info", "user_create_synced", {
        eventId: event.id,
        organizationId: user.organizationId,
        userId: createdUser.id,
        teamId: team.archestraTeamId,
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
    logSync("error", "user_create_failed", {
      eventId: event.id,
      organizationId: user.organizationId,
      error: String(error),
    });
    throw error;
  }
}
