/** Shop helpers shared by the storefront screens. */

/** OS-000123 style reference from a numeric shop order id. */
export function orderRef(id?: number | string | null): string {
  return `OS-${String(Number(id ?? 0) || 0).padStart(6, "0")}`;
}

export type OrderTone = "neutral" | "success" | "warning" | "danger";

/** Badge tone for a shop_order.status value. */
export function orderTone(status?: string | null): OrderTone {
  switch (status) {
    case "paid":
    case "fulfilled":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "neutral";
  }
}

/** Human label for a shop_order.status value. */
export function orderStatusLabel(status?: string | null): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "fulfilled":
      return "On its way";
    case "pending":
      return "Awaiting payment";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return status ? status : "—";
  }
}
