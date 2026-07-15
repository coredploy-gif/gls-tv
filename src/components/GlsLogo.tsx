import Link from "next/link";

type GlsLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  href?: string | null;
  shimmer?: boolean;
  /** Soft glass capsule — premium mark */
  glass?: boolean;
};

const sizes = {
  sm: "text-2xl tracking-[0.12em]",
  md: "text-3xl tracking-[0.14em]",
  lg: "text-5xl tracking-[0.16em]",
  hero: "text-7xl sm:text-8xl md:text-9xl tracking-[0.14em]",
};

const capsulePad = {
  sm: "px-2.5 py-1",
  md: "px-3 py-1.5",
  lg: "px-4 py-2",
  hero: "px-5 py-2.5",
};

export function GlsLogo({
  size = "md",
  href = "/",
  shimmer = false,
  glass = false,
}: GlsLogoProps) {
  const mark = (
    <span
      className={`gls-display gls-logo-mark relative inline-flex items-baseline gap-1 ${sizes[size]} ${
        glass ? `${capsulePad[size]} gls-glass gls-logo-glass rounded-md` : ""
      } ${shimmer ? "gls-logo-shimmer" : ""}`}
      aria-label="GLS TV"
    >
      {glass && !shimmer && <span className="gls-logo-sheen" aria-hidden />}
      <span
        className={`relative ${
          shimmer
            ? ""
            : "bg-gradient-to-b from-white via-[#fff5f8] to-[#ffd0e0] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]"
        }`}
      >
        GLS
      </span>
      <span
        className={`relative font-sans font-bold tracking-[0.28em] ${
          size === "hero" || size === "lg" ? "text-[0.42em]" : "text-[0.45em]"
        } ${
          shimmer
            ? "text-gls-pink"
            : "bg-gradient-to-r from-gls-red via-gls-rose to-gls-pink-soft bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(255,107,157,0.55)]"
        }`}
      >
        TV
      </span>
    </span>
  );

  if (href === null) return mark;
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 outline-none transition duration-200 hover:brightness-110"
    >
      {mark}
    </Link>
  );
}
