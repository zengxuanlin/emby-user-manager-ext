import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { AdminClient } from "../api";

export function useJobsTab(getClient: () => AdminClient) {
  const jobResult = ref("尚未执行");
  const expireJobCronResult = ref("尚未保存");
  const expireJobCronMode = ref<"simple" | "custom">("simple");
  const expireJobCronInput = ref("5 2 * * *");
  const expireJobSimple = reactive<{
    kind: "daily" | "weekly";
    hour: number;
    minute: number;
    weekday: string;
  }>({
    kind: "daily",
    hour: 2,
    minute: 5,
    weekday: "1",
  });
  const loadingJob = ref(false);
  const loadingJobCron = ref(false);

  function getSimpleExpireCron(): string {
    const minute = Math.max(0, Math.min(59, Number(expireJobSimple.minute)));
    const hour = Math.max(0, Math.min(23, Number(expireJobSimple.hour)));
    if (expireJobSimple.kind === "weekly") {
      return `${minute} ${hour} * * ${expireJobSimple.weekday}`;
    }
    return `${minute} ${hour} * * *`;
  }

  function getSimpleExpireCronHumanText(): string {
    const hour = String(Math.max(0, Math.min(23, Number(expireJobSimple.hour)))).padStart(2, "0");
    const minute = String(Math.max(0, Math.min(59, Number(expireJobSimple.minute)))).padStart(2, "0");
    if (expireJobSimple.kind === "weekly") {
      const labels: Record<string, string> = {
        "0": "周日",
        "1": "周一",
        "2": "周二",
        "3": "周三",
        "4": "周四",
        "5": "周五",
        "6": "周六",
      };
      return `${labels[expireJobSimple.weekday] ?? "周一"} ${hour}:${minute}`;
    }
    return `每天 ${hour}:${minute}`;
  }

  function applyCronToSimpleForm(expr: string): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
      return false;
    }
    const [minute, hour, dayOfMonth, month, weekDay] = parts;
    if (dayOfMonth !== "*" || month !== "*") {
      return false;
    }
    if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
      return false;
    }
    const minuteNum = Number(minute);
    const hourNum = Number(hour);
    if (minuteNum < 0 || minuteNum > 59 || hourNum < 0 || hourNum > 23) {
      return false;
    }

    expireJobSimple.minute = minuteNum;
    expireJobSimple.hour = hourNum;
    if (weekDay === "*") {
      expireJobSimple.kind = "daily";
      return true;
    }
    if (/^[0-6]$/.test(weekDay)) {
      expireJobSimple.kind = "weekly";
      expireJobSimple.weekday = weekDay;
      return true;
    }
    return false;
  }

  async function loadExpireJobCronSettings() {
    loadingJobCron.value = true;
    try {
      const { data } = await getClient().getExpireJobSettings();
      const cronExpr = data.settings.expireJobCron.trim();
      expireJobCronInput.value = cronExpr;
      if (applyCronToSimpleForm(cronExpr)) {
        expireJobCronMode.value = "simple";
      } else {
        expireJobCronMode.value = "custom";
      }
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "加载到期任务调度配置失败");
    } finally {
      loadingJobCron.value = false;
    }
  }

  async function submitExpireJobCron() {
    loadingJobCron.value = true;
    try {
      const expireJobCron = expireJobCronMode.value === "simple"
        ? getSimpleExpireCron()
        : expireJobCronInput.value.trim();
      const { data } = await getClient().updateExpireJobSettings({ expireJobCron });
      expireJobCronInput.value = data.settings.expireJobCron;
      expireJobCronResult.value = `保存成功: ${data.settings.expireJobCron}`;
      ElMessage.success("到期任务调度已更新");
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "保存到期任务调度失败");
    } finally {
      loadingJobCron.value = false;
    }
  }

  async function runExpireJob() {
    loadingJob.value = true;
    try {
      const { data } = await getClient().runExpireJob();
      jobResult.value = JSON.stringify(data);
      ElMessage.success("任务已执行");
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || "任务执行失败");
    } finally {
      loadingJob.value = false;
    }
  }

  return {
    jobResult,
    expireJobCronResult,
    expireJobCronMode,
    expireJobCronInput,
    expireJobSimple,
    loadingJob,
    loadingJobCron,
    getSimpleExpireCron,
    getSimpleExpireCronHumanText,
    loadExpireJobCronSettings,
    submitExpireJobCron,
    runExpireJob,
  };
}
