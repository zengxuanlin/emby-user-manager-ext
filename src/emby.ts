import { prisma } from "./db.js";
import { config } from "./config.js";

interface EmbyServerInfo {
  ServerName?: string;
  Version?: string;
  Id?: string;
  OperatingSystemDisplayName?: string;
}

interface EmbyUserDetail {
  Id: string;
  Name: string;
  Policy?: Record<string, unknown> & {
    SimultaneousStreamLimit?: number;
  };
}

interface EmbyUserListItem {
  Id: string;
  Name: string;
  DateCreated?: string;
  Policy?: {
    IsDisabled?: boolean;
  };
}

interface EmbySessionItem {
  Id?: string;
  UserId?: string;
  UserName?: string;
  DeviceName?: string;
  Client?: string;
  LastActivityDate?: string;
  NowPlayingItem?: {
    Id?: string;
    SeriesId?: string;
    Name?: string;
    SeriesName?: string;
    Type?: string;
    ParentIndexNumber?: number;
    IndexNumber?: number;
    RunTimeTicks?: number;
  };
  PlayState?: {
    IsPaused?: boolean;
    PositionTicks?: number;
  };
}

interface EmbyItemDto {
  Id?: string;
  Name?: string;
  Type?: string;
  DateCreated?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  Overview?: string;
  CommunityRating?: number;
  RunTimeTicks?: number;
  UserData?: {
    PlayCount?: number;
    LastPlayedDate?: string;
  };
}

interface EmbyItemsResponse {
  Items?: EmbyItemDto[];
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${config.embyBaseUrl}${normalized}`);
  url.searchParams.set("api_key", config.embyApiKey);
  return url.toString();
}

async function embyFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Token": config.embyApiKey,
      ...(init?.headers ?? {}),
    },
  });
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  return `status=${response.status} body=${text.slice(0, 400)}`;
}

export async function testEmbyConnection(): Promise<{
  ok: boolean;
  serverName: string | null;
  version: string | null;
  serverId: string | null;
}> {
  const response = await embyFetch("/System/Info");
  if (!response.ok) {
    throw new Error(`Emby connection failed: ${await parseError(response)}`);
  }
  const info = (await response.json()) as EmbyServerInfo;
  return {
    ok: true,
    serverName: info.ServerName ?? null,
    version: info.Version ?? null,
    serverId: info.Id ?? null,
  };
}

export interface EmbyUserSummary {
  embyUserId: string;
  embyUsername: string;
  embyDisabled: boolean;
  embyCreatedAt: string | null;
}

export interface EmbyRealtimeActivity {
  sessionId: string;
  userName: string | null;
  userId: string | null;
  deviceName: string | null;
  client: string | null;
  itemName: string | null;
  itemType: string | null;
  playbackState: "PLAYING" | "PAUSED" | "IDLE";
  positionTicks: number | null;
  runtimeTicks: number | null;
  lastActivityAt: string | null;
  itemId: string | null;
  primaryImageItemId: string | null;
}

export interface EmbyStatsItem {
  itemId: string;
  name: string;
  type: string | null;
  overview: string | null;
  dateCreated: string | null;
  premiereDate: string | null;
  productionYear: number | null;
  communityRating: number | null;
  runtimeTicks: number | null;
  playCount: number | null;
  lastPlayedDate: string | null;
  primaryImageItemId: string | null;
}

export async function listEmbyUsers(): Promise<EmbyUserSummary[]> {
  const response = await embyFetch("/Users");
  if (!response.ok) {
    throw new Error(`Emby users query failed: ${await parseError(response)}`);
  }
  const items = (await response.json()) as EmbyUserListItem[];
  return items.map((item) => ({
    embyUserId: item.Id,
    embyUsername: item.Name,
    embyDisabled: Boolean(item.Policy?.IsDisabled),
    embyCreatedAt: item.DateCreated ?? null,
  }));
}

export async function listEmbyRealtimeActivities(): Promise<EmbyRealtimeActivity[]> {
  const response = await embyFetch("/Sessions");
  if (!response.ok) {
    throw new Error(`Emby sessions query failed: ${await parseError(response)}`);
  }
  const sessions = (await response.json()) as EmbySessionItem[];

  return sessions.map((session) => {
    const nowPlaying = session.NowPlayingItem;
    const itemName = nowPlaying?.SeriesName
      ? `${nowPlaying.SeriesName} - ${nowPlaying.Name ?? ""}`.trim()
      : (nowPlaying?.Name ?? null);
    const playbackState: "PLAYING" | "PAUSED" | "IDLE" = nowPlaying
      ? session.PlayState?.IsPaused
        ? "PAUSED"
        : "PLAYING"
      : "IDLE";

    return {
      sessionId: session.Id ?? "",
      userName: session.UserName ?? null,
      userId: session.UserId ?? null,
      deviceName: session.DeviceName ?? null,
      client: session.Client ?? null,
      itemName,
      itemType: nowPlaying?.Type ?? null,
      playbackState,
      positionTicks: typeof session.PlayState?.PositionTicks === "number"
        ? session.PlayState.PositionTicks
        : null,
      runtimeTicks: typeof nowPlaying?.RunTimeTicks === "number" ? nowPlaying.RunTimeTicks : null,
      lastActivityAt: session.LastActivityDate ?? null,
      itemId: nowPlaying?.Id ?? null,
      primaryImageItemId: nowPlaying?.SeriesId ?? nowPlaying?.Id ?? null,
    };
  });
}

function toStatsItem(item: EmbyItemDto): EmbyStatsItem | null {
  if (!item.Id || !item.Name) {
    return null;
  }
  return {
    itemId: item.Id,
    name: item.Name,
    type: item.Type ?? null,
    overview: item.Overview ?? null,
    dateCreated: item.DateCreated ?? null,
    premiereDate: item.PremiereDate ?? null,
    productionYear: typeof item.ProductionYear === "number" ? item.ProductionYear : null,
    communityRating: typeof item.CommunityRating === "number" ? item.CommunityRating : null,
    runtimeTicks: typeof item.RunTimeTicks === "number" ? item.RunTimeTicks : null,
    playCount: typeof item.UserData?.PlayCount === "number" ? item.UserData.PlayCount : null,
    lastPlayedDate: item.UserData?.LastPlayedDate ?? null,
    primaryImageItemId: item.Id,
  };
}

async function listEmbyItemsWithParams(params: Record<string, string>): Promise<EmbyStatsItem[]> {
  const search = new URLSearchParams(params);
  const response = await embyFetch(`/Items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Emby items query failed: ${await parseError(response)}`);
  }
  const data = (await response.json()) as EmbyItemsResponse;
  return (data.Items ?? [])
    .map(toStatsItem)
    .filter((item): item is EmbyStatsItem => Boolean(item));
}

export async function getEmbyDashboardStats(limit = 10): Promise<{
  latest: EmbyStatsItem[];
  popular: EmbyStatsItem[];
}> {
  const commonParams = {
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    Fields: "Overview,DateCreated,PremiereDate,ProductionYear,CommunityRating,RunTimeTicks,UserData",
    Limit: String(limit),
    ImageTypeLimit: "1",
    EnableImages: "true",
    EnableUserData: "true",
  };

  const [latestResult, popularResult] = await Promise.allSettled([
    listEmbyItemsWithParams({
      ...commonParams,
      SortBy: "DateCreated",
      SortOrder: "Descending",
    }),
    listEmbyItemsWithParams({
      ...commonParams,
      SortBy: "PlayCount",
      SortOrder: "Descending",
      IsPlayed: "true",
    }),
  ]);

  if (latestResult.status === "rejected") {
    console.warn("[emby] latest stats query failed", latestResult.reason);
  }
  if (popularResult.status === "rejected") {
    console.warn("[emby] popular stats query failed", popularResult.reason);
  }

  return {
    latest: latestResult.status === "fulfilled" ? latestResult.value : [],
    popular: popularResult.status === "fulfilled" ? popularResult.value : [],
  };
}

async function tryCreateEmbyUser(username: string): Promise<EmbyUserDetail> {
  const payloads: Array<{ path: string; init: RequestInit }> = [
    {
      path: `/Users/New?Name=${encodeURIComponent(username)}`,
      init: { method: "POST", body: JSON.stringify({ Name: username }) },
    },
    {
      path: "/Users/New",
      init: { method: "POST", body: JSON.stringify({ Name: username }) },
    },
  ];

  let lastError = "unknown";
  for (const candidate of payloads) {
    const response = await embyFetch(candidate.path, candidate.init);
    if (response.ok) {
      return (await response.json()) as EmbyUserDetail;
    }
    lastError = await parseError(response);
  }
  throw new Error(`Emby create user failed: ${lastError}`);
}

async function setEmbyUserPassword(embyUserId: string, password: string): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    { Id: embyUserId, CurrentPw: "", NewPw: password, ResetPassword: false },
    { CurrentPw: "", NewPw: password, ResetPassword: false },
    { CurrentPw: "", NewPw: password },
    { Id: embyUserId, NewPw: password },
  ];

  let lastError = "unknown";
  for (const payload of payloads) {
    const response = await embyFetch(`/Users/${encodeURIComponent(embyUserId)}/Password`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return;
    }
    lastError = await parseError(response);
  }
  throw new Error(`Emby set password failed: ${lastError}`);
}

export async function updateEmbyUserPassword(
  embyUserId: string,
  password: string,
): Promise<void> {
  await setEmbyUserPassword(embyUserId, password);
}

export async function createEmbyUser(
  username: string,
  password?: string,
): Promise<{ embyUserId: string; embyUsername: string }> {
  const created = await tryCreateEmbyUser(username);
  const user = await getEmbyUser(created.Id);
  const nextPolicy = {
    ...(user.Policy ?? {}),
    SimultaneousStreamLimit: 1,
  };
  await updateEmbyUserPolicy(created.Id, nextPolicy);
  if (password && password.trim()) {
    await setEmbyUserPassword(created.Id, password.trim());
  }
  return {
    embyUserId: created.Id,
    embyUsername: created.Name,
  };
}

export async function deleteEmbyUser(embyUserId: string): Promise<void> {
  const candidates: Array<{ path: string; init: RequestInit }> = [
    { path: `/Users/${encodeURIComponent(embyUserId)}`, init: { method: "DELETE" } },
    { path: `/Users/Delete?Id=${encodeURIComponent(embyUserId)}`, init: { method: "POST" } },
  ];

  let lastError = "unknown";
  for (const candidate of candidates) {
    const response = await embyFetch(candidate.path, candidate.init);
    if (response.ok) {
      return;
    }
    lastError = await parseError(response);
  }
  throw new Error(`Emby delete user failed: ${lastError}`);
}

async function getEmbyUser(embyUserId: string): Promise<EmbyUserDetail> {
  const response = await embyFetch(`/Users/${encodeURIComponent(embyUserId)}`);
  if (!response.ok) {
    throw new Error(`Emby user lookup failed: ${await parseError(response)}`);
  }
  return (await response.json()) as EmbyUserDetail;
}

async function updateEmbyUserPolicy(
  embyUserId: string,
  policy: Record<string, unknown>,
): Promise<void> {
  const response = await embyFetch(`/Users/${encodeURIComponent(embyUserId)}/Policy`, {
    method: "POST",
    body: JSON.stringify(policy),
  });
  if (!response.ok) {
    throw new Error(`Emby policy update failed: ${await parseError(response)}`);
  }
}

export async function getEmbyUserPolicy(embyUserId: string): Promise<Record<string, unknown>> {
  const user = await getEmbyUser(embyUserId);
  return user.Policy ?? {};
}

export async function setEmbyUserPolicy(
  embyUserId: string,
  policy: Record<string, unknown>,
): Promise<void> {
  await updateEmbyUserPolicy(embyUserId, policy);
}

export async function syncUserMembershipToEmby(
  appUserId: string,
  embyUserId: string,
  status: "ACTIVE" | "EXPIRED",
  endAt: Date | null,
): Promise<void> {
  const user = await getEmbyUser(embyUserId);
  const nextPolicy = {
    ...(user.Policy ?? {}),
    IsDisabled: status === "EXPIRED",
  };

  await updateEmbyUserPolicy(embyUserId, nextPolicy);

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "EMBY_SYNC",
      targetType: "AppUser",
      targetId: appUserId,
      detailJson: JSON.stringify({
        embyUserId,
        embyUserName: user.Name,
        status,
        endAt: endAt?.toISOString() ?? null,
        appliedPolicy: { IsDisabled: nextPolicy.IsDisabled },
      }),
    },
  });
}
