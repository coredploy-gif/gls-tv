"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { GlsLogo } from "./GlsLogo";
import { ProfileAvatarMenu } from "@/components/ProfileAvatarMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { BROWSE_NAV } from "@/lib/nav-theme";
import { ManagedSystemLinks } from "@/components/ManagedSystemLinks";

function NavLink({
  href,
  label,
  color,
  bright,
  glow,
  active,
  className = "",
}: {
  href: string;
  label: string;
  color: string;
  bright: string;
  glow: string;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`gls-nav-link whitespace-nowrap text-sm ${
        active ? "is-active" : ""
      } ${className}`}
      style={
        {
          ["--nav-color"]: color,
          ["--nav-bright"]: bright,
          ["--nav-glow"]: glow,
        } as CSSProperties
      }
    >
      {label}
    </Link>
  );
}

export function BrowseNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-white/[0.06] bg-[#07070b]/80 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          : "gls-nav-blur"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:h-[68px] sm:gap-6 sm:px-8 lg:px-12">
        <GlsLogo size="sm" href="/browse" glass />
        <nav className="hidden items-center gap-3.5 lg:flex xl:gap-4.5">
          {BROWSE_NAV.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/browse" && pathname.startsWith(link.href));
            return (
              <NavLink
                key={link.href}
                {...link}
                active={active}
              />
            );
          })}
        </nav>
        <ManagedSystemLinks placement="nav" />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin portal"
              className="gls-glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 sm:px-3.5"
              style={{
                boxShadow: "0 0 20px rgba(255,107,157,0.2)",
              }}
            >
              <span className="gls-admin-live-dot" aria-hidden />
              <span className="bg-gradient-to-r from-white to-gls-pink-soft bg-clip-text text-transparent">
                <span className="sm:hidden" aria-hidden>A</span>
                <span className="hidden sm:inline">Admin</span>
              </span>
            </Link>
          )}
          <Link
            href="/playlists"
            className="gls-glass hidden rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-gls-violet transition hover:text-white hover:brightness-125 focus-visible:text-white sm:inline-flex"
          >
            + M3U
          </Link>
          <Link
            href="/search"
            className="rounded-full p-2 text-gls-teal transition hover:bg-gls-teal/15 hover:text-[#9aeee6] focus-visible:bg-gls-teal/15 focus-visible:text-[#9aeee6]"
            aria-label="Search"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M20 20l-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
          <NotificationBell />
          <ProfileAvatarMenu />
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto px-4 pb-3 lg:hidden" aria-label="Browse categories">
        {BROWSE_NAV.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/browse" && pathname.startsWith(link.href));
          return (
            <NavLink
              key={link.href}
              {...link}
              active={active}
              className="shrink-0 text-xs font-medium"
            />
          );
        })}
      </nav>
    </header>
  );
}
