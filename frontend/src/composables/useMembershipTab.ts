import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient } from "../api";

export function useMembershipTab(getClient: () => AdminClient) {
  const membershipQueryId = ref("");
  const membershipResult = ref("尚未查询");
  const loadingMembership = ref(false);

  async function fetchMembership() {
    loadingMembership.value = true;
    try {
      const { data } = await getClient().getMembership(membershipQueryId.value.trim());
      membershipResult.value = JSON.stringify(data, null, 2);
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询失败");
    } finally {
      loadingMembership.value = false;
    }
  }

  return {
    membershipQueryId,
    membershipResult,
    loadingMembership,
    fetchMembership,
  };
}
