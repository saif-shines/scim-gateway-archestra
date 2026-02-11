import type { Scalekit } from "@scalekit-sdk/node";

export class WebhookVerificationError extends Error {
  statusCode = 401;
}

export async function verifyScalekitWebhookPayload(
  scalekit: Scalekit,
  payload: unknown,
  headers: Headers | Record<string, string | string[] | undefined>,
): Promise<void> {
  const secret = Deno.env.get("SCALEKIT_WEBHOOK_SECRET");
  if (!secret) {
    throw new WebhookVerificationError("Missing SCALEKIT_WEBHOOK_SECRET");
  }

  // Scalekit SDK expects a plain object Record<string, string>, not a Headers object
  // It accesses headers using bracket notation: headers["webhook-id"]
  const headersObj: Record<string, string> = headers instanceof Headers
    ? Object.fromEntries(
        Array.from(headers.entries()).map(([key, value]) => [key, value])
      )
    : Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : String(value ?? ""),
        ])
      );

  // Log headers for debugging (especially signature headers)
  const allHeaders = Object.entries(headersObj);
  const signatureHeaders = allHeaders.filter(([key]) =>
    key.toLowerCase().includes("signature") || key.toLowerCase().includes("scalekit")
  );

  try {
    await (scalekit as unknown as {
      verifyWebhookPayload: (
        secret: string,
        headers: Record<string, string>,
        payload: unknown,
      ) => Promise<void>;
    }).verifyWebhookPayload(secret, headersObj, payload);
  } catch (error) {
    // Log the actual error for debugging
    throw new WebhookVerificationError("Invalid signature", error);
  }
}
