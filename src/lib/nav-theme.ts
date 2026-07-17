/** Per-hub accents — muted at rest, brighter on hover/active. */
export type NavAccent = {
  href: string;
  label: string;
  /** Soft resting color */
  color: string;
  /** Brighter hover / active */
  bright: string;
  glow: string;
};

export const BROWSE_NAV: NavAccent[] = [
  {
    href: "/browse",
    label: "Home",
    color: "#f0d0d8",
    bright: "#ffffff",
    glow: "rgba(255,255,255,0.35)",
  },
  {
    href: "/search",
    label: "Find",
    color: "#5ec8c0",
    bright: "#9aeee6",
    glow: "rgba(94,200,192,0.45)",
  },
  {
    href: "/playlists",
    label: "My Playlists",
    color: "#ff8ec8",
    bright: "#ffb8dc",
    glow: "rgba(255,142,200,0.4)",
  },
  {
    href: "/library",
    label: "My Links",
    color: "#f0a0ff",
    bright: "#f8d0ff",
    glow: "rgba(240,160,255,0.4)",
  },
  {
    href: "/sports",
    label: "Sports",
    color: "#5ee29a",
    bright: "#9af5c2",
    glow: "rgba(94,226,154,0.4)",
  },
  {
    href: "/kids",
    label: "Kids",
    color: "#ffb4c8",
    bright: "#ffd0dc",
    glow: "rgba(255,180,200,0.45)",
  },
  {
    href: "/games",
    label: "Games",
    color: "#c4b5fd",
    bright: "#ddd6fe",
    glow: "rgba(196,181,253,0.45)",
  },
  {
    href: "/news",
    label: "News",
    color: "#7ec8ff",
    bright: "#b3e0ff",
    glow: "rgba(126,200,255,0.4)",
  },
  {
    href: "/food",
    label: "Food",
    color: "#ffb074",
    bright: "#ffd0a8",
    glow: "rgba(255,176,116,0.4)",
  },
  {
    href: "/radio",
    label: "Radio",
    color: "#ff7078",
    bright: "#ff9aa0",
    glow: "rgba(255,112,120,0.45)",
  },
  {
    href: "/asia",
    label: "Asia",
    color: "#ff7eb6",
    bright: "#ffb0d4",
    glow: "rgba(255,126,182,0.45)",
  },
  {
    href: "/africa",
    label: "Africa",
    color: "#f5c542",
    bright: "#ffe08a",
    glow: "rgba(245,197,66,0.4)",
  },
  {
    href: "/live",
    label: "Live TV",
    color: "#ff5a6a",
    bright: "#ff8a96",
    glow: "rgba(255,90,106,0.5)",
  },
  {
    href: "/movies",
    label: "Movies",
    color: "#a8c4ff",
    bright: "#d0e0ff",
    glow: "rgba(168,196,255,0.4)",
  },
  {
    href: "/series",
    label: "Series",
    color: "#e85a9b",
    bright: "#ff8ec8",
    glow: "rgba(232,90,155,0.45)",
  },
  {
    href: "/my-list",
    label: "My List",
    color: "#ff6b9d",
    bright: "#ff9abc",
    glow: "rgba(255,107,157,0.45)",
  },
];

export const ADMIN_NAV_COLORS: Record<string, string> = {
  "/admin": "#ff6b9d",
  "/admin/ops": "#f5c542",
  "/admin/finance": "#34d399",
  "/admin/finance/membership": "#34d399",
  "/admin/finance/daybook": "#34d399",
  "/admin/finance/ar-aging": "#34d399",
  "/admin/finance/statement": "#34d399",
  "/admin/finance/reconcile": "#34d399",
  "/admin/helpdesk": "#7ec8ff",
  "/admin/inbox": "#9ae6b4",
  "/admin/audit": "#a8c4ff",
  "/admin/knowledge": "#f5c542",
  "/admin/chat": "#ff8ec8",
  "/admin/links": "#ff8ec8",
  "/admin/users": "#a8c4ff",
  "/admin/access": "#c4b5fd",
  "/admin/rights": "#fca5a5",
  "/admin/system": "#ffb074",
};
