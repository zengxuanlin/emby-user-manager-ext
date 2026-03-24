import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, TmdbSearchItem } from "../api";

export function useTmdbTab(getClient: () => AdminClient) {
  const tmdbQuery = ref("");
  const tmdbSummary = ref("尚未搜索");
  const tmdbHasSearched = ref(false);
  const tmdbResults = ref<TmdbSearchItem[]>([]);
  const loadingTmdb = ref(false);

  async function searchTmdb() {
    const keyword = tmdbQuery.value.trim();
    if (!keyword) {
      ElMessage.warning("请输入 TMDB 搜索关键字");
      return;
    }

    loadingTmdb.value = true;
    try {
      const { data } = await getClient().searchTmdb(keyword, 1);
      tmdbHasSearched.value = true;
      tmdbResults.value = data.results;
      tmdbSummary.value = `共 ${data.totalResults} 条，当前展示 ${data.results.length} 条`;
    } catch (error: any) {
      tmdbHasSearched.value = true;
      tmdbResults.value = [];
      tmdbSummary.value = error?.response?.data?.message || "TMDB 搜索失败";
      ElMessage.error(error?.response?.data?.message || "TMDB 搜索失败");
    } finally {
      loadingTmdb.value = false;
    }
  }

  async function copyTmdbId(id: number) {
    try {
      await navigator.clipboard.writeText(String(id));
      ElMessage.success(`TMDB ID ${id} 已复制`);
    } catch {
      ElMessage.error("复制 TMDB ID 失败");
    }
  }

  return {
    tmdbQuery,
    tmdbSummary,
    tmdbHasSearched,
    tmdbResults,
    loadingTmdb,
    searchTmdb,
    copyTmdbId,
  };
}
