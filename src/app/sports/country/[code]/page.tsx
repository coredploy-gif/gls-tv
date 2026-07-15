import Link from "next/link";
import { notFound } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { TitleCard } from "@/components/TitleCard";
import { COUNTRIES, getCountry } from "@/data/catalog";
import { getSportsChannels } from "@/lib/channels";

type Props = { params: Promise<{ code: string }> };

export default async function SportsCountryPage({ params }: Props) {
  const { code } = await params;
  const country = getCountry(code) ?? {
    code,
    name: code.toUpperCase(),
    flag: "🌍",
  };
  const channels = getSportsChannels().filter((c) =>
    c.countries.includes(code.toLowerCase()),
  );
  if (!channels.length) notFound();

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <Link
          href="/sports"
          className="text-sm text-gls-muted transition hover:text-white"
        >
          ← Sports hub
        </Link>
        <h1 className="gls-display mt-4 text-5xl text-white">
          {country.flag} {country.name} Sports
        </h1>
        <p className="mt-2 text-gls-muted">{channels.length} channels</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {COUNTRIES.filter((c) =>
            getSportsChannels().some((ch) => ch.countries.includes(c.code)),
          ).map((c) => (
            <Link
              key={c.code}
              href={`/sports/country/${c.code}`}
              className={`rounded border px-3 py-1.5 text-xs ${
                c.code === code
                  ? "border-gls-red bg-gls-red/20 text-white"
                  : "border-white/15 text-gls-body hover:border-white/40"
              }`}
            >
              {c.flag} {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {channels.map((item) => (
            <div key={item.id} className="w-full [&_a]:w-full">
              <TitleCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
