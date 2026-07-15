"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SystemLink = {
  id: string;
  title: string;
  url: string;
  placement: "nav" | "footer";
  is_active: boolean;
};

export function ManagedSystemLinks({
  placement,
}: {
  placement: SystemLink["placement"];
}) {
  const [links, setLinks] = useState<SystemLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/system-links", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        if (!cancelled) {
          setLinks(
            (data.links || []).filter(
              (link: SystemLink) =>
                link.placement === placement && link.is_active === true,
            ),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!links.length) return null;
  return (
    <div
      className={
        placement === "nav"
          ? "hidden items-center gap-3 lg:flex"
          : "flex flex-wrap justify-center gap-x-5 gap-y-2"
      }
      aria-label={`${placement} managed links`}
    >
      {links.map((link) =>
        link.url.startsWith("/") ? (
          <Link
            key={link.id}
            href={link.url}
            className="text-sm text-gls-muted transition hover:text-white"
          >
            {link.title}
          </Link>
        ) : (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gls-muted transition hover:text-white"
          >
            {link.title}
          </a>
        ),
      )}
    </div>
  );
}
