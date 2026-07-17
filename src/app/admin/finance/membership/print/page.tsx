import { redirect } from "next/navigation";
import { ReceiptPrintButton } from "@/components/ReceiptPrintButton";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";
import {
  MEMBERSHIP_BUCKET_LABELS,
  MEMBERSHIP_METRIC_DEFINITIONS,
} from "@/lib/membership/admin-metrics";
import { loadMembershipOverview } from "@/lib/membership/admin-metrics-query";

export const dynamic = "force-dynamic";

export default async function MembershipOverviewPrintPage() {
  await requireAdmin();
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "finance.read")) {
    redirect("/admin");
  }

  let overview;
  try {
    overview = await loadMembershipOverview();
  } catch {
    redirect("/admin/finance/membership");
  }

  const { summary, byPlan, generatedAt } = overview;
  const conversion =
    summary.allUsers > 0
      ? Math.round((summary.subscribed / summary.allUsers) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-[#07070a] px-6 py-8 text-white print:bg-white print:p-8 print:text-black">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
              GLS TV Admin
            </p>
            <h1 className="gls-display text-3xl text-white">Membership funnel</h1>
          </div>
          <ReceiptPrintButton />
        </div>

        <article className="rounded-xl border border-white/10 bg-[#0d0d12] p-8 print:border-0 print:bg-white print:p-0">
          <header className="border-b border-white/10 pb-6 print:border-black/15">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-gls-red print:text-[#b91c1c]">
              Membership overview
            </p>
            <h2 className="gls-display mt-2 text-4xl text-white print:text-black">
              User funnel summary
            </h2>
            <p className="mt-2 text-sm text-gls-muted print:text-neutral-600">
              Generated{" "}
              {new Date(generatedAt).toLocaleString("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["All users", summary.allUsers, MEMBERSHIP_METRIC_DEFINITIONS.allUsers],
              [
                "Subscribed users",
                summary.subscribed,
                MEMBERSHIP_METRIC_DEFINITIONS.subscribed,
              ],
              [
                "On 14-day trial",
                summary.trial,
                MEMBERSHIP_METRIC_DEFINITIONS.trial,
              ],
              [
                "Never subscribed",
                summary.neverSubscribed,
                MEMBERSHIP_METRIC_DEFINITIONS.neverSubscribed,
              ],
            ].map(([label, value, definition]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-white/10 p-4 print:border-black/10"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-red print:text-[#b91c1c]">
                  {label}
                </p>
                <p className="gls-display mt-2 text-3xl text-white print:text-black">
                  {value}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gls-muted print:text-neutral-600">
                  {definition}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-4 print:border-black/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
                Paid conversion
              </p>
              <p className="gls-display mt-2 text-2xl text-white print:text-black">
                {conversion}%
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4 print:border-black/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
                Signups (30d)
              </p>
              <p className="gls-display mt-2 text-2xl text-white print:text-black">
                {summary.signups30d}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 p-4 print:border-black/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gls-muted">
                Lapsed
              </p>
              <p className="gls-display mt-2 text-2xl text-white print:text-black">
                {summary.lapsed}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-gold print:text-neutral-700">
              Plan distribution
            </h3>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.18em] text-gls-muted print:border-black/15 print:text-neutral-500">
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byPlan)
                  .sort((a, b) => b[1] - a[1])
                  .map(([plan, count]) => (
                    <tr
                      key={plan}
                      className="border-b border-white/[0.06] print:border-black/10"
                    >
                      <td className="py-2 pr-4 font-mono">{plan}</td>
                      <td className="py-2">{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          <section className="mt-8 print:break-before-page">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink-soft print:text-neutral-700">
              Bucket reference
            </h3>
            <ul className="mt-3 space-y-1 text-xs text-gls-muted print:text-neutral-600">
              {Object.entries(MEMBERSHIP_BUCKET_LABELS).map(([key, label]) => (
                <li key={key}>
                  <span className="font-semibold text-white print:text-black">
                    {label}:
                  </span>{" "}
                  {key === "lapsed"
                    ? MEMBERSHIP_METRIC_DEFINITIONS.lapsed
                    : key === "all"
                      ? MEMBERSHIP_METRIC_DEFINITIONS.allUsers
                      : key === "subscribed"
                        ? MEMBERSHIP_METRIC_DEFINITIONS.subscribed
                        : key === "trial"
                          ? MEMBERSHIP_METRIC_DEFINITIONS.trial
                          : MEMBERSHIP_METRIC_DEFINITIONS.neverSubscribed}
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-10 border-t border-white/10 pt-4 text-[11px] text-gls-muted print:border-black/15 print:text-neutral-500">
            GLS TV · Confidential admin report · finance.read
          </footer>
        </article>
      </div>
    </main>
  );
}
