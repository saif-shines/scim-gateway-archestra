import type { SyncOutcome, SyncStatusRecord } from "../models/syncTypes.ts";
import { InMemorySyncStore } from "../sync/store.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export interface RecordSyncStatusInput {
  organizationId: string;
  lookupKey: string;
  userDisplayName?: string;
  eventType: string;
  outcome: SyncOutcome;
  error?: string;
}

export function recordSyncStatus(
  store: InMemorySyncStore,
  input: RecordSyncStatusInput,
): SyncStatusRecord {
  const existing = store.getSyncStatus(input.organizationId, input.lookupKey);
  const record: SyncStatusRecord = {
    lookupKey: input.lookupKey,
    organizationId: input.organizationId,
    userDisplayName: input.userDisplayName ?? existing?.userDisplayName,
    lastAttemptAt: nowIso(),
    lastSuccessfulSyncAt: input.outcome === "success" ? nowIso() : existing?.lastSuccessfulSyncAt,
    lastOutcome: input.outcome,
    lastEventType: input.eventType,
    lastError: input.error,
  };
  return store.setSyncStatus(record);
}

