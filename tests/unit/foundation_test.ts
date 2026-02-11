import { assertEquals, assertRejects } from "@std/assert";
import { verifyScalekitWebhookPayload } from "../../webhooks/verify.ts";
import { InMemorySyncStore } from "../../sync/store.ts";
import { resolveMappedTeam } from "../../sync/teamMapping.ts";
import { ensureOrganizationLink } from "../../sync/organizationLink.ts";

Deno.test("verifyScalekitWebhookPayload throws on invalid signature", async () => {
  Deno.env.set("SCALEKIT_WEBHOOK_SECRET", "whsec_test");
  const scalekit = {
    verifyWebhookPayload: async () => {
      throw new Error("bad sig");
    },
  };
  await assertRejects(
    () => verifyScalekitWebhookPayload(scalekit as never, {}, new Headers()),
    Error,
    "Invalid signature",
  );
});

Deno.test("ensureOrganizationLink auto-creates and stores mapping", async () => {
  const store = new InMemorySyncStore();
  const archestraClient = {
    getOrganization: async () => ({ id: "org_arch_123", name: "Acme" }),
  };
  const scalekit = { organization: {} };
  const link = await ensureOrganizationLink(
    store,
    scalekit as never,
    archestraClient as never,
    "org_sk_123",
  );
  assertEquals(link.archestraOrganizationId, "org_arch_123");
  assertEquals(store.getOrganizationLink("org_sk_123")?.scalekitExternalId, "org_arch_123");
});

Deno.test("resolveMappedTeam falls back to role and creates team", async () => {
  const store = new InMemorySyncStore();
  const archestraClient = {
    listTeams: async () => [],
    createTeam: async (name: string) => ({ id: "team_1", name }),
  };
  const mapping = await resolveMappedTeam(store, archestraClient as never, {
    organizationId: "org_sk_123",
    roleFallback: "Admin",
  });
  assertEquals(mapping.sourceType, "role_fallback");
  assertEquals(mapping.archestraTeamName, "Admin");
});

