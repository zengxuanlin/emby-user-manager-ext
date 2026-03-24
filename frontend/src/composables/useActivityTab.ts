import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, EmbyActivityItem } from "../api";

export function useActivityTab(getClient: () => AdminClient) {
  const activities = ref<EmbyActivityItem[]>([]);
  const activitiesFetchedAt = ref<string | null>(null);
  const loadingActivities = ref(false);

  async function fetchActivities() {
    loadingActivities.value = true;
    try {
      const { data } = await getClient().listActivities();
      activities.value = data.activities;
      activitiesFetchedAt.value = data.fetchedAt;
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询实时活动失败");
    } finally {
      loadingActivities.value = false;
    }
  }

  return {
    activities,
    activitiesFetchedAt,
    loadingActivities,
    fetchActivities,
  };
}
