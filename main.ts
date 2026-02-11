import "@std/dotenv/load";
import { Scalekit } from "@scalekit-sdk/node";
import { Hono, Context } from "@hono/hono";

const environmentUrl = Deno.env.get("SCALEKIT_ENVIRONMENT_URL");
const clientId = Deno.env.get("SCALEKIT_CLIENT_ID");
const clientSecret = Deno.env.get("SCALEKIT_CLIENT_SECRET");

if (!environmentUrl || !clientId || !clientSecret) {
  console.error(
    "Missing one or more Scalekit env vars: SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET",
  );
  throw new Error("Scalekit configuration is incomplete");
}

const scalekit = new Scalekit(environmentUrl, clientId, clientSecret);

const app = new Hono();

app.get("/", (c: Context) => c.text("Hono!"));

app.get("/scim-gateway", async (c: Context) => {
  const organizationId = Deno.env.get("ORGANIZATION_ID");

  if (!organizationId) {
    console.error("Missing ORGANIZATION_ID env var");
    return c.html(
      "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Configuration error</h1><p><code>ORGANIZATION_ID</code> is not set in the environment.</p></body></html>",
      500,
    );
  }

  try {
    const link = await scalekit.organization.generatePortalLink(organizationId);
    const src = link.location;

    if (!src) {
      console.error("Scalekit portal link response missing location", link);
      return c.html(
        "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Portal link error</h1><p>Could not generate admin portal link. Please try again later.</p></body></html>",
        500,
      );
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SCIM Gateway Admin Portal</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background-color: #0f172a;
        color: #e5e7eb;
      }
      .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 40px;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      p {
        margin-top: 0;
        margin-bottom: 1.25rem;
        color: #9ca3af;
      }
      .frame-wrapper {
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.5),
          0 10px 10px -5px rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(148, 163, 184, 0.4);
        background-color: #020617;
      }
      iframe {
        width: 100%;
        height: 600px;
        border: 0;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>SCIM Gateway Admin Portal</h1>
      <p>Embedded Scalekit admin portal for configuring SCIM provisioning.</p>
      <div class="frame-wrapper">
        <iframe
          src="${src}"
          allow="clipboard-write"
        ></iframe>
      </div>
    </div>
  </body>
</html>`;

    return c.html(html);
  } catch (err) {
    console.error("Failed to generate Scalekit portal link", err);
    return c.html(
      "<!doctype html><html><head><title>SCIM Gateway Error</title></head><body><h1>Unexpected error</h1><p>Unable to load the admin portal. Please try again later.</p></body></html>",
      500,
    );
  }
});

app.post("/webhook", async (c: Context) => {
  const body = await c.req.json();
  console.log(body);
  return c.text("Webhook received");
});

Deno.serve(app.fetch);
