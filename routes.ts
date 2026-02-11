import { Context, Hono } from "@hono/hono";
import type { Scalekit } from "@scalekit-sdk/node";
import { renderScimGatewayPage } from "./templates/scimGatewayPage.ts";

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
export function registerRoutes(app: Hono, scalekit: Scalekit): Hono {
  app.get("/", (c: Context) => c.text("Hono!"));

  app.get("/scim-gateway", async (c: Context) => {
    const organizationId = Deno.env.get("ORGANIZATION_ID");

    if (!organizationId) {
      console.error("[/scim-gateway] Missing ORGANIZATION_ID env var");
      return c.html(renderConfigErrorHtml(), 500);
    }

    try {
      const link = await scalekit.organization.generatePortalLink(organizationId);
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
      const body = await c.req.json();
      console.log("[/webhook] payload:", body);
      return c.text("Webhook received");
    } catch (err) {
      console.error("[/webhook] Failed to parse JSON body", err);
      return c.text("Invalid JSON body", 400);
    }
  });

  return app;
}
