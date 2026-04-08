<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-main">
        <el-input
          :model-value="queryId"
          placeholder="输入 Emby User ID"
          @update:model-value="$emit('update:query-id', $event)"
        />
        <el-button type="primary" @click="$emit('search')" :loading="loading">查询详情</el-button>
      </div>
    </div>
    <pre class="result">{{ result }}</pre>
  </div>
</template>

<script setup lang="ts">
defineProps({
  queryId: {
    type: String,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits<{
  (event: "update:query-id", value: string): void;
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
