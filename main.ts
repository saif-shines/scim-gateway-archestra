import { Scalekit } from "@scalekit-sdk/node";
import { Hono, Context } from "@hono/hono";

const app = new Hono()


console.log(Scalekit)

app.get('/', (c: Context) => c.text('Hono!'))

app.post('/webhook', async (c: Context) => {
  const body = await c.req.json();
  console.log(body);
  return c.text('Webhook received');
})

Deno.serve(app.fetch);
