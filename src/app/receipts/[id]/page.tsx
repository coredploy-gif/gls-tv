import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlsLogo } from "@/components/GlsLogo";
import { ReceiptPrintButton } from "@/components/ReceiptPrintButton";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";

export const dynamic = "force-dynamic";

function planName(plan: string) {
  if (plan === "gls_65") return "Plus";
  if (plan === "gls_75") return "Family";
  return "Standard";
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/receipts/${id}`)}`);

  const service = createServiceClient();
  if (!service) notFound();
  const { data: receipt } = await service
    .from("payment_receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) notFound();
  if (receipt.user_id !== user.id && !isEadminEmail(user.email)) notFound();

  return (
    <main className="min-h-screen bg-[#07070a] px-4 py-8 text-white print:bg-white print:p-0 print:text-black">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <GlsLogo size="sm" href="/browse" glass />
          <div className="flex gap-2">
            <Link
              href={isEadminEmail(user.email) ? "/admin/finance/receipts" : "/pricing"}
              className="rounded-md border border-white/15 px-4 py-2 text-sm text-gls-body hover:text-white"
            >
              Back
            </Link>
            <ReceiptPrintButton />
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white text-[#17171b] shadow-2xl print:rounded-none print:border-0 print:shadow-none">
          <div className="bg-gradient-to-r from-[#7f1028] via-[#b61947] to-[#e34f8a] px-7 py-8 text-white sm:px-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/75">
                  {receipt.trading_name}
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                  Payment receipt
                </h1>
                <p className="mt-2 text-sm text-white/80">Not a VAT invoice</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-mono text-lg font-semibold">
                  {receipt.receipt_number}
                </p>
                <p className="mt-1 text-sm text-white/75">
                  Issued{" "}
                  {new Date(receipt.issued_at).toLocaleDateString("en-ZA", {
                    dateStyle: "long",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="px-7 py-8 sm:px-10 sm:py-10">
            {receipt.refunded_at && (
              <div className="mb-7 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Refunded{" "}
                {new Date(receipt.refunded_at).toLocaleDateString("en-ZA")}.
                {receipt.refund_note ? ` ${receipt.refund_note}` : ""}
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#777780]">
                  Received from
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {receipt.customer_name || receipt.customer_email || "GLS TV member"}
                </p>
                {receipt.customer_email && (
                  <p className="mt-1 text-sm text-[#686870]">
                    {receipt.customer_email}
                  </p>
                )}
                <p className="mt-3 font-mono text-sm text-[#44444b]">
                  {receipt.member_reference}
                </p>
              </section>

              <section className="sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#777780]">
                  Payment
                </p>
                <p className="mt-2 text-4xl font-semibold">
                  R{(receipt.amount_zar_cents / 100).toFixed(2)}
                </p>
                <p className="mt-1 text-sm uppercase text-[#686870]">
                  {receipt.payment_method} · ZAR
                </p>
              </section>
            </div>

            <div className="mt-10 overflow-hidden rounded-xl border border-[#e7e7eb]">
              <div className="grid grid-cols-[1fr_auto] gap-4 bg-[#f7f7f9] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777780]">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-5">
                <div>
                  <p className="font-semibold">
                    GLS TV {planName(receipt.plan)} membership
                  </p>
                  <p className="mt-1 text-sm text-[#686870]">
                    {new Date(
                      receipt.membership_starts_at,
                    ).toLocaleDateString("en-ZA")}{" "}
                    –{" "}
                    {new Date(receipt.membership_ends_at).toLocaleDateString(
                      "en-ZA",
                    )}
                  </p>
                </div>
                <p className="font-semibold">
                  R{(receipt.amount_zar_cents / 100).toFixed(2)}
                </p>
              </div>
            </div>

            <dl className="mt-8 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#85858d]">Payment reference</dt>
                <dd className="mt-1 font-mono font-medium">
                  {receipt.payment_reference}
                </dd>
              </div>
              <div>
                <dt className="text-[#85858d]">Paid on</dt>
                <dd className="mt-1 font-medium">
                  {new Date(receipt.paid_at).toLocaleString("en-ZA")}
                </dd>
              </div>
              {receipt.external_transaction_id && (
                <div>
                  <dt className="text-[#85858d]">Transaction ID</dt>
                  <dd className="mt-1 break-all font-mono font-medium">
                    {receipt.external_transaction_id}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[#85858d]">Membership expires</dt>
                <dd className="mt-1 font-medium">
                  {new Date(receipt.membership_ends_at).toLocaleString("en-ZA")}
                </dd>
              </div>
            </dl>

            <div className="mt-10 border-t border-[#e7e7eb] pt-6 text-sm text-[#686870]">
              <p>{receipt.receipt_footer || "Thank you for your GLS TV membership."}</p>
              <p className="mt-2 text-xs">
                This receipt confirms payment received. No VAT has been charged.
              </p>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
