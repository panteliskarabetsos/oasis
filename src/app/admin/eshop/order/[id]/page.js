import OrderDetail from "@/app/admin/eshop/_components/OrderDetail";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }) {
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
