import { ManualPaymentCheckout } from "@/components/ManualPaymentCheckout";

export const dynamic = "force-dynamic";

export default async function ManualPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManualPaymentCheckout paymentId={id} />;
}
