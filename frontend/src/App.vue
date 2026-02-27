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
          <div class="row">
            <el-button type="primary" @click="fetchActivities" :loading="loading.activities">刷新活动</el-button>
            <span>最近刷新：{{ formatToChinaTime(activitiesFetchedAt) }}</span>
          </div>

          <div class="top-gap">
            <el-empty v-if="activities.length === 0" description="暂无实时活动" />
            <div v-else class="activity-cards">
              <div class="activity-card" v-for="item in activities" :key="item.sessionId || `${item.userName}-${item.deviceName}-${item.lastActivityAt}`">
                <div class="activity-title">
                  <strong>{{ item.userName || "未知账号" }}</strong>
                  <el-tag size="small" :type="item.playbackState === 'PLAYING' ? 'success' : item.playbackState === 'PAUSED' ? 'warning' : 'info'">
                    {{ item.playbackState }}
                  </el-tag>
                </div>
                <div>设备：{{ item.deviceName || "-" }}</div>
                <div>客户端：{{ item.client || "-" }}</div>
                <div>内容：{{ item.itemName || "-" }}</div>
                <div>进度：{{ formatPlaybackProgress(item.positionTicks, item.runtimeTicks) }}</div>
                <div>最近活动：{{ formatToChinaTime(item.lastActivityAt) }}</div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="用户管理" name="users">
          <el-alert
            title="支持直接新增 Emby 用户；已有用户会从 Emby 拉取，不需要手动输入 Emby User ID。"
            type="info"
            show-icon
            :closable="false"
          />

          <div class="row top-gap">
            <el-input v-model="search" placeholder="搜索 Emby 用户ID/用户名" @keyup.enter="fetchUsers" />
            <el-button type="primary" @click="createDialogVisible = true">新增 Emby 用户</el-button>
            <el-button @click="fetchUsers" :loading="loading.users">查询</el-button>
            <el-button type="primary" plain @click="syncUsersFromEmby" :loading="loading.syncUsers">
              同步 Emby 用户到本地
            </el-button>
            <span>{{ syncResult }}</span>
          </div>

          <el-table :data="users" stripe class="top-gap">
            <el-table-column prop="embyUserId" label="Emby ID" min-width="120" />
            <el-table-column prop="embyUsername" label="用户名" min-width="120" />
            <el-table-column label="创建时间" min-width="200">
              <template #default="{ row }">
                {{ formatToChinaTime(row.embyCreatedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="Emby状态" min-width="120">
              <template #default="{ row }">
                <el-tag :type="row.embyDisabled ? 'danger' : 'success'">
                  {{ row.embyDisabled ? "DISABLED" : "ENABLED" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="本地关联" min-width="120">
              <template #default="{ row }">
                <el-tag :type="row.localLinked ? 'success' : 'warning'">
                  {{ row.localLinked ? "已关联" : "未关联" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="email" label="邮箱" min-width="180" />
            <el-table-column label="邮箱推送" min-width="120">
              <template #default="{ row }">
                <el-tag :type="row.emailPushEnabled ? 'success' : 'info'">
                  {{ row.emailPushEnabled ? "开启" : "关闭" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="120">
              <template #default="{ row }">
                <el-tag :type="row.membershipStatus === 'ACTIVE' ? 'success' : 'info'">
                  {{ row.membershipStatus || "N/A" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="到期时间" min-width="220">
              <template #default="{ row }">
                {{ formatToChinaTime(row.membershipEndAt) }}
              </template>
            </el-table-column>
            <el-table-column label="最近充值金额" min-width="130">
              <template #default="{ row }">
                {{ row.lastRechargeAmount ?? "-" }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="130" fixed="right">
              <template #default="{ row }">
                <el-dropdown @command="(command: string) => handleUserAction(command, row)">
                  <el-button type="primary" plain>
                    操作
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="policy">编辑权限</el-dropdown-item>
                      <el-dropdown-item command="password">修改密码</el-dropdown-item>
                      <el-dropdown-item command="recharge">充值</el-dropdown-item>
                      <el-dropdown-item command="expiry">修改到期时间</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <span style="color: #d03050;">删除用户</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="充值记录" name="recharge-records">
          <div class="row">
            <el-input
              v-model="rechargeRecordQuery"
              placeholder="搜索 Emby 用户ID/用户名/管理员"
              @keyup.enter="fetchRechargeRecords"
            />
            <el-button @click="fetchRechargeRecords" :loading="loading.rechargeList">查询记录</el-button>
          </div>
          <el-table :data="rechargeRecords" stripe class="top-gap">
            <el-table-column prop="createdAt" label="充值时间" min-width="180">
              <template #default="{ row }">
                {{ formatToChinaTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="用户" min-width="200">
              <template #default="{ row }">
                {{ row.user.embyUsername }} ({{ row.user.embyUserId }})
              </template>
            </el-table-column>
            <el-table-column prop="adminName" label="操作管理员" min-width="120" />
            <el-table-column prop="amount" label="充值金额" min-width="100" />
            <el-table-column prop="months" label="月数" min-width="80" />
            <el-table-column label="原到期" min-width="180">
              <template #default="{ row }">
                {{ formatToChinaTime(row.oldEndAt) }}
              </template>
            </el-table-column>
            <el-table-column label="新到期" min-width="180">
              <template #default="{ row }">
                {{ formatToChinaTime(row.newEndAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="note" label="备注" min-width="180" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="会员查询" name="membership">
          <div class="row">
            <el-input v-model="membershipQueryId" placeholder="输入 Emby User ID" />
            <el-button type="primary" @click="fetchMembership" :loading="loading.membership">查询详情</el-button>
          </div>
          <pre class="result">{{ membershipResult }}</pre>
        </el-tab-pane>

        <el-tab-pane label="通知设置" name="notification">
          <div class="grid cols-2">
            <el-input v-model="notificationForm.senderEmail" placeholder="发送人邮箱地址" />
            <el-input
              v-model="notificationForm.emailAuthCode"
              type="password"
              show-password
              placeholder="邮箱授权码"
            />
            <el-input v-model="notificationForm.smtpHost" placeholder="SMTP Host（如 smtp.qq.com）" />
            <el-input-number
              v-model="notificationForm.smtpPort"
              :min="1"
              :max="65535"
              controls-position="right"
            />
            <div class="row">
              <span>SMTP 使用 SSL/TLS</span>
              <el-switch v-model="notificationForm.smtpSecure" />
            </div>
            <div class="row">
              <span>是否开启入库推送</span>
              <el-switch v-model="notificationForm.ingestionPushEnabled" />
            </div>
          </div>
          <div class="row top-gap">
            <el-button type="primary" @click="submitNotificationSettings" :loading="loading.notifySettings">
              保存通知设置
            </el-button>
            <span>{{ notifyResult }}</span>
          </div>
        </el-tab-pane>

        <el-tab-pane label="任务与系统" name="jobs">
          <div class="grid cols-2">
            <div class="row">
              <span>到期任务调度模式</span>
              <el-radio-group v-model="expireJobCronMode">
                <el-radio-button label="simple">简易配置</el-radio-button>
                <el-radio-button label="custom">Cron表达式</el-radio-button>
              </el-radio-group>
            </div>

            <template v-if="expireJobCronMode === 'simple'">
              <div class="row">
                <span>执行周期</span>
                <el-radio-group v-model="expireJobSimple.kind">
                  <el-radio-button label="daily">每天</el-radio-button>
                  <el-radio-button label="weekly">每周</el-radio-button>
                </el-radio-group>
              </div>
              <div class="row">
                <span>执行时间（小时:分钟）</span>
                <small style="color: #909399;">小时范围 0-23，分钟范围 0-59</small>
              </div>
              <div class="grid cols-3">
                <el-input-number v-model="expireJobSimple.hour" :min="0" :max="23" controls-position="right" placeholder="小时" />
                <el-input-number
                  v-model="expireJobSimple.minute"
                  :min="0"
                  :max="59"
                  controls-position="right"
                  placeholder="分钟"
                />
                <el-select v-if="expireJobSimple.kind === 'weekly'" v-model="expireJobSimple.weekday">
                  <el-option v-for="option in weekDayOptions" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
              </div>
              <div>执行预览：<code>{{ getSimpleExpireCronHumanText() }}</code></div>
              <div>预览 Cron：<code>{{ getSimpleExpireCron() }}</code></div>
            </template>

            <template v-else>
              <el-input v-model="expireJobCronInput" placeholder="例如: 5 2 * * *" />
            </template>

            <div class="row">
              <el-button type="primary" @click="submitExpireJobCron" :loading="loading.jobCron">
                保存调度配置
              </el-button>
              <span>{{ expireJobCronResult }}</span>
            </div>
          </div>

          <div class="row top-gap">
            <el-button type="danger" @click="runExpireJob" :loading="loading.job">立即执行到期任务</el-button>
            <span>{{ jobResult }}</span>
          </div>
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
import { ArrowDown } from "@element-plus/icons-vue";
import {
  createAdminClient,
  login,
  type EmbyActivityItem,
  type EmbyUserPolicy,
  type NotificationSettings,
  type RechargeRecordItem,
  type UserListItem,
} from "./api";

const authToken = ref(localStorage.getItem("emby_auth_token") || "");
const isAuthenticated = computed(() => Boolean(authToken.value));
const loginForm = reactive({
  username: "",
  password: "",
});

const tab = ref("activity");
const search = ref("");
const users = ref<UserListItem[]>([]);
const activities = ref<EmbyActivityItem[]>([]);
const activitiesFetchedAt = ref<string | null>(null);
const membershipQueryId = ref("");
const membershipResult = ref("尚未查询");
const jobResult = ref("尚未执行");
const syncResult = ref("尚未同步");
const notifyResult = ref("尚未保存");
const expireJobCronResult = ref("尚未保存");
const rechargeRecords = ref<RechargeRecordItem[]>([]);
const rechargeRecordQuery = ref("");
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

const notificationForm = reactive<NotificationSettings>({
  senderEmail: "",
  emailAuthCode: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  ingestionPushEnabled: true,
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

const loading = reactive({
  login: false,
  activities: false,
  users: false,
  recharge: false,
  expiry: false,
  rechargeList: false,
  membership: false,
  job: false,
  syncUsers: false,
  createUser: false,
  passwordSave: false,
  notifySettings: false,
  jobCron: false,
  policyLoad: false,
  policySave: false,
});

function client() {
  return createAdminClient({
    baseUrl: "/api",
    authToken: authToken.value,
  });
}

function formatToChinaTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatPlaybackProgress(positionTicks: number | null, runtimeTicks: number | null): string {
  if (!positionTicks || !runtimeTicks || runtimeTicks <= 0) {
    return "-";
  }
  const ratio = Math.max(0, Math.min(100, (positionTicks / runtimeTicks) * 100));
  return `${ratio.toFixed(1)}%`;
}

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
    const weekDayLabel = weekDayOptions.find((item) => item.value === expireJobSimple.weekday)?.label ?? "周一";
    return `${weekDayLabel} ${hour}:${minute}`;
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

async function fetchActivities() {
  loading.activities = true;
  try {
    const { data } = await client().listActivities();
    activities.value = data.activities;
    activitiesFetchedAt.value = data.fetchedAt;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "查询实时活动失败");
  } finally {
    loading.activities = false;
  }
}

async function loadExpireJobCronSettings() {
  loading.jobCron = true;
  try {
    const { data } = await client().getExpireJobSettings();
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
    loading.jobCron = false;
  }
}

async function submitExpireJobCron() {
  loading.jobCron = true;
  try {
    const expireJobCron = expireJobCronMode.value === "simple"
      ? getSimpleExpireCron()
      : expireJobCronInput.value.trim();
    const { data } = await client().updateExpireJobSettings({ expireJobCron });
    expireJobCronInput.value = data.settings.expireJobCron;
    expireJobCronResult.value = `保存成功: ${data.settings.expireJobCron}`;
    ElMessage.success("到期任务调度已更新");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "保存到期任务调度失败");
  } finally {
    loading.jobCron = false;
  }
}

async function fetchUsers() {
  loading.users = true;
  try {
    const { data } = await client().listUsers(search.value);
    users.value = data.users;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "查询用户失败");
  } finally {
    loading.users = false;
  }
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
      fetchUsers(),
      loadNotificationSettings(),
      loadExpireJobCronSettings(),
      fetchRechargeRecords(),
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

async function fetchRechargeRecords() {
  loading.rechargeList = true;
  try {
    const { data } = await client().listRecharges(rechargeRecordQuery.value.trim(), 200);
    rechargeRecords.value = data.records;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "查询充值记录失败");
  } finally {
    loading.rechargeList = false;
  }
}

async function fetchMembership() {
  loading.membership = true;
  try {
    const { data } = await client().getMembership(membershipQueryId.value.trim());
    membershipResult.value = JSON.stringify(data, null, 2);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "查询失败");
  } finally {
    loading.membership = false;
  }
}

async function runExpireJob() {
  loading.job = true;
  try {
    const { data } = await client().runExpireJob();
    jobResult.value = JSON.stringify(data);
    ElMessage.success("任务已执行");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "任务执行失败");
  } finally {
    loading.job = false;
  }
}

async function syncUsersFromEmby() {
  loading.syncUsers = true;
  try {
    const { data } = await client().syncEmbyUsers();
    syncResult.value = `同步完成: total=${data.total}, created=${data.created}, updated=${data.updated}`;
    ElMessage.success("用户同步成功");
    await fetchUsers();
  } catch (error: any) {
    syncResult.value = `同步失败: ${error?.response?.data?.message || error?.message || "未知错误"}`;
    ElMessage.error("用户同步失败");
  } finally {
    loading.syncUsers = false;
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

  loading.users = true;
  try {
    await client().deleteEmbyUser(row.embyUserId);
    ElMessage.success("用户已删除");
    await fetchUsers();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "删除用户失败");
  } finally {
    loading.users = false;
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

async function loadNotificationSettings() {
  loading.notifySettings = true;
  try {
    const { data } = await client().getNotificationSettings();
    notificationForm.senderEmail = data.settings.senderEmail ?? "";
    notificationForm.emailAuthCode = data.settings.emailAuthCode ?? "";
    notificationForm.smtpHost = data.settings.smtpHost ?? "";
    notificationForm.smtpPort = Number(data.settings.smtpPort ?? 465);
    notificationForm.smtpSecure = Boolean(data.settings.smtpSecure);
    notificationForm.ingestionPushEnabled = Boolean(data.settings.ingestionPushEnabled);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "加载通知设置失败");
  } finally {
    loading.notifySettings = false;
  }
}

async function submitNotificationSettings() {
  loading.notifySettings = true;
  try {
    const { data } = await client().updateNotificationSettings({
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
    loading.notifySettings = false;
  }
}

if (authToken.value) {
  fetchActivities();
  fetchUsers();
  loadNotificationSettings();
  loadExpireJobCronSettings();
  fetchRechargeRecords();
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

.activity-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.activity-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  display: grid;
  gap: 4px;
}

.activity-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

@media (max-width: 760px) {
  .policy-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
  .activity-cards {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 761px) and (max-width: 1180px) {
  .activity-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
