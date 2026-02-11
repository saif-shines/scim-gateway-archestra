import { assert } from "@std/assert";
import { SUPPORTED_EVENT_TYPES } from "../../models/syncTypes.ts";

Deno.test("quickstart validation: expected event types are wired", () => {
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory_created"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory_enabled"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_created"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_updated"));
  assert(SUPPORTED_EVENT_TYPES.includes("organization.directory.user_deleted"));
});

