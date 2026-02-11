import type { ArchestraClient } from "../archestra/client.ts";
import type { TeamMapping } from "../models/syncTypes.ts";
import { InMemorySyncStore } from "./store.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function placeholderName(sourceValue: string): string {
  return `unmapped-${sourceValue.trim().replace(/\s+/g, "-").toLowerCase()}`;
}

export interface ResolveTeamInput {
  organizationId: string;
  department?: string;
  roleFallback?: string;
}

export async function resolveMappedTeam(
  store: InMemorySyncStore,
  archestraClient: ArchestraClient,
  input: ResolveTeamInput,
): Promise<TeamMapping> {
  const sourceValue = (input.department?.trim() || input.roleFallback?.trim() || "member");
  const sourceType: TeamMapping["sourceType"] = input.department?.trim()
    ? "department"
    : (input.roleFallback?.trim() ? "role_fallback" : "placeholder");

  const existing = store.getTeamMapping(input.organizationId, sourceType, sourceValue);
  if (existing) {
    return existing;
  }

  const allTeams = await archestraClient.listTeams();
  const normalizedSource = normalize(sourceValue);
  const found = allTeams.find((team) => normalize(team.name) === normalizedSource);

  const team = found ?? await archestraClient.createTeam(
    sourceType === "placeholder" ? placeholderName(sourceValue) : sourceValue,
  );
  const mapping: TeamMapping = {
    organizationId: input.organizationId,
    sourceValue,
    sourceType: found ? sourceType : (sourceType === "placeholder" ? "placeholder" : sourceType),
    archestraTeamId: team.id,
    archestraTeamName: team.name,
    autoCreated: !found,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return store.setTeamMapping(mapping);
}

