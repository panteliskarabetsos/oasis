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

/** Columns the shipping calculator needs from a product. */
export const SHIPPING_COLUMNS =
  "shipping_weight_grams, shipping_length_cm, shipping_width_cm, shipping_height_cm";

export const BARCODE_MIGRATION_HINT =
  "Barcodes are unavailable until dump_sql/20260909_shop_barcodes.sql has been run.";

/**
 * Run a query against the first column set the database actually has.
 *
 * Optional columns arrive with migrations that may not have been run yet, and
 * they arrive separately — barcodes before shipping, say. Trying one "everything"
 * set and falling straight back to the minimum would hide columns that do exist,
 * so walk the sets from richest to poorest and keep the first that works.
 *
 * @param {(columns: string) => Promise<{data:any,error:any}>} run
 * @param {string[]} columnSets richest first
 */
export async function selectWithFallback(run, columnSets) {
  let lastError = null;
  for (const columns of columnSets) {
    const { data, error } = await run(columns);
    if (!error) return { data, error: null, columns };
    if (!isMissingSchema(error)) return { data: null, error, columns };
    lastError = error;
  }
  return { data: null, error: lastError, columns: null };
}
