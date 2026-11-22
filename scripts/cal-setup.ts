// Lists your Cal.com event types (id, title, length). Never prints the API key.
// Usage: npm run cal:setup
async function main() {
  const key = process.env.CAL_API_KEY;
  if (!key) throw new Error("CAL_API_KEY missing");
  const res = await fetch("https://api.cal.com/v2/event-types", {
    headers: { Authorization: `Bearer ${key}`, "cal-api-version": "2024-06-14" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as { status?: string; data?: unknown; error?: unknown };
  if (!res.ok) throw new Error(`Cal.com HTTP ${res.status}: ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
  const list = Array.isArray(body.data) ? body.data : [];
  for (const e of list as { id: number; title?: string; slug?: string; lengthInMinutes?: number; length?: number }[]) {
    console.log(`id=${e.id} | ${e.title ?? e.slug} | ${e.lengthInMinutes ?? e.length ?? "?"} min`);
  }
  if (list.length === 0) console.log("No event types found. Raw shape:", JSON.stringify(body).slice(0, 300));
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
