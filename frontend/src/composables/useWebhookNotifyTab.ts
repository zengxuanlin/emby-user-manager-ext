import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, WebhookEmailNotificationItem } from "../api";

export function useWebhookNotifyTab(getClient: () => AdminClient, webhookReceiveUrl: string) {
  const webhookNotifyRecords = ref<WebhookEmailNotificationItem[]>([]);
  const webhookNotifyQuery = ref("");
  const webhookNotifyPage = ref(1);
  const webhookNotifyPageSize = ref(20);
  const webhookNotifyTotal = ref(0);
  const loadingWebhookNotifyList = ref(false);

  async function fetchWebhookNotifyRecords() {
    loadingWebhookNotifyList.value = true;
    try {
      const { data } = await getClient().listWebhookEmailNotificationsPaged(
        webhookNotifyQuery.value.trim(),
        webhookNotifyPage.value,
        webhookNotifyPageSize.value,
      );
      webhookNotifyRecords.value = data.records;
      webhookNotifyTotal.value = data.total;
      webhookNotifyPage.value = data.page;
      webhookNotifyPageSize.value = data.pageSize;
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "查询Webhook邮件通知失败");
    } finally {
      loadingWebhookNotifyList.value = false;
    }
  }

  function searchWebhookNotifyRecords() {
    webhookNotifyPage.value = 1;
    void fetchWebhookNotifyRecords();
  }

  function handleWebhookPageSizeChange() {
    webhookNotifyPage.value = 1;
    void fetchWebhookNotifyRecords();
  }

  async function copyWebhookReceiveUrl() {
    try {
      await navigator.clipboard.writeText(webhookReceiveUrl);
      ElMessage.success("Webhook 地址已复制");
    } catch {
      ElMessage.error("复制失败，请手动复制");
    }
  }

  return {
    webhookNotifyRecords,
    webhookNotifyQuery,
    webhookNotifyPage,
    webhookNotifyPageSize,
    webhookNotifyTotal,
    loadingWebhookNotifyList,
    fetchWebhookNotifyRecords,
    searchWebhookNotifyRecords,
    handleWebhookPageSizeChange,
    copyWebhookReceiveUrl,
  };
}
