import Link from "next/link";
import { createServiceClient } from "@/lib/eadmin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminOverviewPage() {
  const sb = createServiceClient();
  let ticketsOpen = 0;
  let kbCount = 0;
  let seeds = 0;
  let pastDue = 0;
  if (sb) {
    const [t, k, s, pd] = await Promise.all([
      sb
        .from("helpdesk_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress", "waiting"]),
      sb
        .from("kb_articles")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      sb
        .from("stream_seeds")
        .select("slug", { count: "exact", head: true })
        .eq("is_active", true),
      sb
        .from("subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "past_due"),
    ]);
    ticketsOpen = t.count || 0;
    kbCount = k.count || 0;
    seeds = s.count || 0;
    pastDue = pd.count || 0;
  }

  const cards = [
    {
      href: "/admin/ops",
      title: "Daily ops",
      value: "Run",
      hint: "Checklist & queues",
      accent: "from-amber-500/25",
    },
    {
      href: "/admin/finance",
      title: "Finance",
      value: pastDue ? String(pastDue) : "ZAR",
      hint: pastDue ? "Past due to chase" : "Billing & plans",
      accent: "from-emerald-500/25",
    },
    {
      href: "/admin/helpdesk",
      title: "Helpdesk",
      value: String(ticketsOpen),
      hint: "Open & waiting",
      accent: "from-gls-red/30",
    },
    {
      href: "/admin/links",
      title: "Streams",
      value: String(seeds),
      hint: "Active HLS seeds",
      accent: "from-rose-500/20",
    },
  ];

  const quick = [
    { href: "/admin/ops", label: "Start daily ops", desc: "Tickets, payments, streams" },
    { href: "/admin/finance/payments", label: "Payment queue", desc: "Yoco / EFT verification" },
    { href: "/admin/finance/reminders", label: "Send reminders", desc: "In-app trial & billing nudges" },
    { href: "/admin/audit", label: "Audit trail", desc: "Who changed what" },
    { href: "/admin/finance/members", label: "Member ledger", desc: "References & reactivation" },
    { href: "/admin/knowledge", label: "Knowledge", desc: `${kbCount} published articles` },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Mission control"
        title="Overview"
        description="Daily run first — then finance, support, audits, streams, and members."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Link
            key={c.href}
            href={c.href}
            className="gls-admin-card group rounded-lg p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${c.accent} to-transparent blur-2xl transition group-hover:opacity-100`}
            />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
              {c.title}
            </p>
            <p className="gls-display relative mt-4 text-5xl text-white">
              {c.value}
            </p>
            <p className="relative mt-2 text-xs text-gls-muted">{c.hint}</p>
            <p className="relative mt-4 text-[11px] font-semibold text-white/50 transition group-hover:text-gls-red">
              Open →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-3">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="gls-admin-card flex items-center justify-between gap-4 rounded-lg px-5 py-4"
          >
            <div>
              <p className="font-semibold text-white">{q.label}</p>
              <p className="mt-0.5 text-xs text-gls-muted">{q.desc}</p>
            </div>
            <span className="text-gls-red">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
