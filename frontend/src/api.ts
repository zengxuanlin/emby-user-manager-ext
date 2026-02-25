import axios from "axios";

export interface AdminSettings {
  baseUrl: string;
  authToken: string;
}

export interface UserListItem {
  embyUserId: string;
  embyUsername: string;
  embyDisabled: boolean;
  embyCreatedAt?: string | null;
  localLinked: boolean;
  email?: string | null;
  emailPushEnabled: boolean;
  membershipStatus?: "ACTIVE" | "EXPIRED" | null;
  membershipEndAt?: string | null;
  lastRechargeAmount?: string | null;
}

export interface Membership {
  id: string;
  status: "ACTIVE" | "EXPIRED";
  startAt?: string | null;
  endAt?: string | null;
  lastRechargeAmount?: string | null;
}

export interface EmbyUserPolicy {
  IsAdministrator?: boolean;
  IsHidden?: boolean;
  IsDisabled?: boolean;
  IsHiddenRemotely?: boolean;
  EnableRemoteAccess?: boolean;
  EnableLiveTvAccess?: boolean;
  EnableMediaPlayback?: boolean;
  EnableAudioPlaybackTranscoding?: boolean;
  EnableVideoPlaybackTranscoding?: boolean;
  EnableContentDeletion?: boolean;
  EnableContentDownloading?: boolean;
  [key: string]: unknown;
}

export interface RechargeRecordItem {
  id: string;
  adminName: string;
  amount: string;
  months: number;
  startFrom: string;
  oldEndAt?: string | null;
  newEndAt: string;
  note?: string | null;
  createdAt: string;
  user: {
    id: string;
    embyUserId: string;
    embyUsername: string;
    email?: string | null;
  };
}

export interface EmbyActivityItem {
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
}

export interface NotificationSettings {
  senderEmail: string | null;
  emailAuthCode: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  ingestionPushEnabled: boolean;
}

export function login(baseUrl: string, payload: { username: string; password: string }) {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: 15000,
  });
  return http.post<{
    ok: boolean;
    token: string;
    expiresAt: number;
    username: string;
  }>("/auth/login", payload);
}

export function createAdminClient(settings: AdminSettings) {
  const http = axios.create({
    baseURL: settings.baseUrl,
    timeout: 15000,
  });

  http.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${settings.authToken}`;
    return config;
  });

  return {
    getNotificationSettings() {
      return http.get<{ settings: NotificationSettings }>("/admin/system/notification-settings");
    },
    updateNotificationSettings(payload: NotificationSettings) {
      return http.put<{ ok: boolean; settings: NotificationSettings }>(
        "/admin/system/notification-settings",
        payload,
      );
    },
    createEmbyUser(payload: {
      username: string;
      password?: string;
      localEmail?: string | null;
      emailPushEnabled?: boolean;
    }) {
      return http.post("/admin/emby/users/create", payload);
    },
    deleteEmbyUser(embyUserId: string) {
      return http.delete(`/admin/emby/users/${encodeURIComponent(embyUserId)}`);
    },
    upsertUser(payload: { embyUserId: string; embyUsername: string; email?: string }) {
      return http.post("/admin/users/upsert", payload);
    },
    listUsers(q = "") {
      return http.get<{ users: UserListItem[] }>("/admin/emby/users", { params: { q } });
    },
    listActivities() {
      return http.get<{ activities: EmbyActivityItem[]; fetchedAt: string }>("/admin/emby/activities");
    },
    syncEmbyUsers() {
      return http.post<{
        ok: boolean;
        total: number;
        created: number;
        updated: number;
      }>("/admin/emby/sync-users");
    },
    getUserPolicy(embyUserId: string) {
      return http.get<{
        embyUserId: string;
        policy: EmbyUserPolicy;
        local: {
          email: string | null;
          emailPushEnabled: boolean;
        };
      }>(
        `/admin/emby/users/${encodeURIComponent(embyUserId)}/policy`,
      );
    },
    updateUserPolicy(
      embyUserId: string,
      payload: {
        policy: EmbyUserPolicy;
        embyUsername: string;
        localEmail: string | null;
        emailPushEnabled: boolean;
      },
    ) {
      return http.put(`/admin/emby/users/${encodeURIComponent(embyUserId)}/policy`, payload);
    },
    updateUserPassword(embyUserId: string, password: string) {
      return http.put(`/admin/emby/users/${encodeURIComponent(embyUserId)}/password`, { password });
    },
    listRecharges(q = "", limit = 100) {
      return http.get<{ records: RechargeRecordItem[] }>("/admin/recharges", {
        params: { q, limit },
      });
    },
    manualRecharge(payload: { embyUserId: string; amount: number; months: number; note?: string }) {
      return http.post("/admin/recharges/manual", payload);
    },
    setMembershipEndAt(embyUserId: string, endAt: string) {
      return http.put(`/admin/memberships/${encodeURIComponent(embyUserId)}/end-at`, { endAt });
    },
    getMembership(embyUserId: string) {
      return http.get("/admin/memberships/" + encodeURIComponent(embyUserId));
    },
    runExpireJob() {
      return http.post("/admin/jobs/expire-memberships");
    },
  };
}
