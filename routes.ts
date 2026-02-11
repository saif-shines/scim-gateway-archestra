import { Context, Hono } from "@hono/hono";
import type { Scalekit } from "@scalekit-sdk/node";
import type { ArchestraClient } from "./archestra/client.ts";
import { readSyncStatus } from "./status/readSyncStatus.ts";
import { InMemorySyncStore } from "./sync/store.ts";
import { renderScimGatewayPage } from "./templates/scimGatewayPage.ts";
import { processWebhookEvent } from "./webhooks/handler.ts";
import {
  WebhookVerificationError,
  verifyScalekitWebhookPayload,
} from "./webhooks/verify.ts";

function renderConfigErrorHtml(): string {
  return "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Configuration error</h1><p><code>ORGANIZATION_ID</code> is not set in the environment.</p></body></html>";
}

function renderPortalErrorHtml(): string {
  return "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Portal link error</h1><p>Could not generate admin portal link. Please try again later.</p></body></html>";
}

function renderUnexpectedErrorHtml(): string {
  return "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Unexpected error</h1><p>Unable to load the admin portal. Please try again later.</p></body></html>";
}

/**
 * Registers all application routes on the given Hono app.
 */
export interface RouteDependencies {
  scalekit: Scalekit;
  archestraClient: ArchestraClient;
  store: InMemorySyncStore;
}

export function registerRoutes(app: Hono, deps: RouteDependencies): Hono {
  app.get("/", (c: Context) => c.text("Hono!"));

  app.get("/scim-gateway", async (c: Context) => {
    const organizationId = Deno.env.get("ORGANIZATION_ID");

    if (!organizationId) {
      console.error("[/scim-gateway] Missing ORGANIZATION_ID env var");
      return c.html(renderConfigErrorHtml(), 500);
    }

    try {
      const link = await deps.scalekit.organization.generatePortalLink(organizationId);
      const src = link.location;

      if (!src) {
        console.error(
          "[/scim-gateway] Scalekit portal link response missing location",
          link,
        );
        return c.html(renderPortalErrorHtml(), 500);
      }

      const html = renderScimGatewayPage(src);
      return c.html(html);
    } catch (err) {
      console.error(
        "[/scim-gateway] Failed to generate Scalekit portal link",
        err,
      );
      return c.html(renderUnexpectedErrorHtml(), 500);
    }
  });

  app.post("/webhook", async (c: Context) => {
    try {
      // Get raw body text for signature verification
      const rawBody = await c.req.text();
      // Parse JSON for processing
      const body = JSON.parse(rawBody);

      // Verify with raw body string (signatures are computed over raw bytes)
      await verifyScalekitWebhookPayload(deps.scalekit, rawBody, c.req.raw.headers);

      const result = await processWebhookEvent(
        {
          store: deps.store,
          scalekit: deps.scalekit,
          archestraClient: deps.archestraClient,
        },
        body,
      );
      return c.json(result.body, result.statusCode as 200 | 202 | 400 | 401 | 424 | 500);
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return c.json({ error: "Invalid signature" }, 401);
      }
      console.error("[/webhook] Failed to process webhook", err);
      return c.json({ error: "Invalid payload or processing failure" }, 400);
    }
  });

  app.get("/sync-status/users/:userKey", (c: Context) => {
    const userKey = c.req.param("userKey");
    const status = readSyncStatus(deps.store, userKey);
    if (!status) {
      return c.json({ error: "not_found", message: "Sync status not found" }, 404);
    }
    return c.json(status, 200);
  });

  return app;
}
