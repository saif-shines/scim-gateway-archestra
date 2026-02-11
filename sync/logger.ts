export function logSync(level: "info" | "error", event: string, data: Record<string, unknown>): void {
  const payload = JSON.stringify({ event, ...data });
  if (level === "error") {
    console.error(`[sync] ${payload}`);
    return;
  }
}
