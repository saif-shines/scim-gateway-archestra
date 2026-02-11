import { Scalekit } from "@scalekit-sdk/node";
import { Hono, Context } from "@hono/hono";

const app = new Hono()


console.log(Scalekit)

export function add(a: number, b: number): number {
  return a + b;
}
console.log(add(12, 12));

app.get('/', (c: Context) => c.text('Hono!'))

app.post('/webhook', (c: Context) => c.text('Hono!'))

Deno.serve(app.fetch);
