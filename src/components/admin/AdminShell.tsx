"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GlsLogo } from "@/components/GlsLogo";
import { ADMIN_NAV_COLORS } from "@/lib/nav-theme";

type NavChild = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  children?: NavChild[];
};

const FINANCE_NAV: NavChild[] = [
  { href: "/admin/finance/membership", label: "Membership" },
  { href: "/admin/finance/daybook", label: "Daybook" },
  { href: "/admin/finance/ar-aging", label: "AR aging" },
  { href: "/admin/finance/statement", label: "Statement" },
  { href: "/admin/finance/reconcile", label: "Reconcile" },
];

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: (
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/ops",
    label: "Daily ops",
    icon: (
      <path
        d="M4 6h16M4 12h10M4 18h14M16 10l3 3-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/finance",
    label: "Finance",
    children: FINANCE_NAV,
    icon: (
      <>
        <rect
          x="4"
          y="6"
          width="16"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M4 10h16M12 10v8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    href: "/admin/helpdesk",
    label: "Helpdesk",
    icon: (
      <path
        d="M5 7h14v11H5V7Zm0 4h14M9 7V5h6v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/admin/inbox",
    label: "Inbox",
    icon: (
      <path
        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/audit",
    label: "Audit",
    icon: (
      <path
        d="M8 6h10v14H8V6Zm0 4h10M8 14h6M5 8v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/admin/knowledge",
    label: "Knowledge",
    icon: (
      <path
        d="M6 5h9a3 3 0 0 1 3 3v11H9a3 3 0 0 0-3 3V5Zm0 0v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/content",
    label: "App copy",
    icon: (
      <path
        d="M5 6h14v4H5V6Zm0 8h9v4H5v-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/chat",
    label: "Live chat",
    icon: (
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 3.5V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/links",
    label: "Links & streams",
    icon: (
      <path
        d="M10 14a4 4 0 0 0 5.66.1l2.12-2.12a4 4 0 0 0-5.66-5.66L11 7.4M14 10a4 4 0 0 0-5.66-.1L6.22 12a4 4 0 1 0 5.66 5.66L13 16.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <path
        d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 0v1m15 1v-.5a2.5 2.5 0 0 0-2-2.45M12 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm6.5-1.5a2.5 2.5 0 1 0-2.5-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/admin/access",
    label: "Roles & controls",
    icon: (
      <path
        d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Zm0 5v5m0 3h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/admin/rights",
    label: "Source rights",
    icon: (
      <path
        d="M7 4h10v16H7V4Zm3 4h4m-4 4h4m-4 4h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/admin/system",
    label: "System links",
    icon: (
      <>
        <circle
          cx="12"
          cy="12"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M12 5v2m0 10v2m7-7h-2M7 12H5m12.02-5.02-1.4 1.4M8.38 15.62l-1.4 1.4m0-10.04 1.4 1.4m7.24 7.24 1.4 1.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
];

function NavIcon({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition duration-200 group-hover/nav:brightness-125"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

function navChildActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveNav(pathname: string): { href: string; label: string } {
  const finance = NAV.find((n) => n.href === "/admin/finance");
  if (finance?.children) {
    const child = [...finance.children]
      .sort((a, b) => b.href.length - a.href.length)
      .find((c) => navChildActive(pathname, c.href));
    if (child) return child;
  }

  const match = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (n) =>
        pathname === n.href ||
        (n.href !== "/admin" && pathname.startsWith(n.href)),
    );
  return match || NAV[0];
}

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const financeExpanded = pathname.startsWith("/admin/finance");

  return (
    <>
      {NAV.map((item) => {
        const childActive = item.children?.some((c) =>
          navChildActive(pathname, c.href),
        );
        const active =
          pathname === item.href ||
          childActive ||
          (!item.children &&
            item.href !== "/admin" &&
            pathname.startsWith(item.href));
        const color = ADMIN_NAV_COLORS[item.href] || "#ff6b9d";
        const showChildren =
          !collapsed && item.children && item.children.length > 0 && financeExpanded;

        return (
          <div key={item.href} className="space-y-0.5">
            <Link
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={`group/nav flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition duration-200 ${
                active
                  ? "gls-admin-nav-active"
                  : "text-gls-muted hover:bg-white/[0.04] hover:text-white"
              }`}
              style={
                {
                  ["--nav-icon"]: color,
                } as CSSProperties
              }
            >
              <NavIcon color={color}>{item.icon}</NavIcon>
              {!collapsed && (
                <span className="truncate font-medium">{item.label}</span>
              )}
            </Link>
            {showChildren && (
              <div className="ml-3 space-y-0.5 border-l border-white/[0.08] pl-2">
                {item.children!.map((child) => {
                  const childIsActive = navChildActive(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      title={child.label}
                      onClick={onNavigate}
                      className={`block rounded-lg px-2.5 py-2 text-xs transition duration-200 ${
                        childIsActive
                          ? "bg-white/[0.08] font-semibold text-white"
                          : "text-gls-muted hover:bg-white/[0.04] hover:text-white"
                      }`}
                      style={
                        childIsActive
                          ? ({
                              boxShadow: `inset 2px 0 0 ${color}`,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function AdminShell({
  children,
  email,
}: {
  children: ReactNode;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("gls-admin-sidebar");
      if (v === "1") queueMicrotask(() => setCollapsed(true));
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setReady(true));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const toggleDesktop = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("gls-admin-sidebar", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const activeItem = resolveActiveNav(pathname);
  const pageColor = ADMIN_NAV_COLORS[activeItem.href] || "#ff6b9d";

  const sidebarBody = (opts: {
    collapsed: boolean;
    showCollapse: boolean;
    onNavigate?: () => void;
  }) => (
    <>
      <div className="relative overflow-hidden border-b border-white/[0.07] px-3 py-4 sm:py-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gls-pink/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-gls-sky/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <GlsLogo size="sm" href="/admin" glass />
            {!opts.collapsed && (
              <div className="min-w-0 animate-[gls-admin-in_0.35s_ease_both]">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
                  Control
                </p>
                <p className="truncate text-sm font-medium text-white">
                  Admin Portal
                </p>
              </div>
            )}
          </div>
          {opts.onNavigate && (
            <button
              type="button"
              onClick={opts.onNavigate}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/70 lg:hidden"
              aria-label="Close menu"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-3">
        <NavLinks
          pathname={pathname}
          collapsed={opts.collapsed}
          onNavigate={opts.onNavigate}
        />
      </nav>

      <div className="space-y-1 border-t border-white/[0.07] p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {opts.showCollapse && (
          <button
            type="button"
            onClick={toggleDesktop}
            className="hidden w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-gls-muted transition hover:bg-white/[0.04] hover:text-white lg:flex"
          >
            <NavIcon color="#8a8494">
              <path
                d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </NavIcon>
            {!opts.collapsed && <span>Collapse</span>}
          </button>
        )}
        <Link
          href="/browse"
          onClick={opts.onNavigate}
          className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-gls-muted transition hover:bg-white/[0.04] hover:text-white"
        >
          <NavIcon color="#7ec8ff">
            <path
              d="M15 18l-6-6 6-6M9 12h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </NavIcon>
          {!opts.collapsed && <span>Back to GLS TV</span>}
        </Link>
        {!opts.collapsed && email && (
          <p className="truncate px-2.5 pt-1 text-[10px] leading-relaxed text-gls-muted/80">
            Signed in as
            <br />
            <span className="text-gls-body">{email}</span>
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="gls-admin-shell flex min-h-screen text-white">
      {/* Desktop sidebar — full width available for content on phones */}
      <aside
        className={`gls-admin-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex ${
          ready ? "" : "opacity-0"
        } ${collapsed ? "w-[84px]" : "w-64"}`}
      >
        {sidebarBody({ collapsed, showCollapse: true })}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="gls-admin-sidebar absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col shadow-2xl">
            {sidebarBody({
              collapsed: false,
              showCollapse: false,
              onNavigate: () => setMobileOpen(false),
            })}
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 max-w-full flex-1 flex-col">
        <header className="sticky top-0 z-20 min-w-0 max-w-full border-b border-white/[0.07] bg-[#07070b]/80 backdrop-blur-xl">
          <div className="flex h-12 min-w-0 items-center justify-between gap-3 px-3 sm:h-14 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-white lg:hidden"
                aria-label="Open admin menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <span
                className="hidden h-2 w-2 shrink-0 rounded-full sm:block"
                style={{
                  background: pageColor,
                  boxShadow: `0 0 12px ${pageColor}`,
                }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
                  GLS Admin
                </p>
                <h1 className="truncate text-sm font-semibold tracking-wide text-white">
                  {activeItem.label}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/browse"
                className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-gls-muted transition hover:text-white lg:hidden"
              >
                App
              </Link>
              <Link
                href="/eadmin"
                className="hidden text-xs text-gls-muted transition hover:text-gls-pink-soft sm:inline"
              >
                Legacy eadmin →
              </Link>
            </div>
          </div>

          {/* Quick jump chips — swipeable on small screens; full nav stays in hamburger */}
          <nav
            aria-label="Admin sections"
            className="gls-h-scroll gls-h-scroll-row gls-h-scroll-fade px-3 pb-2.5 lg:hidden"
          >
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const color = ADMIN_NAV_COLORS[item.href] || "#ff6b9d";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-transparent text-white"
                      : "border-white/15 text-white/65"
                  }`}
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, ${color} 35%, #121018)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 50%, transparent)`,
                        }
                      : undefined
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div
          key={pathname}
          className="gls-admin-main px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-10 lg:py-8"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
