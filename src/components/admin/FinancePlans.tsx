import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GLS_PLANS } from "@/lib/membership/plans";

export function FinancePlans() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="Plans"
        description="Simple 30-day ZAR memberships. Members pay with PayFast debit or verified EFT."
        actions={
          <Link
            href="/admin/finance/settings"
            className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gls-body hover:text-white"
          >
            Payment settings
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {GLS_PLANS.map((plan, index) => (
          <div key={plan.id} className="gls-admin-card rounded-xl p-6">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{
                color: ["#ff6b9d", "#7ec8ff", "#f5c542"][index % 3],
              }}
            >
              {plan.name}
            </p>
            <p className="gls-display mt-3 text-5xl text-white">
              R{plan.priceZar}
            </p>
            <p className="mt-1 text-sm text-gls-muted">
              / 30 days · {plan.badge}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-gls-body">
              <li>{plan.adultProfiles} adult profiles</li>
              <li>Kids profile included</li>
              <li>PayFast card debit when configured</li>
              <li>EFT with unique GLS payment reference</li>
              <li>Receipt after verification</li>
            </ul>
            <p className="mt-5 font-mono text-[10px] text-gls-muted">
              plan: {plan.id} · amount: {(plan.priceZar || 0) * 100} cents
            </p>
          </div>
        ))}
      </div>

      <div className="gls-admin-card mt-8 rounded-xl p-5 text-sm text-gls-muted">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
          Launch workflow
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
          <li>Member chooses a plan and receives a permanent member reference.</li>
          <li>A unique payment reference is created for that renewal.</li>
          <li>They pay with PayFast or EFT and submit for verification when needed.</li>
          <li>Admin verifies the provider statement and activates 30 days.</li>
          <li>The system issues a numbered non-VAT payment receipt.</li>
        </ol>
      </div>
    </div>
  );
}
