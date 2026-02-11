import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { toNormalizedUserPayload } from "./userCreateTransform.ts";

export function toNormalizedUserUpdatePayload(event: ScalekitWebhookEvent) {
  return toNormalizedUserPayload(event);
}

