<template>
  <div class="page">
    <template v-if="!isAuthenticated">
      <section class="card" style="max-width: 460px; margin: 8vh auto 0;">
        <p class="kicker">EMBY User Expansion</p>
        <h2 style="margin: 0 0 8px;">管理员登录</h2>
        <p class="subtitle">账号密码来自后端环境变量配置</p>
        <el-form label-position="top" class="top-gap">
          <el-form-item label="账号">
            <el-input v-model="loginForm.username" placeholder="请输入账号" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" type="password" show-password placeholder="请输入密码" />
          </el-form-item>
        </el-form>
        <el-button type="primary" :loading="loading.login" @click="submitLogin">登录</el-button>
      </section>
    </template>
    <template v-else>
    <header class="hero">
      <div>
        <p class="kicker">EMBY User Expansion</p>
        <h1>会员管理后台</h1>
        <p class="subtitle">手工充值、会员查询、到期任务与操作联调面板</p>
      </div>
      <el-button plain @click="logout">退出登录</el-button>
    </header>

    <section class="card">
      <el-tabs v-model="tab">
        <el-tab-pane label="实时活动" name="activity">
          <ActivityTab
            :activities="activities"
            :fetched-at="activitiesFetchedAt"
            :loading="loadingActivities"
            :format-to-china-time="formatToChinaTime"
            :format-playback-progress="formatPlaybackProgress"
            :format-activity-state="formatActivityState"
            :get-activity-image-url="getActivityImageUrl"
            @refresh="fetchActivities"
          />
        </el-tab-pane>

        <el-tab-pane label="用户管理" name="users">
          <UsersTab
            :search="search"
            :users="users"
            :sync-result="syncResult"
            :loading-users="loadingUsers"
            :loading-sync-users="loadingSyncUsers"
            :format-to-china-time="formatToChinaTime"
            :format-membership-status="formatMembershipStatus"
            @update:search="search = $event"
            @fetch-users="fetchUsers"
            @open-create-dialog="createDialogVisible = true"
            @sync-users="syncUsersFromEmby"
            @user-action="handleUserAction"
          />
        </el-tab-pane>

        <el-tab-pane label="充值记录" name="recharge-records">
          <RechargeRecordsTab
            :query="rechargeRecordQuery"
            :records="rechargeRecords"
            :loading="loadingRechargeList"
            :format-to-china-time="formatToChinaTime"
            @update:query="rechargeRecordQuery = $event"
            @search="fetchRechargeRecords"
          />
        </el-tab-pane>

        <el-tab-pane label="会员查询" name="membership">
          <MembershipTab
            :query-id="membershipQueryId"
            :result="membershipResult"
            :loading="loadingMembership"
            @update:query-id="membershipQueryId = $event"
            @search="fetchMembership"
          />
        </el-tab-pane>

        <el-tab-pane label="Emby统计" name="emby-stats">
          <EmbyStatsTab
            :fetched-at="embyStatsFetchedAt"
            :latest="embyStatsLatest"
            :popular="embyStatsPopular"
            :loading="loadingEmbyStats"
            :format-to-china-time="formatToChinaTime"
            :get-stats-image-url="getEmbyStatsImageUrl"
            :format-runtime-ticks="formatEmbyRuntimeTicks"
            :format-media-type="formatEmbyMediaType"
            :format-rating="formatEmbyRating"
            @refresh="fetchEmbyStats"
          />
        </el-tab-pane>

        <el-tab-pane label="TMDB搜索" name="tmdb">
          <TmdbTab
            :query="tmdbQuery"
            :summary="tmdbSummary"
            :has-searched="tmdbHasSearched"
            :results="tmdbResults"
            :loading="loadingTmdb"
            :format-tmdb-rating="formatTmdbRating"
            :format-runtime="formatRuntime"
            :format-season-episode="formatSeasonEpisode"
            :get-tmdb-page-url="getTmdbPageUrl"
            @update:query="tmdbQuery = $event"
            @search="searchTmdb"
            @copy-id="copyTmdbId"
          />
        </el-tab-pane>

        <el-tab-pane label="通知设置" name="notification">
          <NotificationTab
            :form="notificationForm"
            :result="notifyResult"
            :loading="loadingNotifySettings"
            @update:form="updateNotificationForm"
            @submit="submitNotificationSettings"
          />
        </el-tab-pane>

        <el-tab-pane label="Webhook通知列表" name="webhook-notify">
          <WebhookNotifyTab
            :webhook-receive-url="webhookReceiveUrl"
            :query="webhookNotifyQuery"
            :records="webhookNotifyRecords"
            :total="webhookNotifyTotal"
            :page="webhookNotifyPage"
            :page-size="webhookNotifyPageSize"
            :loading="loadingWebhookNotifyList"
            :format-to-china-time="formatToChinaTime"
            :format-webhook-send-status="formatWebhookSendStatus"
            @copy-url="copyWebhookReceiveUrl"
            @update:query="webhookNotifyQuery = $event"
            @search="searchWebhookNotifyRecords"
            @update:page="webhookNotifyPage = $event"
            @update:page-size="webhookNotifyPageSize = $event"
            @page-change="fetchWebhookNotifyRecords"
            @page-size-change="handleWebhookPageSizeChange"
          />
        </el-tab-pane>

        <el-tab-pane label="任务与系统" name="jobs">
          <JobsTab
            :cron-mode="expireJobCronMode"
            :cron-input="expireJobCronInput"
            :cron-result="expireJobCronResult"
            :job-result="jobResult"
            :simple="expireJobSimple"
            :week-day-options="weekDayOptions"
            :loading-cron="loadingJobCron"
            :loading-job="loadingJob"
            :get-simple-expire-cron="getSimpleExpireCron"
            :get-simple-expire-cron-human-text="getSimpleExpireCronHumanText"
            @update:cron-mode="expireJobCronMode = $event"
            @update:cron-input="expireJobCronInput = $event"
            @update:simple="updateExpireJobSimple"
            @submit-cron="submitExpireJobCron"
            @run-job="runExpireJob"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="policyDialogVisible"
      width="680px"
      :title="`编辑权限 - ${policyEditingUser?.embyUsername || ''}`"
      destroy-on-close
    >
      <div v-loading="loading.policyLoad">
        <el-form label-position="top" class="policy-grid">
          <el-form-item label="本地邮箱" class="span-2">
            <el-input v-model="localProfile.email" placeholder="用于邮件通知" />
          </el-form-item>
          <el-form-item label="入库推送邮箱开启">
            <el-switch v-model="localProfile.emailPushEnabled" />
          </el-form-item>
          <el-form-item label="管理员">
            <el-switch v-model="policyForm.IsAdministrator" />
          </el-form-item>
          <el-form-item label="禁用用户">
            <el-switch v-model="policyForm.IsDisabled" />
          </el-form-item>
          <el-form-item label="隐藏用户">
            <el-switch v-model="policyForm.IsHidden" />
          </el-form-item>
          <el-form-item label="远程隐藏">
            <el-switch v-model="policyForm.IsHiddenRemotely" />
          </el-form-item>
          <el-form-item label="允许远程访问">
            <el-switch v-model="policyForm.EnableRemoteAccess" />
          </el-form-item>
          <el-form-item label="允许直播电视">
            <el-switch v-model="policyForm.EnableLiveTvAccess" />
          </el-form-item>
          <el-form-item label="允许媒体播放">
            <el-switch v-model="policyForm.EnableMediaPlayback" />
          </el-form-item>
          <el-form-item label="允许音频转码">
            <el-switch v-model="policyForm.EnableAudioPlaybackTranscoding" />
          </el-form-item>
          <el-form-item label="允许视频转码">
            <el-switch v-model="policyForm.EnableVideoPlaybackTranscoding" />
          </el-form-item>
          <el-form-item label="允许删除媒体">
            <el-switch v-model="policyForm.EnableContentDeletion" />
          </el-form-item>
          <el-form-item label="允许下载媒体">
            <el-switch v-model="policyForm.EnableContentDownloading" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="policyDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="submitPolicyUpdate"
          :loading="loading.policySave"
          :disabled="loading.policyLoad"
        >
          保存权限
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createDialogVisible" width="560px" title="新增 Emby 用户" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="必填，例如 test_user" />
        </el-form-item>
        <el-form-item label="初始密码（可选）">
          <el-input
            v-model="createForm.password"
            placeholder="可选，不填则稍后在 Emby 设置"
            type="password"
            show-password
          />
        </el-form-item>
        <el-form-item label="本地邮箱（可选）">
          <el-input v-model="createForm.localEmail" placeholder="用于邮件推送" />
        </el-form-item>
        <el-form-item label="入库推送邮箱开启">
          <el-switch v-model="createForm.emailPushEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading.createUser" @click="submitCreateUser">
          创建用户
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordDialogVisible"
      width="460px"
      :title="`修改密码 - ${passwordEditingUser?.embyUsername || ''}`"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.password" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading.passwordSave" @click="submitPasswordUpdate">
          保存密码
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rechargeDialogVisible"
      width="520px"
      :title="`手工充值 - ${rechargeEditingUser?.embyUsername || ''}`"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="Emby User ID">
          <el-input :model-value="rechargeForm.embyUserId" disabled />
        </el-form-item>
        <el-form-item label="充值金额">
          <el-input-number
            v-model="rechargeForm.amount"
            :min="0.01"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="月数">
          <el-input-number
            v-model="rechargeForm.months"
            :min="1"
            :max="36"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input v-model="rechargeForm.note" placeholder="后台手工续费" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="loading.recharge" @click="submitRecharge">
          提交充值
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="expiryDialogVisible"
      width="520px"
      :title="`修改到期时间 - ${expiryEditingUser?.embyUsername || ''}`"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="Emby User ID">
          <el-input :model-value="expiryForm.embyUserId" disabled />
        </el-form-item>
        <el-form-item label="新的到期时间">
          <el-date-picker
            v-model="expiryForm.endAt"
            type="datetime"
            placeholder="请选择新的到期时间"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="expiryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading.expiry" @click="submitEndAtUpdate">
          保存
        </el-button>
      </template>
    </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createAdminClient,
  login,
  type EmbyUserPolicy,
  type UserListItem,
} from "./api";
import ActivityTab from "./components/tabs/ActivityTab.vue";
import UsersTab from "./components/tabs/UsersTab.vue";
import RechargeRecordsTab from "./components/tabs/RechargeRecordsTab.vue";
import MembershipTab from "./components/tabs/MembershipTab.vue";
import EmbyStatsTab from "./components/tabs/EmbyStatsTab.vue";
import TmdbTab from "./components/tabs/TmdbTab.vue";
import NotificationTab from "./components/tabs/NotificationTab.vue";
import WebhookNotifyTab from "./components/tabs/WebhookNotifyTab.vue";
import JobsTab from "./components/tabs/JobsTab.vue";
import {
  formatActivityState,
  formatEmbyMediaType,
  formatEmbyRating,
  formatEmbyRuntimeTicks,
  formatMembershipStatus,
  formatPlaybackProgress,
  formatRuntime,
  formatSeasonEpisode,
  formatTmdbRating,
  formatToChinaTime,
  formatWebhookSendStatus,
  getActivityImageUrl,
  getEmbyStatsImageUrl,
  getTmdbPageUrl,
} from "./composables/useFormatters";
import { useActivityTab } from "./composables/useActivityTab";
import { useEmbyStatsTab } from "./composables/useEmbyStatsTab";
import { useTmdbTab } from "./composables/useTmdbTab";
import { useWebhookNotifyTab } from "./composables/useWebhookNotifyTab";
import { useJobsTab } from "./composables/useJobsTab";
import { useUsersTab } from "./composables/useUsersTab";
import { useRechargeRecordsTab } from "./composables/useRechargeRecordsTab";
import { useMembershipTab } from "./composables/useMembershipTab";
import { useNotificationTab } from "./composables/useNotificationTab";

const authToken = ref(localStorage.getItem("emby_auth_token") || "");
const isAuthenticated = computed(() => Boolean(authToken.value));
const loginForm = reactive({
  username: "",
  password: "",
});

const tab = ref("activity");
const webhookReceiveUrl = `${window.location.origin}/api/webhooks/emby`;
const createDialogVisible = ref(false);
const passwordDialogVisible = ref(false);
const policyDialogVisible = ref(false);
const rechargeDialogVisible = ref(false);
const expiryDialogVisible = ref(false);
const passwordEditingUser = ref<UserListItem | null>(null);
const policyEditingUser = ref<UserListItem | null>(null);
const rechargeEditingUser = ref<UserListItem | null>(null);
const expiryEditingUser = ref<UserListItem | null>(null);
const originalPolicy = ref<EmbyUserPolicy>({});
const localProfile = reactive({
  email: "",
  emailPushEnabled: false,
});
const policyForm = reactive<Required<Pick<
  EmbyUserPolicy,
  | "IsAdministrator"
  | "IsHidden"
  | "IsDisabled"
  | "IsHiddenRemotely"
  | "EnableRemoteAccess"
  | "EnableLiveTvAccess"
  | "EnableMediaPlayback"
  | "EnableAudioPlaybackTranscoding"
  | "EnableVideoPlaybackTranscoding"
  | "EnableContentDeletion"
  | "EnableContentDownloading"
>>>({
  IsAdministrator: false,
  IsHidden: false,
  IsDisabled: false,
  IsHiddenRemotely: false,
  EnableRemoteAccess: true,
  EnableLiveTvAccess: true,
  EnableMediaPlayback: true,
  EnableAudioPlaybackTranscoding: true,
  EnableVideoPlaybackTranscoding: true,
  EnableContentDeletion: false,
  EnableContentDownloading: true,
});

const rechargeForm = reactive({
  embyUserId: "",
  amount: 30,
  months: 1,
  note: "",
});

const expiryForm = reactive<{
  embyUserId: string;
  endAt: Date | null;
}>({
  embyUserId: "",
  endAt: null,
});

const createForm = reactive({
  username: "",
  password: "",
  localEmail: "",
  emailPushEnabled: false,
});

const passwordForm = reactive({
  password: "",
});

const weekDayOptions = [
  { value: "0", label: "周日" },
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
];

const loading = reactive({
  login: false,
  recharge: false,
  expiry: false,
  createUser: false,
  passwordSave: false,
  policyLoad: false,
  policySave: false,
});

function client() {
  return createAdminClient({
    baseUrl: "/api",
    authToken: authToken.value,
  });
}

const {
  search,
  users,
  syncResult,
  loadingUsers,
  loadingSyncUsers,
  fetchUsers,
  syncUsersFromEmby,
} = useUsersTab(client);

const {
  activities,
  activitiesFetchedAt,
  loadingActivities,
  fetchActivities,
} = useActivityTab(client);

const {
  embyStatsLatest,
  embyStatsPopular,
  embyStatsFetchedAt,
  loadingEmbyStats,
  fetchEmbyStats,
} = useEmbyStatsTab(client);

const {
  rechargeRecords,
  rechargeRecordQuery,
  loadingRechargeList,
  fetchRechargeRecords,
} = useRechargeRecordsTab(client);

const {
  membershipQueryId,
  membershipResult,
  loadingMembership,
  fetchMembership,
} = useMembershipTab(client);

const {
  notifyResult,
  loadingNotifySettings,
  notificationForm,
  updateNotificationForm,
  loadNotificationSettings,
  submitNotificationSettings,
} = useNotificationTab(client);

const {
  tmdbQuery,
  tmdbSummary,
  tmdbHasSearched,
  tmdbResults,
  loadingTmdb,
  searchTmdb,
  copyTmdbId,
} = useTmdbTab(client);

const {
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
} = useWebhookNotifyTab(client, webhookReceiveUrl);

const {
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
} = useJobsTab(client);

function updateExpireJobSimple(value: typeof expireJobSimple) {
  expireJobSimple.kind = value.kind;
  expireJobSimple.hour = value.hour;
  expireJobSimple.minute = value.minute;
  expireJobSimple.weekday = value.weekday;
}

async function submitLogin() {
  if (!loginForm.username.trim() || !loginForm.password.trim()) {
    ElMessage.warning("请输入账号和密码");
    return;
  }
  loading.login = true;
  try {
    const { data } = await login("/api", {
      username: loginForm.username.trim(),
      password: loginForm.password,
    });
    authToken.value = data.token;
    localStorage.setItem("emby_auth_token", data.token);
    loginForm.password = "";
    ElMessage.success("登录成功");
    await Promise.all([
      fetchActivities(),
      fetchEmbyStats(),
      fetchUsers(),
      loadNotificationSettings(),
      loadExpireJobCronSettings(),
      fetchRechargeRecords(),
      fetchWebhookNotifyRecords(),
    ]);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "登录失败");
  } finally {
    loading.login = false;
  }
}

function logout() {
  authToken.value = "";
  localStorage.removeItem("emby_auth_token");
  ElMessage.success("已退出登录");
}

async function submitRecharge() {
  if (!rechargeForm.embyUserId.trim()) {
    ElMessage.warning("未选择充值用户");
    return;
  }
  loading.recharge = true;
  try {
    await client().manualRecharge({
      embyUserId: rechargeForm.embyUserId.trim(),
      amount: rechargeForm.amount,
      months: rechargeForm.months,
      note: rechargeForm.note.trim() || undefined,
    });
    ElMessage.success("充值成功");
    rechargeDialogVisible.value = false;
    await fetchRechargeRecords();
    await fetchUsers();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "充值失败");
  } finally {
    loading.recharge = false;
  }
}

async function submitCreateUser() {
  if (!createForm.username.trim()) {
    ElMessage.warning("请先输入用户名");
    return;
  }
  loading.createUser = true;
  try {
    await client().createEmbyUser({
      username: createForm.username.trim(),
      password: createForm.password.trim() || undefined,
      localEmail: createForm.localEmail.trim() || null,
      emailPushEnabled: createForm.emailPushEnabled,
    });
    ElMessage.success("Emby 用户创建成功");
    createDialogVisible.value = false;
    createForm.username = "";
    createForm.password = "";
    createForm.localEmail = "";
    createForm.emailPushEnabled = false;
    await fetchUsers();
  } catch (error: any) {
    const issues = error?.response?.data?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      ElMessage.error(`${issues[0].path || "payload"}: ${issues[0].message}`);
    } else {
      ElMessage.error(error?.response?.data?.message || "创建用户失败");
    }
  } finally {
    loading.createUser = false;
  }
}

function openPasswordDialog(row: UserListItem) {
  passwordEditingUser.value = row;
  passwordForm.password = "";
  passwordDialogVisible.value = true;
}

function openRechargeDialog(row: UserListItem) {
  rechargeEditingUser.value = row;
  rechargeForm.embyUserId = row.embyUserId;
  rechargeForm.amount = 30;
  rechargeForm.months = 1;
  rechargeForm.note = "";
  rechargeDialogVisible.value = true;
}

function openExpiryDialog(row: UserListItem) {
  expiryEditingUser.value = row;
  expiryForm.embyUserId = row.embyUserId;
  expiryForm.endAt = row.membershipEndAt ? new Date(row.membershipEndAt) : new Date();
  expiryDialogVisible.value = true;
}

function handleUserAction(command: string, row: UserListItem) {
  if (command === "policy") {
    openPolicyDialog(row);
    return;
  }
  if (command === "password") {
    openPasswordDialog(row);
    return;
  }
  if (command === "recharge") {
    openRechargeDialog(row);
    return;
  }
  if (command === "expiry") {
    openExpiryDialog(row);
    return;
  }
  if (command === "delete") {
    void removeUser(row);
  }
}

async function submitEndAtUpdate() {
  if (!expiryForm.embyUserId.trim() || !expiryForm.endAt) {
    ElMessage.warning("请选择到期时间");
    return;
  }

  loading.expiry = true;
  try {
    await client().setMembershipEndAt(expiryForm.embyUserId, expiryForm.endAt.toISOString());
    ElMessage.success("到期时间已更新");
    expiryDialogVisible.value = false;
    await fetchUsers();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "更新到期时间失败");
  } finally {
    loading.expiry = false;
  }
}

async function removeUser(row: UserListItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除 Emby 用户 ${row.embyUsername}（${row.embyUserId}）吗？`,
      "删除确认",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
  } catch {
    return;
  }

  loadingUsers.value = true;
  try {
    await client().deleteEmbyUser(row.embyUserId);
    ElMessage.success("用户已删除");
    await fetchUsers();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "删除用户失败");
  } finally {
    loadingUsers.value = false;
  }
}

async function submitPasswordUpdate() {
  if (!passwordEditingUser.value) {
    return;
  }
  const nextPassword = passwordForm.password.trim();
  if (!nextPassword) {
    ElMessage.warning("请输入新密码");
    return;
  }

  loading.passwordSave = true;
  try {
    await client().updateUserPassword(passwordEditingUser.value.embyUserId, nextPassword);
    ElMessage.success("密码修改成功");
    passwordDialogVisible.value = false;
    passwordForm.password = "";
  } catch (error: any) {
    const issues = error?.response?.data?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      ElMessage.error(`${issues[0].path || "payload"}: ${issues[0].message}`);
    } else {
      ElMessage.error(error?.response?.data?.message || "密码修改失败");
    }
  } finally {
    loading.passwordSave = false;
  }
}

async function openPolicyDialog(row: UserListItem) {
  policyEditingUser.value = row;
  policyDialogVisible.value = true;
  loading.policyLoad = true;
  try {
    const { data } = await client().getUserPolicy(row.embyUserId);
    originalPolicy.value = data.policy ?? {};
    localProfile.email = data.local.email ?? "";
    localProfile.emailPushEnabled = Boolean(data.local.emailPushEnabled);
    policyForm.IsAdministrator = Boolean(data.policy.IsAdministrator);
    policyForm.IsHidden = Boolean(data.policy.IsHidden);
    policyForm.IsDisabled = Boolean(data.policy.IsDisabled);
    policyForm.IsHiddenRemotely = Boolean(data.policy.IsHiddenRemotely);
    policyForm.EnableRemoteAccess = Boolean(data.policy.EnableRemoteAccess);
    policyForm.EnableLiveTvAccess = Boolean(data.policy.EnableLiveTvAccess);
    policyForm.EnableMediaPlayback = Boolean(data.policy.EnableMediaPlayback);
    policyForm.EnableAudioPlaybackTranscoding = Boolean(data.policy.EnableAudioPlaybackTranscoding);
    policyForm.EnableVideoPlaybackTranscoding = Boolean(data.policy.EnableVideoPlaybackTranscoding);
    policyForm.EnableContentDeletion = Boolean(data.policy.EnableContentDeletion);
    policyForm.EnableContentDownloading = Boolean(data.policy.EnableContentDownloading);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "加载权限失败");
    policyDialogVisible.value = false;
  } finally {
    loading.policyLoad = false;
  }
}

async function submitPolicyUpdate() {
  if (!policyEditingUser.value) {
    return;
  }
  loading.policySave = true;
  try {
    const merged: EmbyUserPolicy = {
      ...originalPolicy.value,
      ...policyForm,
    };
    await client().updateUserPolicy(policyEditingUser.value.embyUserId, {
      policy: merged,
      embyUsername: policyEditingUser.value.embyUsername,
      localEmail: localProfile.email.trim() ? localProfile.email.trim() : null,
      emailPushEnabled: localProfile.emailPushEnabled,
    });
    ElMessage.success("权限已更新");
    policyDialogVisible.value = false;
    await fetchUsers();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "保存权限失败");
  } finally {
    loading.policySave = false;
  }
}

if (authToken.value) {
  fetchActivities();
  fetchEmbyStats();
  fetchUsers();
  loadNotificationSettings();
  loadExpireJobCronSettings();
  fetchRechargeRecords();
  fetchWebhookNotifyRecords();
}
</script>

<style scoped>
.policy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
}

.span-2 {
  grid-column: span 2;
}

@media (max-width: 760px) {
  .policy-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
