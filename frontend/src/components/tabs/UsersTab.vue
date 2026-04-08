<template>
  <div>
    <el-alert
      title="支持直接新增 Emby 用户；已有用户会从 Emby 拉取，不需要手动输入 Emby User ID。"
      type="info"
      show-icon
      :closable="false"
    />

    <div class="toolbar top-gap">
      <div class="toolbar-main">
        <el-input
          :model-value="search"
          placeholder="搜索 Emby 用户ID/用户名"
          @update:model-value="$emit('update:search', $event)"
          @keyup.enter="$emit('fetch-users')"
        />
        <el-button @click="$emit('fetch-users')" :loading="loadingUsers">查询</el-button>
      </div>
      <div class="toolbar-meta">
        <div class="toolbar-actions">
          <el-button type="primary" @click="$emit('open-create-dialog')">新增 Emby 用户</el-button>
          <el-button type="primary" plain @click="$emit('sync-users')" :loading="loadingSyncUsers">
            同步 Emby 用户到本地
          </el-button>
        </div>
        <span class="toolbar-note">{{ syncResult }}</span>
      </div>
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
            {{ row.embyDisabled ? "禁用" : "启用" }}
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
            {{ formatMembershipStatus(row.membershipStatus) }}
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
          <el-dropdown @command="(command: string) => $emit('user-action', command, row)">
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
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import { ArrowDown } from "@element-plus/icons-vue";
import type { UserListItem } from "../../api";

defineProps({
  search: {
    type: String,
    required: true,
  },
  users: {
    type: Array as PropType<UserListItem[]>,
    required: true,
  },
  syncResult: {
    type: String,
    required: true,
  },
  loadingUsers: {
    type: Boolean,
    default: false,
  },
  loadingSyncUsers: {
    type: Boolean,
    default: false,
  },
  formatToChinaTime: {
    type: Function as PropType<(value?: string | null) => string>,
    required: true,
  },
  formatMembershipStatus: {
    type: Function as PropType<(status?: UserListItem["membershipStatus"]) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "update:search", value: string): void;
  (event: "fetch-users"): void;
  (event: "open-create-dialog"): void;
  (event: "sync-users"): void;
  (event: "user-action", command: string, row: UserListItem): void;
}>();
</script>

<style scoped>
.toolbar {
  display: grid;
  gap: 10px;
}

.toolbar-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.toolbar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-note {
  color: #606266;
  font-size: 13px;
}

@media (max-width: 760px) {
  .toolbar-main {
    grid-template-columns: 1fr;
  }
}
</style>
