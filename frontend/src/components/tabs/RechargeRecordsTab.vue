<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-main">
        <el-input
          :model-value="query"
          placeholder="搜索 Emby 用户ID/用户名/管理员"
          @update:model-value="$emit('update:query', $event)"
          @keyup.enter="$emit('search')"
        />
        <el-button @click="$emit('search')" :loading="loading">查询记录</el-button>
      </div>
    </div>
    <el-table :data="records" stripe class="top-gap">
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
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { RechargeRecordItem } from "../../api";

defineProps({
  query: {
    type: String,
    required: true,
  },
  records: {
    type: Array as PropType<RechargeRecordItem[]>,
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
});

defineEmits<{
  (event: "update:query", value: string): void;
  (event: "search"): void;
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

@media (max-width: 760px) {
  .toolbar-main {
    grid-template-columns: 1fr;
  }
}
</style>
