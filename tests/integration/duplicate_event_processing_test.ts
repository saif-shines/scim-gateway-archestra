import { assertEquals } from "@std/assert";
import { processWebhookEvent } from "../../webhooks/handler.ts";
import {
  createMockArchestraClient,
  createMockScalekit,
  createStore,
} from "./_helpers.ts";

Deno.test("integration: duplicate logical events are processed independently", async () => {
  const store = createStore();
  const { client } = createMockArchestraClient();
  const scalekit = createMockScalekit();

  const base = {
    spec_version: "1",
    type: "organization.directory.user_updated",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_sk_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_dup",
      organization_id: "org_sk_1",
      email: "dup@example.com",
      active: true,
      dp_roles: [{ value: "Member" }],
    },
  };

  const first = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, { ...base, id: "evt_dup_1" });
  const second = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, { ...base, id: "evt_dup_2" });

  assertEquals(first.statusCode, 202);
  assertEquals(second.statusCode, 202);
});

