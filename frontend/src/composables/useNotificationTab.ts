import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient, NotificationSettings } from "../api";

export function useNotificationTab(getClient: () => AdminClient) {
  const notifyResult = ref("尚未保存");
  const loadingNotifySettings = ref(false);
  const notificationForm = reactive<NotificationSettings>({
    senderEmail: "",
    emailAuthCode: "",
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    ingestionPushEnabled: true,
  });

  function updateNotificationForm(value: NotificationSettings) {
    notificationForm.senderEmail = value.senderEmail;
    notificationForm.emailAuthCode = value.emailAuthCode;
    notificationForm.smtpHost = value.smtpHost;
    notificationForm.smtpPort = value.smtpPort;
    notificationForm.smtpSecure = value.smtpSecure;
    notificationForm.ingestionPushEnabled = value.ingestionPushEnabled;
  }

  async function loadNotificationSettings() {
    loadingNotifySettings.value = true;
    try {
      const { data } = await getClient().getNotificationSettings();
      notificationForm.senderEmail = data.settings.senderEmail ?? "";
      notificationForm.emailAuthCode = data.settings.emailAuthCode ?? "";
      notificationForm.smtpHost = data.settings.smtpHost ?? "";
      notificationForm.smtpPort = Number(data.settings.smtpPort ?? 465);
      notificationForm.smtpSecure = Boolean(data.settings.smtpSecure);
      notificationForm.ingestionPushEnabled = Boolean(data.settings.ingestionPushEnabled);
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "加载通知设置失败");
    } finally {
      loadingNotifySettings.value = false;
    }
  }

  async function submitNotificationSettings() {
    loadingNotifySettings.value = true;
    try {
      const { data } = await getClient().updateNotificationSettings({
        senderEmail: (notificationForm.senderEmail ?? "").trim() || null,
        emailAuthCode: (notificationForm.emailAuthCode ?? "").trim() || null,
        smtpHost: (notificationForm.smtpHost ?? "").trim() || null,
        smtpPort: Number(notificationForm.smtpPort),
        smtpSecure: notificationForm.smtpSecure,
        ingestionPushEnabled: notificationForm.ingestionPushEnabled,
      });
      notifyResult.value = `保存成功: 推送${data.settings.ingestionPushEnabled ? "开启" : "关闭"}`;
      ElMessage.success("通知设置已保存");
    } catch (error: any) {
      const issues = error?.response?.data?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        ElMessage.error(`${issues[0].path || "payload"}: ${issues[0].message}`);
      } else {
        ElMessage.error(error?.response?.data?.message || "保存通知设置失败");
      }
    } finally {
      loadingNotifySettings.value = false;
    }
  }

  return {
    notifyResult,
    loadingNotifySettings,
    notificationForm,
    updateNotificationForm,
    loadNotificationSettings,
    submitNotificationSettings,
  };
}
