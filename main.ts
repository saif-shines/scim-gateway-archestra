import "@std/dotenv/load";
import { Hono } from "@hono/hono";
import { HttpArchestraClient } from "./archestra/client.ts";
import { createScalekitClient } from "./scalekitClient.ts";
import { registerRoutes } from "./routes.ts";
import { InMemorySyncStore } from "./sync/store.ts";

/**
 * Application entrypoint.
 *
 * - Creates the Scalekit client.
 * - Creates the Hono app.
 * - Registers all routes.
 * - Starts the Deno HTTP server.
 */
const scalekit = createScalekitClient();
const archestraClient = new HttpArchestraClient();
const store = new InMemorySyncStore();
const app = new Hono();

registerRoutes(app, { scalekit, archestraClient, store });

Deno.serve(app.fetch);
