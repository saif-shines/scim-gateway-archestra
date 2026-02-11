import { assert } from "@std/assert";
import { SUPPORTED_EVENT_TYPES } from "./models/syncTypes.ts";

Deno.test("supported event types include user lifecycle", () => {
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_created"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_updated"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_deleted"));
});
