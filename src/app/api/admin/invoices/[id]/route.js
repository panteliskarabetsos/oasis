import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function GET(req, context) {
  const params = await context.params;
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  try {
    const invoice = await stripe.invoices.retrieve(id, {
      expand: ["customer", "lines.data.price.product"],
    });

    const cust = typeof invoice.customer === "object" ? invoice.customer : null;
    const taxId = cust?.tax_ids?.data?.[0]?.value || null;
    const taxIdType = cust?.tax_ids?.data?.[0]?.type || null;

    const items = (invoice.lines?.data || []).map((li) => {
      const qty = li.quantity || 1;
      const unitCents =
        li.price?.unit_amount ??
        (li.amount_excluding_tax ?? li.amount ?? 0) / (qty || 1);
      return {
        description:
          li.description ||
          li.price?.nickname ||
          li.price?.product?.name ||
          "Item",
        amount: (unitCents || 0) / 100,
        quantity: qty,
      };
    });

    const payload = {
      id: invoice.id,
      number: invoice.number || null,
      status: invoice.status,
      currency: invoice.currency?.toUpperCase?.() || invoice.currency,
      collection_method: invoice.collection_method,
      days_until_due:
        typeof invoice.days_until_due === "number" ? invoice.days_until_due : null,
      memo: invoice.description || invoice.metadata?.memo || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      total: ((invoice.total ?? invoice.amount_due ?? 0) / 100) || 0,
      customer: {
        type: taxId ? "business" : "individual",
        email: cust?.email || null,
        name: cust?.name || null,
        business_name: cust?.metadata?.business_name || null,
        phone: cust?.phone || null,
        tax_id: taxId,
        tax_id_type: taxId ? taxIdType : null,
        address: cust?.address || null,
      },
      items,
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
