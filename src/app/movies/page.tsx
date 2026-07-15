import Link from "next/link";
import { BrowseNav } from "@/components/BrowseNav";
import { TitleCard } from "@/components/TitleCard";
import { ContentRow } from "@/components/ContentRow";
import { getByType } from "@/data/catalog";
import { CURATED_PUBLIC_MOVIES } from "@/data/curated-public-fast";
import { getMovieChannels } from "@/lib/channels";
import {
  discoverMovies,
  getMovieGenres,
  getPopularByGenres,
  hasTmdbKey,
  tmdbBackdrop,
  tmdbPoster,
  type TmdbMovie,
} from "@/lib/tmdb";

function MovieTile({ movie }: { movie: TmdbMovie }) {
  const year = movie.release_date?.slice(0, 4);
  return (
    <a
      href={`https://www.themoviedb.org/movie/${movie.id}`}
      target="_blank"
      rel="noreferrer"
      className="gls-tile group relative block w-[46vw] shrink-0 sm:w-[30vw] md:w-[20vw] lg:w-[15.5vw] xl:w-[13.8vw]"
    >
      <div className="gls-poster-frame relative aspect-[2/3] overflow-hidden rounded-sm bg-gls-elevated shadow-[0_8px_24px_rgba(0,0,0,0.55)] ring-1 ring-white/10 transition duration-300 group-hover:scale-[1.06] group-hover:ring-white/35">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tmdbPoster(movie.poster_path, "w780")}
          srcSet={
            movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path} 500w, https://image.tmdb.org/t/p/w780${movie.poster_path} 780w, https://image.tmdb.org/t/p/original${movie.poster_path} 2160w`
              : undefined
          }
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 22vw, 15vw"
          alt={movie.title}
          className="gls-poster-img h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 opacity-0 transition group-hover:opacity-100">
          <p className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">
            {movie.title}
          </p>
          <p className="text-[10px] text-gls-muted">
            {year}
            {movie.vote_average
              ? ` · ★ ${movie.vote_average.toFixed(1)}`
              : ""}
          </p>
        </div>
      </div>
    </a>
  );
}

export default async function MoviesPage() {
  const seedMovies = [...getByType("movie"), ...CURATED_PUBLIC_MOVIES];
  const movieChannels = getMovieChannels();
  const tmdbReady = hasTmdbKey();

  let popular: TmdbMovie[] = [];
  let genreRows: { genre: string; movies: TmdbMovie[] }[] = [];
  let hero: TmdbMovie | null = null;

  if (tmdbReady) {
    popular = await discoverMovies({ sort_by: "popularity.desc" });
    hero = popular[0] ?? null;
    const genres = await getMovieGenres();
    const priority = [
      "Action",
      "Comedy",
      "Drama",
      "Thriller",
      "Science Fiction",
      "Animation",
      "Horror",
      "Romance",
    ];
    const picked = priority
      .map((name) => genres.find((g) => g.name === name))
      .filter((g): g is { id: number; name: string } => Boolean(g));
    genreRows = await getPopularByGenres(picked.slice(0, 6));
  }

  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-20">
      <BrowseNav />

      {hero && (
        <section className="relative mb-8 h-[48vh] min-h-[320px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tmdbBackdrop(hero.backdrop_path, "original")}
            srcSet={
              hero.backdrop_path
                ? `https://image.tmdb.org/t/p/w1280${hero.backdrop_path} 1280w, https://image.tmdb.org/t/p/original${hero.backdrop_path} 3840w`
                : undefined
            }
            sizes="100vw"
            alt=""
            className="gls-poster-img absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <div className="gls-hero-mask absolute inset-0" />
          <div className="relative z-10 mx-auto flex h-full max-w-[1600px] items-end px-4 pb-12 sm:px-8 lg:px-12">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gls-red">
                Movies · Categorised
              </p>
              <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
                {hero.title}
              </h1>
              <p className="mt-3 line-clamp-3 text-sm text-gls-body">
                {hero.overview}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-12">
        {!hero && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
              Catalog
            </p>
            <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">
              Movies
            </h1>
          </>
        )}

        {!tmdbReady && (
          <div className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            More curated movie collections are coming soon. Enjoy the free-to-watch
            titles and movie channels available below.
          </div>
        )}
      </div>

      {tmdbReady && popular.length > 0 && (
        <section className="mt-6 mb-8">
          <h2 className="mb-3 px-4 text-lg font-semibold text-white sm:px-8 sm:text-xl lg:px-12">
            Popular now
          </h2>
          <div className="gls-row-scroll px-4 sm:px-8 lg:px-12">
            {popular.map((m) => (
              <MovieTile key={m.id} movie={m} />
            ))}
          </div>
        </section>
      )}

      {genreRows.map((row) => (
        <section key={row.genre} className="mb-8">
          <h2 className="mb-3 px-4 text-lg font-semibold text-white sm:px-8 sm:text-xl lg:px-12">
            {row.genre}
          </h2>
          <div className="gls-row-scroll px-4 sm:px-8 lg:px-12">
            {row.movies.map((m) => (
              <MovieTile key={m.id} movie={m} />
            ))}
          </div>
        </section>
      ))}

      <ContentRow
        title="Movie channels · live & FAST"
        items={movieChannels}
        limit={12}
        viewMoreHref="/movies/more"
      />

      <section className="mt-4 px-4 sm:px-8 lg:px-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Watch on GLS · Public domain & CC
          </h2>
          <Link href="/browse" className="text-sm text-gls-muted hover:text-white">
            Home
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {seedMovies.map((item) => (
            <div key={item.id} className="w-full [&_a]:w-full">
              <TitleCard item={item} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
