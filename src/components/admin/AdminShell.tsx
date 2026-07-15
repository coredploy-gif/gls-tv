"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { GlsLogo } from "@/components/GlsLogo";
import { ADMIN_NAV_COLORS } from "@/lib/nav-theme";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

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
    href: "/admin/system",
    label: "System links",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
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

  useEffect(() => {
    try {
      const v = localStorage.getItem("gls-admin-sidebar");
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const toggle = () => {
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

  const activeItem =
    [...NAV]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (n) =>
          pathname === n.href ||
          (n.href !== "/admin" && pathname.startsWith(n.href)),
      ) || NAV[0];
  const pageColor = ADMIN_NAV_COLORS[activeItem.href] || "#ff6b9d";

  return (
    <div className="gls-admin-shell flex min-h-screen text-white">
      <aside
        className={`gls-admin-sidebar sticky top-0 z-30 flex h-screen shrink-0 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          ready ? "" : "opacity-0"
        } ${collapsed ? "w-[84px]" : "w-64"}`}
      >
        <div className="relative overflow-hidden border-b border-white/[0.07] px-3 py-5">
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gls-pink/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-gls-sky/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <GlsLogo size="sm" href="/admin" glass />
            {!collapsed && (
              <div className="min-w-0 animate-[gls-admin-in_0.35s_ease_both]">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
                  Control
                </p>
                <p className="truncate text-sm font-medium text-white">Admin Portal</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-4">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const color = ADMIN_NAV_COLORS[item.href] || "#ff6b9d";
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`group/nav flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition duration-200 ${
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
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/[0.07] p-2 pb-4">
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-gls-muted transition hover:bg-white/[0.04] hover:text-white"
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
            {!collapsed && <span>Collapse</span>}
          </button>
          <Link
            href="/browse"
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
            {!collapsed && <span>Back to GLS TV</span>}
          </Link>
          {!collapsed && email && (
            <p className="truncate px-2.5 pt-1 text-[10px] leading-relaxed text-gls-muted/80">
              Signed in as
              <br />
              <span className="text-gls-body">{email}</span>
            </p>
          )}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.07] bg-[#07070b]/55 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: pageColor,
                boxShadow: `0 0 12px ${pageColor}`,
              }}
              aria-hidden
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
                GLS Admin
              </p>
              <h1 className="text-sm font-semibold tracking-wide text-white">
                {activeItem.label}
              </h1>
            </div>
          </div>
          <Link
            href="/eadmin"
            className="text-xs text-gls-muted transition hover:text-gls-pink-soft"
          >
            Legacy eadmin →
          </Link>
        </header>
        <div key={pathname} className="gls-admin-main p-5 sm:p-8 lg:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
