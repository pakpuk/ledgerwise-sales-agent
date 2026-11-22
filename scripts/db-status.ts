// Read-only: list tables and row counts. Usage: npm run db:status
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const tables = await sql.query(
    "select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1, 2",
  );
  console.log("Tables:");
  for (const t of tables) {
    const [{ n }] = await sql.query(`select count(*)::int as n from "${t.table_schema}"."${t.table_name}"`);
    console.log(`  ${t.table_schema}.${t.table_name}: ${n} rows`);
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
