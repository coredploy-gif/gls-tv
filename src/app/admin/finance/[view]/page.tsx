import { notFound } from "next/navigation";
import { ManualBillingAdmin } from "@/components/admin/ManualBillingAdmin";

const VIEWS = [
  "payments",
  "members",
  "reports",
  "receipts",
  "settings",
] as const;

export default async function ManualFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { view } = await params;
  const { member } = await searchParams;
  if (!VIEWS.includes(view as (typeof VIEWS)[number])) notFound();
  return (
    <ManualBillingAdmin
      view={view as (typeof VIEWS)[number]}
      initialMember={view === "payments" ? member : undefined}
    />
  );
}
