const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
};

export type TmdbGenre = { id: number; name: string };

function apiKey() {
  return process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
}

export function hasTmdbKey() {
  return Boolean(apiKey());
}

export function tmdbPoster(
  path: string | null,
  size: "w342" | "w500" | "w780" | "original" = "w780",
) {
  if (!path) {
    return "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&h=1800&q=90";
  }
  return `${IMG}/${size}${path}`;
}

export function tmdbBackdrop(
  path: string | null,
  size: "w780" | "w1280" | "original" = "original",
) {
  if (!path) {
    return "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2560&h=1440&q=90";
  }
  return `${IMG}/${size}${path}`;
}

async function tmdbFetch<T>(path: string, query: Record<string, string> = {}): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getMovieGenres() {
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list");
  return data?.genres ?? [];
}

export async function discoverMovies(params: {
  sort_by?: string;
  with_genres?: string;
  page?: number;
} = {}) {
  const data = await tmdbFetch<{ results: TmdbMovie[] }>("/discover/movie", {
    sort_by: params.sort_by ?? "popularity.desc",
    include_adult: "false",
    language: "en-US",
    page: String(params.page ?? 1),
    ...(params.with_genres ? { with_genres: params.with_genres } : {}),
  });
  return data?.results ?? [];
}

export async function getPopularByGenres(genreIds: { id: number; name: string }[]) {
  const rows: { genre: string; movies: TmdbMovie[] }[] = [];
  for (const g of genreIds) {
    const movies = await discoverMovies({ with_genres: String(g.id) });
    if (movies.length) rows.push({ genre: g.name, movies });
  }
  return rows;
}
