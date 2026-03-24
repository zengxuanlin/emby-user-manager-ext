import type { EmbyActivityItem, TmdbSearchItem, UserListItem } from "../api";

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
