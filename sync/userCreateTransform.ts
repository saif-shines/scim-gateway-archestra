import type { DirectoryUserEventData, ScalekitWebhookEvent } from "../models/syncTypes.ts";

export interface NormalizedUserPayload {
  scalekitUserId: string;
  organizationId: string;
  email: string;
  preferredUsername: string;
  givenName?: string;
  familyName?: string;
  fullName?: string;
  department?: string;
  roleFallback?: string;
  active: boolean;
}

export function toNormalizedUserPayload(
  event: ScalekitWebhookEvent,
): NormalizedUserPayload {
  const data = event.data as DirectoryUserEventData;
  const roleFallback = data.dp_roles?.[0]?.value;
  const preferredUsername = data.preferred_username || data.email;
  return {
    scalekitUserId: data.id,
    organizationId: data.organization_id,
    email: data.email,
    preferredUsername,
    givenName: data.given_name,
    familyName: data.family_name,
    fullName: data.name,
    department: data.department,
    roleFallback,
    active: data.active,
  };
}

