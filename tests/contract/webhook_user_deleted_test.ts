import { assert } from "@std/assert";
import { validateWebhookEventPayload } from "../../webhooks/handler.ts";

Deno.test("contract: user_deleted payload validates", () => {
  const payload = {
    spec_version: "1",
    id: "evt_3",
    type: "organization.directory.user_deleted",
    occurred_at: new Date().toISOString(),
    environment_id: "env_1",
    organization_id: "org_1",
    object: "DirectoryUser",
    data: {
      id: "diruser_1",
      organization_id: "org_1",
      email: "test@example.com",
      active: false,
    },
  };
  assert(validateWebhookEventPayload(payload));
});

