import { notFound } from "next/navigation";
import { ManualBillingAdmin } from "@/components/admin/ManualBillingAdmin";

const VIEWS = [
  "payments",
  "members",
  "reports",
  "receipts",
  "settings",
  "daybook",
  "ar-aging",
  "statement",
  "reconcile",
] as const;

export default async function ManualFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ member?: string; from?: string; to?: string }>;
}) {
  const { view } = await params;
  const { member, from, to } = await searchParams;
  if (!VIEWS.includes(view as (typeof VIEWS)[number])) notFound();
  return (
    <ManualBillingAdmin
      view={view as (typeof VIEWS)[number]}
      initialMember={view === "payments" || view === "statement" ? member : undefined}
      initialFrom={from}
      initialTo={to}
    />
  );
}
