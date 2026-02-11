import { assertEquals } from "@std/assert";
import { processWebhookEvent } from "../../webhooks/handler.ts";
import {
  createMockArchestraClient,
  createMockScalekit,
  createStore,
} from "./_helpers.ts";

Deno.test("integration: user_created sync creates membership and org link", async () => {
  const store = createStore();
  const { client, state } = createMockArchestraClient();
  const scalekit = createMockScalekit();

  const event = {
    spec_version: "1",
    id: "evt_create_1",
    type: "organization.directory.user_created",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_sk_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_1",
      organization_id: "org_sk_1",
      email: "create@example.com",
      active: true,
      department: "Engineering",
    },
  };

  const result = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, event);

  assertEquals(result.statusCode, 202);
  assertEquals(store.getOrganizationLink("org_sk_1")?.archestraOrganizationId, "org_arch_1");
  assertEquals(state.teams.size, 1);
});

