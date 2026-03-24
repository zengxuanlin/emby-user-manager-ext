import { config } from "./config.js";

type TmdbMediaType = "movie" | "tv";

interface TmdbSearchItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
}

interface TmdbSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbSearchItem[];
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbDetailResponse {
  id?: number;
  imdb_id?: string | null;
  genres?: TmdbGenre[];
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  tagline?: string | null;
}

const EMPTY_DETAIL: TmdbDetailResponse = {
  genres: [],
  runtime: null,
  number_of_seasons: null,
  number_of_episodes: null,
  status: null,
  tagline: null,
  imdb_id: null,
};

interface TmdbConfigurationResponse {
  images?: {
    secure_base_url?: string;
    base_url?: string;
  };
}

export interface TmdbSearchResultItem {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  voteCount: number | null;
  popularity: number | null;
  language: string | null;
  genres: string[];
  runtime: number | null;
  seasonCount: number | null;
  episodeCount: number | null;
  status: string | null;
  tagline: string | null;
  imdbId: string | null;
}

function ensureConfigured(): { baseUrl: string; apiKey: string } {
  if (!config.tmdbBaseUrl || !config.tmdbApiKey) {
    throw new Error("TMDB is not configured");
  }
  return {
    baseUrl: config.tmdbBaseUrl,
    apiKey: config.tmdbApiKey,
  };
}

function buildBaseUrlCandidates(baseUrl: string): string[] {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const candidates = [trimmed];

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname.endsWith("/3")) {
      parsed.pathname = pathname ? `${pathname}/3` : "/3";
      candidates.push(parsed.toString().replace(/\/+$/, ""));
    }
  } catch {
    if (!trimmed.endsWith("/3")) {
      candidates.push(`${trimmed}/3`);
    }
  }

  return [...new Set(candidates)];
}

function asMediaType(value: string | undefined): TmdbMediaType | null {
  if (value === "movie" || value === "tv") {
    return value;
  }
  return null;
}

async function tmdbFetch(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, apiKey } = ensureConfigured();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const candidates = buildBaseUrlCandidates(baseUrl);

  let lastResponse: Response | null = null;
  for (const candidate of candidates) {
    const url = new URL(`${candidate}${normalized}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "zh-CN");

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (response.ok || response.status !== 404) {
      return response;
    }
    lastResponse = response;
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error("TMDB request failed before receiving a response");
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  return `status=${response.status} body=${text.slice(0, 400)}`;
}

let imageBaseUrlCache: string | null = null;

async function getImageBaseUrl(): Promise<string> {
  if (imageBaseUrlCache) {
    return imageBaseUrlCache;
  }

  const response = await tmdbFetch("/configuration");
  if (!response.ok) {
    throw new Error(`TMDB configuration failed: ${await parseError(response)}`);
  }

  const data = (await response.json()) as TmdbConfigurationResponse;
  imageBaseUrlCache =
    data.images?.secure_base_url ??
    data.images?.base_url ??
    "https://image.tmdb.org/t/p/";
  return imageBaseUrlCache;
}

function buildImageUrl(baseUrl: string, path: string | null | undefined, size: string): string | null {
  if (!path) {
    return null;
  }
  return `${baseUrl}${size}${path}`;
}

async function getDetail(mediaType: TmdbMediaType, id: number): Promise<TmdbDetailResponse> {
  const response = await tmdbFetch(`/${mediaType}/${id}`);
  if (!response.ok) {
    throw new Error(`TMDB detail query failed: ${await parseError(response)}`);
  }
  return (await response.json()) as TmdbDetailResponse;
}

export function isTmdbConfigured(): boolean {
  return Boolean(config.tmdbBaseUrl && config.tmdbApiKey);
}

export async function searchTmdbByKeyword(
  keyword: string,
  page: number,
): Promise<{
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbSearchResultItem[];
}> {
  const searchUrl = new URL("http://tmdb.local/search/multi");
  searchUrl.searchParams.set("query", keyword);
  searchUrl.searchParams.set("page", String(page));
  searchUrl.searchParams.set("include_adult", "false");

  const searchResponse = await tmdbFetch(
    `${searchUrl.pathname}?${searchUrl.searchParams.toString()}`,
  );

  if (!searchResponse.ok) {
    throw new Error(`TMDB search failed: ${await parseError(searchResponse)}`);
  }

  const data = (await searchResponse.json()) as TmdbSearchResponse;
  const imageBaseUrl = await getImageBaseUrl();
  const normalized = data.results
    .map((item) => {
      const mediaType = asMediaType(item.media_type);
      if (!mediaType) {
        return null;
      }
      return { item, mediaType };
    })
    .filter((item): item is { item: TmdbSearchItem; mediaType: TmdbMediaType } => Boolean(item));

  const details = await Promise.all(
    normalized.map(async ({ item, mediaType }) => ({
      item,
      mediaType,
      detail: await getDetail(mediaType, item.id).catch(() => EMPTY_DETAIL),
    })),
  );

  return {
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
    results: details.map(({ item, mediaType, detail }) => ({
      id: item.id,
      mediaType,
      title: item.title ?? item.name ?? `TMDB #${item.id}`,
      originalTitle: item.original_title ?? item.original_name ?? null,
      overview: item.overview ?? null,
      posterUrl: buildImageUrl(imageBaseUrl, item.poster_path, "w342"),
      backdropUrl: buildImageUrl(imageBaseUrl, item.backdrop_path, "w780"),
      releaseDate: item.release_date ?? item.first_air_date ?? null,
      rating: typeof item.vote_average === "number" ? item.vote_average : null,
      voteCount: typeof item.vote_count === "number" ? item.vote_count : null,
      popularity: typeof item.popularity === "number" ? item.popularity : null,
      language: item.original_language ?? null,
      genres: detail.genres?.map((genre) => genre.name) ?? [],
      runtime: detail.runtime ?? null,
      seasonCount: detail.number_of_seasons ?? null,
      episodeCount: detail.number_of_episodes ?? null,
      status: detail.status ?? null,
      tagline: detail.tagline ?? null,
      imdbId: detail.imdb_id ?? null,
    })),
  };
}
