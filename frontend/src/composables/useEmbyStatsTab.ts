import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, EmbyStatsItem } from "../api";

export function useEmbyStatsTab(getClient: () => AdminClient) {
  const embyStatsLatest = ref<EmbyStatsItem[]>([]);
  const embyStatsPopular = ref<EmbyStatsItem[]>([]);
  const embyStatsFetchedAt = ref<string | null>(null);
  const loadingEmbyStats = ref(false);

  async function fetchEmbyStats() {
    loadingEmbyStats.value = true;
    try {
      const { data } = await getClient().getEmbyStats();
      embyStatsLatest.value = data.latest;
      embyStatsPopular.value = data.popular;
      embyStatsFetchedAt.value = data.fetchedAt;
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询 Emby 统计失败");
    } finally {
      loadingEmbyStats.value = false;
    }
  }

  return {
    embyStatsLatest,
    embyStatsPopular,
    embyStatsFetchedAt,
    loadingEmbyStats,
    fetchEmbyStats,
  };
}
