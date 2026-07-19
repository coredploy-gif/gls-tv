"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContentRow } from "@/components/ContentRow";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  adminMediaLinkToCatalog,
  userMediaLinkToCatalog,
  type AdminMediaLink,
  type UserMediaLink,
} from "@/lib/media-links";
import type { CatalogItem } from "@/data/types";

const HOME_LINKS_LIMIT = 10;

function mediaLinkHref(item: CatalogItem): string {
  if (item.id.startsWith("staff-")) {
    return `/library/featured/${item.id.replace(/^staff-/, "")}`;
  }
  return `/library/watch/${item.id.replace(/^media-/, "")}`;
}

export function MyLinksHomeRow() {
  const { user, loading } = useAuth();
  const [staffItems, setStaffItems] = useState<CatalogItem[]>([]);
  const [savedItems, setSavedItems] = useState<CatalogItem[]>([]);
  const [emptySaved, setEmptySaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      queueMicrotask(() => {
        setStaffItems([]);
        setSavedItems([]);
        setEmptySaved(false);
        setReady(true);
      });
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const [featuredRes, savedRes] = await Promise.all([
          fetch("/api/media-links/featured", { cache: "no-store" }),
          fetch("/api/media-links", { cache: "no-store" }),
        ]);
        const [featuredData, savedData] = await Promise.all([
          featuredRes.json(),
          savedRes.json(),
        ]);
        if (cancelled) return;
        const featured = featuredRes.ok
          ? ((featuredData.links || []) as AdminMediaLink[])
          : [];
        const saved = savedRes.ok
          ? ((savedData.links || []) as UserMediaLink[])
          : [];
        setStaffItems(featured.map(adminMediaLinkToCatalog));
        setSavedItems(saved.map(userMediaLinkToCatalog));
        setEmptySaved(saved.length === 0);
      } catch {
        if (!cancelled) {
          setStaffItems([]);
          setSavedItems([]);
          setEmptySaved(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading || (user && !ready)) return null;

  if (!user) {
    return (
      <section className="mb-8 px-4 sm:mb-10 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-sm border border-white/15 bg-gradient-to-r from-gls-red/25 via-white/[0.04] to-transparent p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
            Personal collection
          </p>
          <h2 className="gls-display mt-2 text-3xl text-white sm:text-4xl">
            Save your links
          </h2>
          <p className="mt-2 max-w-xl text-sm text-gls-body">
            Browse Staff picks and add HLS, YouTube, Vimeo, or video links — they
            show here on Home.
          </p>
          <Link
            href="/library"
            className="gls-cta mt-4 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
          >
            Open My Links
          </Link>
        </div>
      </section>
    );
  }

  const hasStaff = staffItems.length > 0;
  const hasSaved = savedItems.length > 0;

  if (!hasStaff && emptySaved) {
    return (
      <section className="mb-8 px-4 sm:mb-10 sm:px-8 lg:px-12">
        <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">My Links is empty</h2>
          <p className="mt-1 text-sm text-gls-muted">
            Add a media link — Staff picks and your titles show here on Home.
          </p>
          <Link
            href="/library?add=1"
            className="mt-3 inline-block text-sm font-medium text-white underline-offset-2 hover:underline"
          >
            Add a link →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      {hasStaff && (
        <ContentRow
          title="Staff picks"
          items={staffItems}
          limit={HOME_LINKS_LIMIT}
          viewMoreHref="/library"
          viewMoreLabel="More ›"
          alwaysShowViewMore
          hrefForItem={mediaLinkHref}
        />
      )}
      {hasSaved ? (
        <ContentRow
          title="My Links"
          items={savedItems}
          limit={HOME_LINKS_LIMIT}
          viewMoreHref="/library/saved"
          viewMoreLabel="More ›"
          alwaysShowViewMore
          hrefForItem={mediaLinkHref}
        />
      ) : (
        <section className="mb-8 px-4 sm:mb-10 sm:px-8 lg:px-12">
          <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">
              Your saved links are empty
            </h2>
            <p className="mt-1 text-sm text-gls-muted">
              Add your own media link — it will show here under Staff picks.
            </p>
            <Link
              href="/library?add=1"
              className="mt-3 inline-block text-sm font-medium text-white underline-offset-2 hover:underline"
            >
              Add a link →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
