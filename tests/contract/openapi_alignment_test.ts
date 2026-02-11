import { assert, assertStringIncludes } from "@std/assert";

Deno.test("contract: OpenAPI contains webhook and sync-status endpoints", async () => {
  const raw = await Deno.readTextFile(
    new URL("../../specs/001-scalekit-user-sync/contracts/webhook-sync.openapi.yaml", import.meta.url),
  );
  assertStringIncludes(raw, "/webhook:");
  assertStringIncludes(raw, "/sync-status/users/{userKey}:");
  assertStringIncludes(raw, "\"401\":");
  assertStringIncludes(raw, "\"424\":");
  assert(raw.length > 100);
});

