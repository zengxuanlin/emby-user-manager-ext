const ASSRT_BASE_URL = "https://api.assrt.net/v1";

interface AssrtLang {
  desc?: string | null;
}

interface AssrtRawFileItem {
  s?: number | null;
  f?: string | null;
  url?: string | null;
}

interface AssrtRawProducer {
  uploader?: string | null;
  verifier?: string | null;
  producer?: string | null;
  source?: string | null;
}

interface AssrtRawSubtitle {
  id?: number | null;
  native_name?: string | null;
  videoname?: string | null;
  revision?: number | null;
  subtype?: string | null;
  upload_time?: string | null;
  vote_score?: number | null;
  release_site?: string | null;
  vote_machine_translate?: number | boolean | null;
  lang?: AssrtLang | null;
  filename?: string | null;
  size?: number | null;
  url?: string | null;
  view_count?: number | null;
  down_count?: number | null;
  title?: string | null;
  filelist?: AssrtRawFileItem[] | null;
  producer?: AssrtRawProducer | null;
}

interface AssrtApiResponse {
  status?: number;
  errmsg?: string;
  sub?: {
    result?: string;
    action?: string;
    subs?: AssrtRawSubtitle[];
  };
  user?: {
    result?: string;
    action?: string;
    quota?: number | null;
  };
}

export interface AssrtSubtitleSearchItem {
  id: number;
  nativeName: string;
  videoName: string | null;
  revision: number;
  subtype: string | null;
  uploadTime: string | null;
  voteScore: number | null;
  releaseSite: string | null;
  languageDesc: string | null;
  isMachineTranslated: boolean;
}

export interface AssrtSubtitleDetail extends AssrtSubtitleSearchItem {
  filename: string | null;
  size: number | null;
  downloadUrl: string | null;
  viewCount: number | null;
  downCount: number | null;
  title: string | null;
  files: Array<{
    name: string | null;
    size: number | null;
    downloadUrl: string | null;
  }>;
  producer: {
    uploader: string | null;
    verifier: string | null;
    producer: string | null;
    source: string | null;
  } | null;
}

function normalizeSubtitleItem(item: AssrtRawSubtitle): AssrtSubtitleSearchItem | null {
  const id = Number(item.id ?? NaN);
  if (!Number.isFinite(id)) {
    return null;
  }
  return {
    id,
    nativeName: item.native_name?.trim() || `字幕 #${id}`,
    videoName: item.videoname?.trim() || null,
    revision: Number(item.revision ?? 0) || 0,
    subtype: item.subtype?.trim() || null,
    uploadTime: item.upload_time?.trim() || null,
    voteScore: typeof item.vote_score === "number" ? item.vote_score : null,
    releaseSite: item.release_site?.trim() || null,
    languageDesc: item.lang?.desc?.trim() || null,
    isMachineTranslated: Boolean(item.vote_machine_translate),
  };
}

function normalizeSubtitleDetail(item: AssrtRawSubtitle): AssrtSubtitleDetail | null {
  const base = normalizeSubtitleItem(item);
  if (!base) {
    return null;
  }
  return {
    ...base,
    filename: item.filename?.trim() || null,
    size: typeof item.size === "number" ? item.size : null,
    downloadUrl: item.url?.trim() || null,
    viewCount: typeof item.view_count === "number" ? item.view_count : null,
    downCount: typeof item.down_count === "number" ? item.down_count : null,
    title: item.title?.trim() || null,
    files: Array.isArray(item.filelist)
      ? item.filelist.map((file) => ({
          name: file.f?.trim() || null,
          size: typeof file.s === "number" ? file.s : null,
          downloadUrl: file.url?.trim() || null,
        }))
      : [],
    producer: item.producer
      ? {
          uploader: item.producer.uploader?.trim() || null,
          verifier: item.producer.verifier?.trim() || null,
          producer: item.producer.producer?.trim() || null,
          source: item.producer.source?.trim() || null,
        }
      : null,
  };
}

async function parseAssrtResponse(response: Response): Promise<AssrtApiResponse> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as AssrtApiResponse;
  } catch {
    throw new Error(`ASSRT returned a non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function assrtFetch(path: string, token: string, query: Record<string, string>): Promise<AssrtApiResponse> {
  const url = new URL(`${ASSRT_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = await parseAssrtResponse(response);

  if (!response.ok) {
    throw new Error(payload.errmsg || `ASSRT request failed with status ${response.status}`);
  }
  if ((payload.status ?? 0) !== 0) {
    throw new Error(payload.errmsg || `ASSRT API returned status ${payload.status}`);
  }

  return payload;
}

export async function getAssrtQuota(token: string): Promise<number | null> {
  const payload = await assrtFetch("/user/quota", token, {});
  return typeof payload.user?.quota === "number" ? payload.user.quota : null;
}

export async function searchAssrtSubtitles(
  token: string,
  keyword: string,
  count = 10,
  pos = 0,
): Promise<AssrtSubtitleSearchItem[]> {
  const payload = await assrtFetch("/sub/search", token, {
    q: keyword,
    cnt: String(Math.min(Math.max(count, 1), 15)),
    pos: String(Math.max(pos, 0)),
  });

  const rawItems = Array.isArray(payload.sub?.subs) ? payload.sub?.subs : [];
  return rawItems
    .map((item) => normalizeSubtitleItem(item))
    .filter((item): item is AssrtSubtitleSearchItem => Boolean(item));
}

export async function getAssrtSubtitleDetail(
  token: string,
  id: number,
): Promise<AssrtSubtitleDetail | null> {
  const payload = await assrtFetch("/sub/detail", token, {
    id: String(id),
  });
  const detail = payload.sub?.subs?.[0];
  if (!detail) {
    return null;
  }
  return normalizeSubtitleDetail(detail);
}
