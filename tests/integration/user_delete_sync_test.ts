import { assertEquals } from "@std/assert";
import { processWebhookEvent } from "../../webhooks/handler.ts";
import {
  createMockArchestraClient,
  createMockScalekit,
  createStore,
} from "./_helpers.ts";

Deno.test("integration: user_deleted removes team membership", async () => {
  const store = createStore();
  const { client } = createMockArchestraClient();
  const scalekit = createMockScalekit();

  const createEvent = {
    spec_version: "1",
    id: "evt_delete_seed",
    type: "organization.directory.user_created",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_sk_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_del",
      organization_id: "org_sk_1",
      email: "delete@example.com",
      active: true,
      department: "Engineering",
    },
  };
  await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, createEvent);

  const deleteEvent = {
    ...createEvent,
    id: "evt_delete_1",
    type: "organization.directory.user_deleted",
    data: { ...createEvent.data, active: false },
  };
  const result = await processWebhookEvent({
    store,
    scalekit: scalekit as never,
    archestraClient: client as never,
  }, deleteEvent);
  assertEquals(result.statusCode, 202);
});

