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
