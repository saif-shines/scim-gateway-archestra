import "@std/dotenv/load";
import { Hono } from "@hono/hono";
import { createScalekitClient } from "./scalekitClient.ts";
import { registerRoutes } from "./routes.ts";

/**
 * Application entrypoint.
 *
 * - Creates the Scalekit client.
 * - Creates the Hono app.
 * - Registers all routes.
 * - Starts the Deno HTTP server.
 */
const scalekit = createScalekitClient();
const app = new Hono();

registerRoutes(app, scalekit);

Deno.serve(app.fetch);
