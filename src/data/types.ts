export type ContentType = "live" | "movie" | "series";

export type LicenseKind =
  | "public_domain"
  | "creative_commons"
  | "fta_public"
  | "open_stream"
  | "rights_managed";

export interface MediaSource {
  url: string;
  quality: string;
  format: "hls" | "mp4" | "dash";
  /** Lower = preferred. Used for failover mirrors. */
  priority?: number;
  label?: string;
}

export interface CatalogItem {
  id: string;
  slug: string;
  title: string;
  type: ContentType;
  description: string;
  year?: number;
  runtime?: string;
  countries: string[];
  categories: string[];
  languages: string[];
  poster: string;
  backdrop: string;
  logoTitle?: string;
  rating?: string;
  license: LicenseKind;
  sources: MediaSource[];
  seasons?: number;
  episodes?: number;
  isLive?: boolean;
  featured?: boolean;
}

export interface CountryMeta {
  code: string;
  name: string;
  flag: string;
}
