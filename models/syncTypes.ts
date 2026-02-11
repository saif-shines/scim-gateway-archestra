export const SUPPORTED_EVENT_TYPES = [
  "organization.directory_created",
  "organization.directory_enabled",
  "organization.directory.user_created",
  "organization.directory.user_updated",
  "organization.directory.user_deleted",
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export type SyncEventStatus = "received" | "processing" | "succeeded" | "failed";

export type SyncOutcome = "success" | "failed" | "partial" | "never_synced";

export interface DirectoryRole {
  value?: string;
  type?: string;
  display?: string;
  primary?: boolean;
}

export interface DirectoryUserEventData {
  id: string;
  organization_id: string;
  email: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  department?: string;
  active: boolean;
  dp_roles?: DirectoryRole[];
  raw_attributes?: Record<string, unknown>;
}

export interface DirectoryEventData {
  id: string;
  organization_id: string;
  directory_type?: string;
  provider?: string;
  enabled?: boolean;
  updated_at?: string;
}

export interface ScalekitWebhookEvent {
  spec_version: string;
  id: string;
  type: SupportedEventType;
  occurred_at: string;
  environment_id: string;
  organization_id: string;
  object: string;
  data: DirectoryUserEventData | DirectoryEventData;
  display_name?: string;
}

export interface OrganizationLink {
  scalekitOrganizationId: string;
  archestraOrganizationId: string;
  scalekitExternalId: string;
  displayName?: string;
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMapping {
  organizationId: string;
  sourceValue: string;
  sourceType: "department" | "role_fallback" | "placeholder";
  archestraTeamId: string;
  archestraTeamName: string;
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatusRecord {
  lookupKey: string;
  organizationId: string;
  userDisplayName?: string;
  lastAttemptAt: string;
  lastSuccessfulSyncAt?: string;
  lastOutcome: SyncOutcome;
  lastEventType?: string;
  lastError?: string;
}

export interface SyncEventRecord {
  eventId: string;
  eventType: SupportedEventType;
  organizationId: string;
  directoryUserId?: string;
  occurredAt: string;
  receivedAt: string;
  status: SyncEventStatus;
  retryCount: 0 | 1;
  failureCode?: string;
  failureMessage?: string;
  rawPayload: unknown;
}

export interface ProcessResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export function isSupportedEventType(value: string): value is SupportedEventType {
  return (SUPPORTED_EVENT_TYPES as readonly string[]).includes(value);
}

