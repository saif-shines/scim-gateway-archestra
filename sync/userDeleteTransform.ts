import type { ScalekitWebhookEvent } from "../models/syncTypes.ts";
import { toNormalizedUserPayload } from "./userCreateTransform.ts";

export function toNormalizedUserDeletePayload(event: ScalekitWebhookEvent) {
  return toNormalizedUserPayload(event);
}

