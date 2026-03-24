import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, RechargeRecordItem } from "../api";

export function useRechargeRecordsTab(getClient: () => AdminClient) {
  const rechargeRecords = ref<RechargeRecordItem[]>([]);
  const rechargeRecordQuery = ref("");
  const loadingRechargeList = ref(false);

  async function fetchRechargeRecords() {
    loadingRechargeList.value = true;
    try {
      const { data } = await getClient().listRecharges(rechargeRecordQuery.value.trim(), 200);
      rechargeRecords.value = data.records;
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询充值记录失败");
    } finally {
      loadingRechargeList.value = false;
    }
  }

  return {
    rechargeRecords,
    rechargeRecordQuery,
    loadingRechargeList,
    fetchRechargeRecords,
  };
}
