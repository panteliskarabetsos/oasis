// src/lib/shop/schema.js
// Pure helper shared by the shop routes: tell a "you have not run the
// migration yet" error apart from a real failure, so a deploy that lands
// before its SQL degrades instead of breaking the page.

/** True when a PostgREST/Postgres error means a table or column is absent. */
export function isMissingSchema(error) {
  if (!error) return false;
  const code = String(error.code || "");
  // 42P01 undefined_table, 42703 undefined_column,
  // PGRST204 column not in schema cache, PGRST205 table not in schema cache
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(code)) return true;
  const msg = String(error.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}

export const BARCODE_MIGRATION_HINT =
  "Barcodes are unavailable until dump_sql/20260909_shop_barcodes.sql has been run.";
