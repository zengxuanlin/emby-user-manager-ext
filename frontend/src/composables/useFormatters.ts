import type { EmbyActivityItem, EmbyStatsItem, TmdbSearchItem, UserListItem } from "../api";

export function formatToChinaTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatPlaybackProgress(positionTicks: number | null, runtimeTicks: number | null): string {
  if (!positionTicks || !runtimeTicks || runtimeTicks <= 0) {
    return "-";
  }
  const ratio = Math.max(0, Math.min(100, (positionTicks / runtimeTicks) * 100));
  return `${ratio.toFixed(1)}%`;
}

export function formatActivityState(state: EmbyActivityItem["playbackState"]): string {
  if (state === "PLAYING") {
    return "播放中";
  }
  if (state === "PAUSED") {
    return "已暂停";
  }
  return "空闲";
}

export function getActivityImageUrl(item: EmbyActivityItem): string {
  if (!item.primaryImageItemId) {
    return "";
  }
  return `/api/emby/images/primary/${encodeURIComponent(item.primaryImageItemId)}`;
}

export function formatMembershipStatus(status?: UserListItem["membershipStatus"]): string {
  if (status === "ACTIVE") {
    return "有效";
  }
  if (status === "EXPIRED") {
    return "已到期";
  }
  return "未知";
}

export function formatWebhookSendStatus(status: string): string {
  if (status === "SENT") {
    return "发送成功";
  }
  if (status === "FAILED") {
    return "发送失败";
  }
  if (status === "SKIPPED") {
    return "已跳过";
  }
  if (status === "PENDING") {
    return "待处理";
  }
  return status || "未知";
}

export function formatEmailEventType(eventType: string): string {
  const normalized = (eventType || "").trim();
  const mapping: Record<string, string> = {
    MEMBERSHIP_RECHARGED: "会员续期通知",
    MEMBERSHIP_EXPIRED: "会员到期通知",
    WEBHOOK_WEBHOOKTEST: "Webhook 测试通知",
    WEBHOOK_NOTIFICATIONTEST: "通知测试事件",
  };

  if (mapping[normalized]) {
    return mapping[normalized];
  }

  if (normalized.startsWith("WEBHOOK_LIBRARY_")) {
    return "媒体入库通知";
  }
  if (normalized.startsWith("WEBHOOK_")) {
    return `Emby 事件通知 (${normalized.replace(/^WEBHOOK_/, "")})`;
  }

  return normalized || "未知事件";
}

export function formatTmdbRating(rating: number | null, voteCount: number | null): string {
  if (rating == null) {
    return "-";
  }
  if (voteCount == null) {
    return rating.toFixed(1);
  }
  return `${rating.toFixed(1)} / ${voteCount}票`;
}

export function formatRuntime(runtime: number | null): string {
  if (!runtime || runtime <= 0) {
    return "-";
  }
  return `${runtime} 分钟`;
}

export function formatFileSize(size: number | null | undefined): string {
  if (size == null || !Number.isFinite(size)) {
    return "-";
  }

  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatAssrtProducer(
  producer:
    | {
        uploader: string | null;
        verifier: string | null;
        producer: string | null;
        source: string | null;
      }
    | null
    | undefined,
): string {
  if (!producer) {
    return "-";
  }

  const parts = [
    producer.uploader ? `上传者：${producer.uploader}` : "",
    producer.verifier ? `校订：${producer.verifier}` : "",
    producer.producer ? `制作者：${producer.producer}` : "",
    producer.source ? `来源：${producer.source}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "-";
}

export function formatSeasonEpisode(seasonCount: number | null, episodeCount: number | null): string {
  const seasonText = seasonCount != null ? `${seasonCount}季` : "-";
  const episodeText = episodeCount != null ? `${episodeCount}集` : "-";
  return `${seasonText} / ${episodeText}`;
}

export function getTmdbPageUrl(item: TmdbSearchItem): string {
  return item.mediaType === "movie"
    ? `https://www.themoviedb.org/movie/${item.id}`
    : `https://www.themoviedb.org/tv/${item.id}`;
}

export function getEmbyStatsImageUrl(item: EmbyStatsItem): string {
  if (!item.primaryImageItemId) {
    return "";
  }
  return `/api/emby/images/primary/${encodeURIComponent(item.primaryImageItemId)}`;
}

export function formatEmbyRuntimeTicks(runtimeTicks: number | null): string {
  if (!runtimeTicks || runtimeTicks <= 0) {
    return "-";
  }
  const totalMinutes = Math.round(runtimeTicks / 10_000_000 / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
}

export function formatEmbyMediaType(type: string | null): string {
  if (type === "Movie") {
    return "电影";
  }
  if (type === "Series") {
    return "剧集";
  }
  return type || "媒体";
}

export function formatEmbyRating(rating: number | null): string {
  if (rating == null) {
    return "-";
  }
  return rating.toFixed(1);
}
