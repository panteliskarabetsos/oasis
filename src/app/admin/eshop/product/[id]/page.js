import ProductForm from "@/app/admin/eshop/_components/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  return <ProductForm productId={id} />;
}
