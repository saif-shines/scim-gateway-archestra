import type { SyncStatusRecord } from "../models/syncTypes.ts";
import { InMemorySyncStore } from "../sync/store.ts";

export function readSyncStatus(
  store: InMemorySyncStore,
  userKey: string,
): SyncStatusRecord | undefined {
  return store.getSyncStatusByLookupKey(userKey);
}

