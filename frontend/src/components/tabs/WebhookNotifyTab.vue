<template>
  <div>
    <el-alert type="info" :closable="false" show-icon>
      <template #title>
        <span>Webhook 接收地址：<code>{{ webhookReceiveUrl }}</code></span>
      </template>
    </el-alert>
    <div class="row top-gap">
      <el-button @click="$emit('copy-url')">复制地址</el-button>
      <el-input
        :model-value="query"
        placeholder="搜索收件邮箱/事件类型/状态/用户名"
        @update:model-value="$emit('update:query', $event)"
        @keyup.enter="$emit('search')"
      />
      <el-button type="primary" @click="$emit('search')" :loading="loading">刷新记录</el-button>
    </div>
    <el-table :data="records" stripe class="top-gap">
      <el-table-column prop="createdAt" label="入库时间" min-width="180">
        <template #default="{ row }">
          {{ formatToChinaTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="关联用户" min-width="210">
        <template #default="{ row }">
          {{ row.user?.embyUsername ? `${row.user.embyUsername} (${row.user.embyUserId})` : "-" }}
        </template>
      </el-table-column>
      <el-table-column prop="recipient" label="收件人" min-width="200" />
      <el-table-column prop="eventType" label="事件类型" min-width="220" />
      <el-table-column prop="subject" label="主题" min-width="220" />
      <el-table-column label="发送状态" min-width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'SENT' ? 'success' : row.status === 'FAILED' ? 'danger' : 'info'">
            {{ formatWebhookSendStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="320">
        <template #default="{ row }">
          {{ row.failReason || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="发送时间" min-width="180">
        <template #default="{ row }">
          {{ formatToChinaTime(row.dispatchedAt) }}
        </template>
      </el-table-column>
    </el-table>
    <div class="top-gap row">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        @update:current-page="$emit('update:page', $event)"
        @update:page-size="$emit('update:page-size', $event)"
        @current-change="$emit('page-change')"
        @size-change="$emit('page-size-change')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { WebhookEmailNotificationItem } from "../../api";

defineProps({
  webhookReceiveUrl: {
    type: String,
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  records: {
    type: Array as PropType<WebhookEmailNotificationItem[]>,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  page: {
    type: Number,
    required: true,
  },
  pageSize: {
    type: Number,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatToChinaTime: {
    type: Function as PropType<(value?: string | null) => string>,
    required: true,
  },
  formatWebhookSendStatus: {
    type: Function as PropType<(status: string) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "copy-url"): void;
  (event: "update:query", value: string): void;
  (event: "search"): void;
  (event: "update:page", value: number): void;
  (event: "update:page-size", value: number): void;
  (event: "page-change"): void;
  (event: "page-size-change"): void;
}>();
</script>
