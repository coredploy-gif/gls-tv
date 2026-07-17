import { Suspense } from "react";
import { ManualPaymentCheckout } from "@/components/ManualPaymentCheckout";

export const dynamic = "force-dynamic";

export default async function ManualPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gls-black">
          <div className="gls-buffer-ring" />
        </main>
      }
    >
      <ManualPaymentCheckout paymentId={id} />
    </Suspense>
  );
}
