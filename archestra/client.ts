interface ArchestraOrganizationResponse {
  id?: string;
  name?: string;
  display_name?: string;
}

interface ArchestraTeamResponse {
  id: string;
  name: string;
}

interface ArchestraUserListItem {
  id: string;
  name: string;
}

interface ArchestraRoleItem {
  id?: string;
  name?: string;
}

interface ArchestraTeamMemberItem {
  userId?: string;
  role?: string;
}

export interface ArchestraUserInput {
  externalId: string;
  email: string;
  preferredUsername?: string;
  givenName?: string;
  familyName?: string;
  fullName?: string;
  active?: boolean;
}

export interface ArchestraClient {
  getOrganization(): Promise<{ id: string; name?: string }>;
  listTeams(): Promise<Array<{ id: string; name: string }>>;
  createTeam(name: string): Promise<{ id: string; name: string }>;
  addTeamMember(teamId: string, userId: string, role?: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  upsertUser(input: ArchestraUserInput): Promise<{ id: string; email: string }>;
  updateUser(input: ArchestraUserInput): Promise<{ id: string; email: string }>;
}

export class HttpArchestraClient implements ArchestraClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    const envApiKey = Deno.env.get("ARCHESTRA_APIKEY");
    const envBaseUrl = Deno.env.get("ARCHESTRA_API_BASE_URL");
    this.baseUrl = baseUrl ?? envBaseUrl ?? "http://localhost:9000";
    this.apiKey = apiKey ?? envApiKey ?? "";
    if (!this.apiKey) {
      throw new Error("ARCHESTRA_APIKEY is required");
    }
    if (!envBaseUrl && !baseUrl && this.baseUrl === "http://localhost:9000") {
      console.warn(
        "[ArchestraClient] WARNING: ARCHESTRA_API_BASE_URL is not set. Defaulting to http://localhost:9000. " +
        "If you're connecting to a remote Archestra API, set ARCHESTRA_API_BASE_URL environment variable."
      );
    }
  }

  async getOrganization(): Promise<{ id: string; name?: string }> {
    const data = await this.request<ArchestraOrganizationResponse>("/api/organization", {
      method: "GET",
    });
    if (!data.id) {
      throw new Error("Archestra organization response missing id");
    }
    return { id: data.id, name: data.display_name ?? data.name };
  }

  async listTeams(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.request<ArchestraTeamResponse[] | { items?: ArchestraTeamResponse[] }>(
      "/api/teams",
      { method: "GET" },
    );
    if (Array.isArray(data)) {
      return data.map((t) => ({ id: t.id, name: t.name }));
    }
    return (data.items ?? []).map((t) => ({ id: t.id, name: t.name }));
  }

  async createTeam(name: string): Promise<{ id: string; name: string }> {
    const data = await this.request<ArchestraTeamResponse>("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!data.id) {
      throw new Error("Archestra team create response missing id");
    }
    return { id: data.id, name: data.name ?? name };
  }

  async addTeamMember(teamId: string, userId: string, role = "member"): Promise<void> {
    const userIdLooksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(userId);
    let availableRoleCount: number | null = null;
    let requestedRoleExists: boolean | null = null;
    try {
      const roles = await this.request<ArchestraRoleItem[] | { items?: ArchestraRoleItem[] }>(
        "/api/roles",
        { method: "GET" },
      );
      const roleItems = Array.isArray(roles) ? roles : (roles.items ?? []);
      const requested = role.trim().toLowerCase();
      availableRoleCount = roleItems.length;
      requestedRoleExists = roleItems.some((r) => (r.name ?? "").trim().toLowerCase() === requested);
    } catch {
      // best-effort debug only
    }
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:addTeamMember", message: "Preparing team membership mutation", data: { teamId, userIdPrefix: userId.slice(0, 16), userIdLength: userId.length, userIdLooksUuid, role, availableRoleCount, requestedRoleExists }, timestamp: Date.now(), runId: "debug-membership", hypothesisId: "H1,H2,H8" }) }).catch(() => {});
    // #endregion
    await this.request(`/api/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await this.request(`/api/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  async upsertUser(input: ArchestraUserInput): Promise<{ id: string; email: string }> {
    const externalIdLooksUuid = this.looksLikeUuid(input.externalId);
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:upsertUser", message: "User id source selected for create flow", data: { source: "externalId", externalIdPrefix: input.externalId.slice(0, 16), externalIdLength: input.externalId.length, externalIdLooksUuid }, timestamp: Date.now(), runId: "debug-membership", hypothesisId: "H1" }) }).catch(() => {});
    // #endregion
    // Archestra membership endpoints require Archestra internal user IDs.
    // If external_id is not in that format, resolve by identity labels from Archestra.
    if (externalIdLooksUuid) {
      return { id: input.externalId, email: input.email };
    }
    const resolvedId = await this.resolveExistingArchestraUserId(input);
    return { id: resolvedId, email: input.email };
  }

  async updateUser(input: ArchestraUserInput): Promise<{ id: string; email: string }> {
    const externalIdLooksUuid = this.looksLikeUuid(input.externalId);
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:updateUser", message: "User id source selected for update flow", data: { source: "externalId", externalIdPrefix: input.externalId.slice(0, 16), externalIdLength: input.externalId.length, externalIdLooksUuid, active: input.active ?? null }, timestamp: Date.now(), runId: "debug-membership", hypothesisId: "H1" }) }).catch(() => {});
    // #endregion
    if (externalIdLooksUuid) {
      return { id: input.externalId, email: input.email };
    }
    const resolvedId = await this.resolveExistingArchestraUserId(input);
    return { id: resolvedId, email: input.email };
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
  }

  private async resolveExistingArchestraUserId(input: ArchestraUserInput): Promise<string> {
    const users = await this.request<ArchestraUserListItem[]>("/api/interactions/user-ids", {
      method: "GET",
    });
    const normalize = (value: string) => value.trim().toLowerCase();
    const localPart = input.email.includes("@") ? normalize(input.email.split("@")[0]) : "";
    const candidates = [
      input.fullName,
      input.preferredUsername,
      input.email,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalize);
    const candidateSet = new Set(candidates);
    const exact = users.find((user) => candidateSet.has(normalize(user.name)));
    const userNameWithAtCount = users.filter((user) => normalize(user.name).includes("@")).length;
    const userNameWithSpaceCount = users.filter((user) => normalize(user.name).includes(" ")).length;
    const userNameEqualsLocalPartCount = localPart
      ? users.filter((user) => normalize(user.name) === localPart).length
      : 0;
    const userIdLooksUuidCount = users.filter((user) => this.looksLikeUuid(user.id)).length;

    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:resolveExistingArchestraUserId", message: "Resolved Archestra user id from user list", data: { userListCount: users.length, candidateCount: candidates.length, matched: Boolean(exact), matchedIdPrefix: exact?.id.slice(0, 12) ?? null, userIdLooksUuidCount, userNameWithAtCount, userNameWithSpaceCount, userNameEqualsLocalPartCount }, timestamp: Date.now(), runId: "post-fix", hypothesisId: "H5,H6,H7" }) }).catch(() => {});
    // #endregion

    if (exact) {
      return exact.id;
    }

    // In some Archestra deployments, /api/interactions/user-ids is already scoped
    // to a single effective user and does not expose email/full-name labels.
    // Use the only available user id as a deterministic fallback.
    if (users.length === 1 && users[0].id) {
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:resolveExistingArchestraUserId", message: "Fallback: single visible Archestra user id selected", data: { fallbackUserIdPrefix: users[0].id.slice(0, 12), fallbackUserIdLength: users[0].id.length, fallbackUserIdLooksUuid: this.looksLikeUuid(users[0].id) }, timestamp: Date.now(), runId: "post-fix", hypothesisId: "H10" }) }).catch(() => {});
      // #endregion
      return users[0].id;
    }

    throw new Error(
      "Unable to map webhook user to Archestra internal user id. " +
      "No match in /api/interactions/user-ids for available identity labels.",
    );
  }

  private async request<T = Record<string, unknown>>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    // Archestra API expects the API key directly, not "Bearer <key>"
    const authHeader = this.apiKey;
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    };

    const response = await fetch(url, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      let requestUserId: string | undefined;
      let requestRole: string | undefined;
      if (typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body) as { userId?: string; role?: string };
          requestUserId = parsed.userId;
          requestRole = parsed.role;
        } catch {
          // no-op: only best-effort parse for debug context
        }
      }
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:request:error", message: "Archestra request failed with classification", data: { path, status: response.status, hasForeignKeyHint: /foreign key|violates|constraint|team_member/i.test(text), requestUserIdPrefix: requestUserId?.slice(0, 16) ?? null, requestUserIdLooksUuid: requestUserId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestUserId) : null, requestRole: requestRole ?? null }, timestamp: Date.now(), runId: "debug-membership", hypothesisId: "H1,H2,H3" }) }).catch(() => {});
      // #endregion
      if (response.status >= 500 && path.includes("/members")) {
        try {
          const teamPath = path.split("/members")[0];
          const members = await this.request<ArchestraTeamMemberItem[]>(
            `${teamPath}/members`,
            { method: "GET" },
          );
          const sample = members[0];
          // #region agent log
          fetch("http://127.0.0.1:7244/ingest/3bfa3330-f668-485b-b926-ca8fb6e248c0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "archestra/client.ts:request:error:members", message: "Existing team members sampled after membership failure", data: { teamPath, existingMemberCount: members.length, sampleUserIdPrefix: sample?.userId?.slice(0, 16) ?? null, sampleUserIdLength: sample?.userId?.length ?? null, sampleRole: sample?.role ?? null }, timestamp: Date.now(), runId: "debug-membership", hypothesisId: "H8,H9" }) }).catch(() => {});
          // #endregion
        } catch {
          // best-effort debug only
        }
      }
      console.error(`[ArchestraClient] Request failed: ${response.status} ${path}`);
      console.error(`[ArchestraClient] Request URL: ${url}`);
      console.error(`[ArchestraClient] Response: ${text}`);
      if (response.status === 401 && this.baseUrl === "http://localhost:9000") {
        throw new Error(
          `Archestra API ${response.status} ${path}: ${text}. ` +
          `NOTE: You're connecting to ${this.baseUrl}. ` +
          `If this is incorrect, set ARCHESTRA_API_BASE_URL environment variable to your actual Archestra API URL.`
        );
      }
      throw new Error(`Archestra API ${response.status} ${path}: ${text}`);
    }
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  }
}
