import { assertEquals } from "@std/assert";
import { processWebhookEvent } from "../../webhooks/handler.ts";
import {
  createMockArchestraClient,
  createMockScalekit,
  createStore,
} from "./_helpers.ts";

Deno.test("integration: user reactivation event succeeds after delete", async () => {
  const store = createStore();
  const { client } = createMockArchestraClient();
  const scalekit = createMockScalekit();

  const deletedEvent = {
    spec_version: "1",
    id: "evt_reactivate_del",
    type: "organization.directory.user_deleted",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_sk_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_react",
      organization_id: "org_sk_1",
      email: "reactivate@example.com",
      active: false,
      dp_roles: [{ value: "Member" }],
    },
  };
  await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, deletedEvent);

  const reactivationEvent = {
    ...deletedEvent,
    id: "evt_reactivate_upd",
    type: "organization.directory.user_updated",
    data: { ...deletedEvent.data, active: true, department: "Support" },
  };
  const result = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, reactivationEvent);

  assertEquals(result.statusCode, 202);
});

