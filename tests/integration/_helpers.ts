import { InMemorySyncStore } from "../../sync/store.ts";

export function createMockArchestraClient() {
  const members = new Map<string, Set<string>>();
  const teams = new Map<string, { id: string; name: string }>();
  const users = new Map<string, { id: string; email: string; active?: boolean }>();

  return {
    state: { members, teams, users },
    client: {
      getOrganization: async () => ({ id: "org_arch_1", name: "Acme" }),
      listTeams: async () => Array.from(teams.values()),
      createTeam: async (name: string) => {
        const id = `team_${teams.size + 1}`;
        const team = { id, name };
        teams.set(id, team);
        return team;
      },
      addTeamMember: async (teamId: string, userId: string) => {
        if (!members.has(teamId)) members.set(teamId, new Set());
        members.get(teamId)!.add(userId);
      },
      removeTeamMember: async (teamId: string, userId: string) => {
        members.get(teamId)?.delete(userId);
      },
      upsertUser: async ({ externalId, email, active }: { externalId: string; email: string; active?: boolean }) => {
        const id = `usr_${externalId}`;
        users.set(id, { id, email, active });
        return { id, email };
      },
      updateUser: async ({ externalId, email, active }: { externalId: string; email: string; active?: boolean }) => {
        const id = `usr_${externalId}`;
        users.set(id, { id, email, active });
        return { id, email };
      },
    },
  };
}

export function createMockScalekit() {
  return {
    organization: {
      update: async () => undefined,
    },
  };
}

export function createStore() {
  return new InMemorySyncStore();
}

