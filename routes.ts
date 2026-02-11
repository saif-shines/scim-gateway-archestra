import { Context, Hono } from "@hono/hono";
import type { Scalekit } from "@scalekit-sdk/node";
import type { ArchestraClient } from "./archestra/client.ts";
import { readSyncStatus } from "./status/readSyncStatus.ts";
import { InMemorySyncStore } from "./sync/store.ts";
import { resolveOrCreateScalekitOrganizationByExternalId } from "./sync/organizationLink.ts";
import { renderScimGatewayPage } from "./templates/scimGatewayPage.ts";
import { processWebhookEvent } from "./webhooks/handler.ts";
import {
  verifyScalekitWebhookPayload,
  WebhookVerificationError,
} from "./webhooks/verify.ts";

function renderConfigErrorHtml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Configuration error</h1><p><code>${escaped}</code></p></body></html>`;
}

function renderPortalErrorHtml(): string {
  return "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Portal link error</h1><p>Could not generate admin portal link. Please try again later.</p></body></html>";
}

function renderUnexpectedErrorHtml(): string {
  return "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Unexpected error</h1><p>Unable to load the admin portal. Please try again later.</p></body></html>";
}

function appendPortalFeatures(location: string, features: string[]): string {
  if (!features.length) return location;
  const url = new URL(location);
  for (const feature of features) {
    url.searchParams.append("features", feature);
  }
  return url.toString();
}

async function ensureDirectorySyncEnabled(
  scalekit: Scalekit,
  organizationId: string,
): Promise<void> {
  try {
    await scalekit.organization.updateOrganizationSettings(organizationId, {
      features: [
        { name: "sso", enabled: false },
        { name: "dir_sync", enabled: true },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes(
        "Feature directory_sync is not supported by environment",
      ) ||
      message.includes("Feature dir_sync is not supported by environment")
    ) {
      console.warn(
        "[/scim-gateway] dir_sync setting unsupported in this environment; continuing without settings update",
      );
      return;
    }
    throw err;
  }
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
    try {
      const { scalekitOrganizationId } =
        await resolveOrCreateScalekitOrganizationByExternalId(
          deps.scalekit,
          deps.archestraClient,
        );

      await ensureDirectorySyncEnabled(deps.scalekit, scalekitOrganizationId);

      const link = await deps.scalekit.organization.generatePortalLink(
        scalekitOrganizationId,
      );
      const src = appendPortalFeatures(link.location, ["dir_sync"]);

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
        "[/scim-gateway] Failed to resolve organization or generate portal link",
        err,
      );
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Archestra") || message.includes("organization")) {
        return c.html(renderConfigErrorHtml(message), 500);
      }
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
      await verifyScalekitWebhookPayload(
        deps.scalekit,
        rawBody,
        c.req.raw.headers,
      );

      const result = await processWebhookEvent(
        {
          store: deps.store,
          scalekit: deps.scalekit,
          archestraClient: deps.archestraClient,
        },
        body,
      );
      return c.json(
        result.body,
        result.statusCode as 200 | 202 | 400 | 401 | 424 | 500,
      );
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
      return c.json(
        { error: "not_found", message: "Sync status not found" },
        404,
      );
    }
    return c.json(status, 200);
  });

  return app;
}
