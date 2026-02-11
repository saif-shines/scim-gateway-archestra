import { assertEquals } from "@std/assert";
import { processWebhookEvent } from "../../webhooks/handler.ts";
import {
  createMockArchestraClient,
  createMockScalekit,
  createStore,
} from "./_helpers.ts";

Deno.test("integration: user_updated remaps membership", async () => {
  const store = createStore();
  const { client, state } = createMockArchestraClient();
  const scalekit = createMockScalekit();

  const createEvent = {
    spec_version: "1",
    id: "evt_update_seed",
    type: "organization.directory.user_created",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_sk_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_1",
      organization_id: "org_sk_1",
      email: "update@example.com",
      active: true,
      department: "Engineering",
    },
  };
  await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, createEvent);

  const updateEvent = {
    ...createEvent,
    id: "evt_update_1",
    type: "organization.directory.user_updated",
    data: {
      ...createEvent.data,
      department: "Product",
      dp_roles: [{ value: "Editor" }],
    },
  };
  const result = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, updateEvent);

  assertEquals(result.statusCode, 202);
  assertEquals(state.teams.size >= 1, true);
});

