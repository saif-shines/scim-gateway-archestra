import type { ArchestraClient } from "../archestra/client.ts";
import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { recordSyncStatus } from "../status/syncStatusService.ts";
import { logSync } from "./logger.ts";
import { toNormalizedUserPayload } from "./userCreateTransform.ts";
import { InMemorySyncStore } from "./store.ts";

interface OrganizationInviteResponse {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
  inviterId?: string;
}

type InviteAttemptResult =
  | { kind: "created"; invite: OrganizationInviteResponse }
  | { kind: "already_exists"; message?: string };

function resolveInviteRole(roleFallback?: string): string {
  const defaultRole = Deno.env.get("ARCHESTRA_INVITE_DEFAULT_ROLE")?.trim().toLowerCase() ||
    "editor";
  const candidate = roleFallback?.trim().toLowerCase();
  const allowedRoles = new Set(["editor", "member", "admin", "owner"]);
  if (candidate && allowedRoles.has(candidate)) {
    return candidate;
  }
  return defaultRole;
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

function isAlreadyInvitedOrMember(message: string): boolean {
  const normalized = message.toLowerCase();
  const hasAlready = normalized.includes("already");
  const duplicateHints = [
    "invited",
    "invitation",
    "member",
    "part of",
    "organization",
    "exists",
  ];
  return hasAlready && duplicateHints.some((hint) => normalized.includes(hint));
}

async function createOrganizationInvite(input: {
  organizationId: string;
  email: string;
  role: string;
}): Promise<InviteAttemptResult> {
  const appBaseUrl = Deno.env.get("ARCHESTRA_APP_BASE_URL")?.trim() || "http://localhost:3000";
  const sessionToken = Deno.env.get("ARCHESTRA_SESSION_TOKEN")?.trim();
  const cookieHeader = Deno.env.get("ARCHESTRA_INVITE_COOKIE_HEADER")?.trim() ||
    (sessionToken ? `archestra.session_token=${sessionToken}` : "");

  if (!cookieHeader) {
    throw new Error(
      "Missing invite auth cookie. Set ARCHESTRA_SESSION_TOKEN or ARCHESTRA_INVITE_COOKIE_HEADER.",
    );
  }

  const endpoint = `${appBaseUrl}/api/auth/organization/invite-member`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: appBaseUrl,
      Referer: `${appBaseUrl}/settings/members`,
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
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
    if (response.status === 409 || (apiMessage && isAlreadyInvitedOrMember(apiMessage))) {
      return {
        kind: "already_exists",
        message: apiMessage,
      };
    }
    throw new Error(`Invite API ${response.status} /invite-member failed: ${apiMessage}`);
  }

  if (bodyJson && typeof bodyJson === "object" && typeof (bodyJson as { id?: unknown }).id === "string") {
    return {
      kind: "created",
      invite: bodyJson as OrganizationInviteResponse,
    };
  }
  if (apiMessage && isAlreadyInvitedOrMember(apiMessage)) {
    return {
      kind: "already_exists",
      message: apiMessage,
    };
  }
  throw new Error(
    `Invite API succeeded but did not return invitation id. Response: ${apiMessage || "<empty>"}`,
  );
}

export async function processUserCreatedEvent(
  store: InMemorySyncStore,
  _archestraClient: ArchestraClient,
  event: ScalekitWebhookEvent,
): Promise<void> {
  const user = toNormalizedUserPayload(event);

  try {
    const orgLink = store.getOrganizationLink(user.organizationId);
    if (!orgLink?.archestraOrganizationId) {
      throw new Error(
        `Missing Archestra organization mapping for Scalekit org ${user.organizationId}`,
      );
    }
    const inviteResult = await createOrganizationInvite({
      organizationId: orgLink.archestraOrganizationId,
      email: user.email,
      role: resolveInviteRole(user.roleFallback),
    });
    if (inviteResult.kind === "already_exists") {
      const alreadyMessage =
        inviteResult.message || "Invitation already sent or user is already part of organization.";
      console.log(`[invite] ${user.email}: ${alreadyMessage}`);
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
        invitationStatus: "already_exists",
        invitationMessage: alreadyMessage,
      });
      return;
    }
    const invite = inviteResult.invite;
    const inviteSignupUrl = new URL(
      `${Deno.env.get("ARCHESTRA_APP_BASE_URL")?.trim() || "http://localhost:3000"}/auth/sign-up-with-invitation`,
    );
    inviteSignupUrl.searchParams.set("invitationId", invite.id);
    inviteSignupUrl.searchParams.set("email", user.email);
    console.log(`[invite] Signup URL for ${user.email}: ${inviteSignupUrl.toString()}`);

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
      invitationId: invite.id,
      invitationStatus: invite.status,
      invitationSignupUrl: inviteSignupUrl.toString(),
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
