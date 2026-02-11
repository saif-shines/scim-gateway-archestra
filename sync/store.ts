import type {
  OrganizationLink,
  SyncEventRecord,
  SyncStatusRecord,
  TeamMapping,
} from "../models/syncTypes.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function teamKey(orgId: string, sourceType: string, sourceValue: string): string {
  return `${orgId}::${sourceType}::${sourceValue.toLowerCase()}`;
}

export class InMemorySyncStore {
  private readonly organizationLinks = new Map<string, OrganizationLink>();
  private readonly syncStatuses = new Map<string, SyncStatusRecord>();
  private readonly teamMappings = new Map<string, TeamMapping>();
  private readonly syncEvents = new Map<string, SyncEventRecord[]>();

  getOrganizationLink(scalekitOrganizationId: string): OrganizationLink | undefined {
    return this.organizationLinks.get(scalekitOrganizationId);
  }

  setOrganizationLink(link: OrganizationLink): OrganizationLink {
    const existing = this.organizationLinks.get(link.scalekitOrganizationId);
    const toSave: OrganizationLink = {
      ...link,
      createdAt: existing?.createdAt ?? link.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    this.organizationLinks.set(link.scalekitOrganizationId, toSave);
    return toSave;
  }

  setTeamMapping(mapping: TeamMapping): TeamMapping {
    const key = teamKey(mapping.organizationId, mapping.sourceType, mapping.sourceValue);
    const existing = this.teamMappings.get(key);
    const toSave: TeamMapping = {
      ...mapping,
      createdAt: existing?.createdAt ?? mapping.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    this.teamMappings.set(key, toSave);
    return toSave;
  }

  getTeamMapping(
    organizationId: string,
    sourceType: TeamMapping["sourceType"],
    sourceValue: string,
  ): TeamMapping | undefined {
    return this.teamMappings.get(teamKey(organizationId, sourceType, sourceValue));
  }

  setSyncStatus(record: SyncStatusRecord): SyncStatusRecord {
    const key = `${record.organizationId}::${record.lookupKey.toLowerCase()}`;
    this.syncStatuses.set(key, record);
    return record;
  }

  getSyncStatus(organizationId: string, lookupKey: string): SyncStatusRecord | undefined {
    return this.syncStatuses.get(`${organizationId}::${lookupKey.toLowerCase()}`);
  }

  getSyncStatusByLookupKey(lookupKey: string): SyncStatusRecord | undefined {
    const lowered = lookupKey.toLowerCase();
    for (const [key, value] of this.syncStatuses.entries()) {
      if (key.endsWith(`::${lowered}`)) {
        return value;
      }
    }
    return undefined;
  }

  addSyncEvent(eventRecord: SyncEventRecord): void {
    const list = this.syncEvents.get(eventRecord.eventId) ?? [];
    list.push(eventRecord);
    this.syncEvents.set(eventRecord.eventId, list);
  }

  listSyncEvents(eventId: string): SyncEventRecord[] {
    return this.syncEvents.get(eventId) ?? [];
  }
}

