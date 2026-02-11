import { Scalekit } from "@scalekit-sdk/node";

/**
 * Creates and returns a configured Scalekit client.
 *
 * Reads required configuration from environment variables:
 * - SCALEKIT_ENVIRONMENT_URL
 * - SCALEKIT_CLIENT_ID
 * - SCALEKIT_CLIENT_SECRET
 *
 * Throws an error if any of these are missing.
 */
export function createScalekitClient(): Scalekit {
  const environmentUrl = Deno.env.get("SCALEKIT_ENVIRONMENT_URL");
  const clientId = Deno.env.get("SCALEKIT_CLIENT_ID");
  const clientSecret = Deno.env.get("SCALEKIT_CLIENT_SECRET");

  if (!environmentUrl || !clientId || !clientSecret) {
    console.error(
      "Missing one or more Scalekit env vars: SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET",
    );
    throw new Error("Scalekit configuration is incomplete");
  }

  return new Scalekit(environmentUrl, clientId, clientSecret);
}
