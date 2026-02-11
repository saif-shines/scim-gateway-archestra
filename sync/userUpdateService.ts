import type { ArchestraClient } from "../archestra/client.ts";
import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { logSync } from "./logger.ts";
import { resolveMappedTeam } from "./teamMapping.ts";
import { InMemorySyncStore } from "./store.ts";
import { toNormalizedUserUpdatePayload } from "./userUpdateTransform.ts";

function normalizeMemberRole(role?: string): string {
  return role?.trim() ? role.trim().toLowerCase() : "member";
}

function normalizeOrganizationRole(role?: string): string | undefined {
  if (!role?.trim()) return undefined;
  const candidate = role.trim().toLowerCase();
  const allowedRoles = new Set(["editor", "member", "admin", "owner"]);
  if (allowedRoles.has(candidate)) {
    return candidate;
  }
  return undefined;
}

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

function isRoleAlreadySet(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("already") &&
    (normalized.includes("role") || normalized.includes("same"));
}

function isMemberNotFound(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("member not found") ||
    (normalized.includes("not found") && normalized.includes("member"));
}

async function updateOrganizationMemberRole(input: {
  organizationId: string;
  memberIdentifier: string;
  role: string;
}): Promise<{ status: "updated" | "already_set" | "not_found"; message?: string }> {
  const appBaseUrl = Deno.env.get("ARCHESTRA_APP_BASE_URL")?.trim() || "http://localhost:3000";
  const sessionToken = Deno.env.get("ARCHESTRA_SESSION_TOKEN")?.trim();
  const cookieHeader = Deno.env.get("ARCHESTRA_INVITE_COOKIE_HEADER")?.trim() ||
    (sessionToken ? `archestra.session_token=${sessionToken}` : "");
  if (!cookieHeader) {
    throw new Error(
      "Missing role update auth cookie. Set ARCHESTRA_SESSION_TOKEN or ARCHESTRA_INVITE_COOKIE_HEADER.",
    );
  }

  const endpoint = `${appBaseUrl}/api/auth/organization/update-member-role`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: appBaseUrl,
      Referer: `${appBaseUrl}/settings/members`,
    },
    body: JSON.stringify({
      memberId: input.memberIdentifier,
      role: input.role,
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
    if (apiMessage && isMemberNotFound(apiMessage)) {
      return { status: "not_found", message: apiMessage };
    }
    if (apiMessage && isRoleAlreadySet(apiMessage)) {
      return { status: "already_set", message: apiMessage };
    }
    throw new Error(
      `Update member role API ${response.status} /update-member-role failed: ${apiMessage}`,
    );
  }

  if (apiMessage && isRoleAlreadySet(apiMessage)) {
    return { status: "already_set", message: apiMessage };
  }
  return { status: "updated", message: apiMessage || undefined };
}

export async function processUserUpdatedEvent(
  store: InMemorySyncStore,
  archestraClient: ArchestraClient,
  event: ScalekitWebhookEvent,
): Promise<void> {
  const user = toNormalizedUserUpdatePayload(event);
  try {
    const updated = await archestraClient.updateUser({
      externalId: user.scalekitUserId,
      email: user.email,
      preferredUsername: user.preferredUsername,
      givenName: user.givenName,
      familyName: user.familyName,
      fullName: user.fullName,
      active: user.active,
    });
    let teamId: string | undefined = undefined;
    if (user.department?.trim()) {
      const team = await resolveMappedTeam(store, archestraClient, {
        organizationId: user.organizationId,
        department: user.department,
        roleFallback: user.roleFallback,
      });
      await archestraClient.addTeamMember(
        team.archestraTeamId,
        updated.id,
        normalizeMemberRole(user.roleFallback),
      );
      teamId = team.archestraTeamId;
    }
    const orgLink = store.getOrganizationLink(user.organizationId);
    if (!orgLink?.archestraOrganizationId) {
      throw new Error(
        `Missing Archestra organization mapping for Scalekit org ${user.organizationId}`,
      );
    }
    const organizationRole = normalizeOrganizationRole(user.roleFallback);
    let roleUpdateStatus: "updated" | "already_set" | "skipped" | "not_found" = "skipped";
    let roleUpdateMessage: string | undefined = undefined;
    if (organizationRole) {
      let roleUpdateResult = await updateOrganizationMemberRole({
        organizationId: orgLink.archestraOrganizationId,
        memberIdentifier: updated.id,
        role: organizationRole,
      });
      if (roleUpdateResult.status === "not_found") {
        roleUpdateResult = await updateOrganizationMemberRole({
          organizationId: orgLink.archestraOrganizationId,
          memberIdentifier: user.email,
          role: organizationRole,
        });
      }
      roleUpdateStatus = roleUpdateResult.status;
      roleUpdateMessage = roleUpdateResult.message;
    } else {
      roleUpdateMessage = "No supported role found in dp_roles[0].value; skipped role update.";
    }
    recordSyncStatus(store, {
      organizationId: user.organizationId,
      lookupKey: user.email,
      userDisplayName: user.fullName,
      eventType: event.type,
      outcome: "success",
    });
    logSync("info", "user_update_synced", {
      eventId: event.id,
      organizationId: user.organizationId,
      userId: updated.id,
      teamId,
      organizationRoleUpdateStatus: roleUpdateStatus,
      organizationRoleUpdateMessage: roleUpdateMessage,
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
    logSync("error", "user_update_failed", {
      eventId: event.id,
      organizationId: user.organizationId,
      error: String(error),
    });
    throw error;
  }
}
