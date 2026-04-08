import { reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, AssrtSubtitleDetail, AssrtSubtitleSearchItem } from "../api";

const ASSRT_TOKEN_STORAGE_KEY = "assrt_api_token";

export function useAssrtTab(getClient: () => AdminClient) {
  const assrtToken = ref(localStorage.getItem(ASSRT_TOKEN_STORAGE_KEY) || "");
  const assrtQuery = ref("");
  const assrtSummary = ref("请输入 ASSRT Token 和关键字后开始搜索");
  const assrtQuota = ref<number | null>(null);
  const assrtHasSearched = ref(false);
  const assrtResults = ref<AssrtSubtitleSearchItem[]>([]);
  const assrtFetchedAt = ref<string | null>(null);
  const loadingAssrt = ref(false);
  const assrtDetails = reactive<Record<number, AssrtSubtitleDetail | undefined>>({});
  const assrtExpandedIds = reactive<Record<number, boolean | undefined>>({});
  const assrtDetailLoading = reactive<Record<number, boolean | undefined>>({});

  watch(
    assrtToken,
    (value) => {
      localStorage.setItem(ASSRT_TOKEN_STORAGE_KEY, value.trim());
    },
    { immediate: true },
  );

  async function searchAssrt() {
    const token = assrtToken.value.trim();
    const keyword = assrtQuery.value.trim();
    if (!token) {
      ElMessage.warning("请输入 ASSRT Token");
      return;
    }
    if (keyword.length < 3) {
      ElMessage.warning("字幕搜索关键字至少需要 3 个字符");
      return;
    }

    loadingAssrt.value = true;
    try {
      const { data } = await getClient().searchAssrt({
        token,
        q: keyword,
        cnt: 10,
        pos: 0,
      });
      assrtHasSearched.value = true;
      assrtResults.value = data.results;
      assrtQuota.value = data.quota;
      assrtFetchedAt.value = data.fetchedAt;
      assrtSummary.value = `共找到 ${data.results.length} 条字幕，当前可用配额 ${data.quota ?? "未知"}`;
      Object.keys(assrtDetails).forEach((key) => delete assrtDetails[Number(key)]);
      Object.keys(assrtExpandedIds).forEach((key) => delete assrtExpandedIds[Number(key)]);
      Object.keys(assrtDetailLoading).forEach((key) => delete assrtDetailLoading[Number(key)]);
    } catch (error: any) {
      assrtHasSearched.value = true;
      assrtResults.value = [];
      assrtSummary.value = error?.response?.data?.message || "ASSRT 搜索失败";
      assrtQuota.value = null;
      ElMessage.error(error?.response?.data?.message || "ASSRT 搜索失败");
    } finally {
      loadingAssrt.value = false;
    }
  }

  async function toggleAssrtDetail(item: AssrtSubtitleSearchItem) {
    if (assrtExpandedIds[item.id]) {
      assrtExpandedIds[item.id] = false;
      return;
    }

    assrtExpandedIds[item.id] = true;
    if (assrtDetails[item.id]) {
      return;
    }

    assrtDetailLoading[item.id] = true;
    try {
      const { data } = await getClient().getAssrtSubtitleDetail({
        token: assrtToken.value.trim(),
        id: item.id,
      });
      assrtDetails[item.id] = data.detail;
    } catch (error: any) {
      assrtExpandedIds[item.id] = false;
      ElMessage.error(error?.response?.data?.message || "获取字幕详情失败");
    } finally {
      assrtDetailLoading[item.id] = false;
    }
  }

  async function copyAssrtSubtitleId(id: number) {
    try {
      await navigator.clipboard.writeText(String(id));
      ElMessage.success(`字幕 ID ${id} 已复制`);
    } catch {
      ElMessage.error("复制字幕 ID 失败");
    }
  }

  async function copyAssrtDownloadUrl(id: number) {
    const detail = assrtDetails[id];
    if (!detail?.downloadUrl) {
      ElMessage.warning("请先展开详情并确认有下载链接");
      return;
    }
    try {
      await navigator.clipboard.writeText(detail.downloadUrl);
      ElMessage.success("字幕下载链接已复制");
    } catch {
      ElMessage.error("复制下载链接失败");
    }
  }

  return {
    assrtToken,
    assrtQuery,
    assrtSummary,
    assrtQuota,
    assrtHasSearched,
    assrtResults,
    assrtFetchedAt,
    loadingAssrt,
    assrtDetails,
    assrtExpandedIds,
    assrtDetailLoading,
    searchAssrt,
    toggleAssrtDetail,
    copyAssrtSubtitleId,
    copyAssrtDownloadUrl,
  };
}
