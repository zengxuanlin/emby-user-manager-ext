<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-main">
        <el-input
          :model-value="token"
          type="password"
          placeholder="请输入 ASSRT API Token"
          show-password
          @update:model-value="$emit('update:token', $event)"
        />
        <el-input
          :model-value="query"
          placeholder="输入影视名、剧集名或视频文件名"
          @update:model-value="$emit('update:query', $event)"
          @keyup.enter="$emit('search')"
        />
        <el-button type="primary" @click="$emit('search')" :loading="loading">搜索字幕</el-button>
      </div>
      <div class="toolbar-meta">
        <span class="toolbar-note">{{ summary }}</span>
        <span class="toolbar-note" v-if="quota != null">剩余配额：{{ quota }}/分钟</span>
        <span class="toolbar-note" v-if="fetchedAt">最近查询：{{ formatToChinaTime(fetchedAt) }}</span>
      </div>
    </div>

    <el-alert
      class="top-gap"
      type="info"
      :closable="false"
      title="字幕服务由 assrt.net 提供，下载链接具有时效性，建议现用现取。"
    />

    <div class="top-gap">
      <el-empty v-if="!hasSearched && results.length === 0" description="输入 Token 和关键字后开始搜索字幕" />
      <el-empty v-else-if="hasSearched && results.length === 0" description="没有找到匹配的字幕结果" />
      <div v-else class="subtitle-grid">
        <article v-for="item in results" :key="item.id" class="subtitle-card">
          <div class="subtitle-body">
            <div class="subtitle-title-row">
              <strong>{{ item.nativeName }}</strong>
              <el-tag size="small" type="info">ID {{ item.id }}</el-tag>
            </div>

            <div class="subtitle-actions">
              <el-button size="small" @click="$emit('copy-id', item.id)">复制字幕ID</el-button>
              <el-button size="small" @click="$emit('toggle-detail', item)" :loading="detailLoading[item.id]">
                {{ expandedIds[item.id] ? "收起详情" : "查看详情" }}
              </el-button>
              <el-button
                size="small"
                type="primary"
                plain
                @click="$emit('copy-download-url', item.id)"
                :disabled="!details[item.id]?.downloadUrl"
              >
                复制下载链接
              </el-button>
            </div>

            <div class="subtitle-meta">视频名：{{ item.videoName || "-" }}</div>
            <div class="subtitle-meta">语言：{{ item.languageDesc || "-" }}</div>
            <div class="subtitle-meta">格式：{{ item.subtype || "-" }}</div>
            <div class="subtitle-meta">字幕组：{{ item.releaseSite || "-" }}</div>
            <div class="subtitle-meta">上传时间：{{ item.uploadTime || "-" }}</div>
            <div class="subtitle-meta">评分：{{ item.voteScore ?? 0 }}</div>
            <div class="subtitle-meta">修订版本：{{ item.revision }}</div>
            <div class="subtitle-meta" v-if="item.isMachineTranslated">提示：可能是机器翻译字幕</div>

            <div v-if="expandedIds[item.id]" class="subtitle-detail">
              <div v-if="detailLoading[item.id]" class="subtitle-detail-loading">正在加载字幕详情...</div>
              <template v-else-if="details[item.id]">
                <div class="subtitle-meta">压缩包：{{ details[item.id]?.filename || "-" }}</div>
                <div class="subtitle-meta">标题：{{ details[item.id]?.title || "-" }}</div>
                <div class="subtitle-meta">文件大小：{{ formatFileSize(details[item.id]?.size ?? null) }}</div>
                <div class="subtitle-meta">下载次数：{{ details[item.id]?.downCount ?? "-" }}</div>
                <div class="subtitle-meta">浏览次数：{{ details[item.id]?.viewCount ?? "-" }}</div>
                <div class="subtitle-meta">发布信息：{{ formatProducer(details[item.id]?.producer || null) }}</div>
                <div class="subtitle-filelist" v-if="details[item.id]?.files?.length">
                  <div class="subtitle-filelist-title">压缩包内文件</div>
                  <ul>
                    <li v-for="file in details[item.id]?.files" :key="`${item.id}-${file.name}-${file.size}`">
                      <span>{{ file.name || "未命名文件" }}</span>
                      <span>{{ formatFileSize(file.size) }}</span>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { AssrtSubtitleDetail, AssrtSubtitleSearchItem } from "../../api";

defineProps({
  token: {
    type: String,
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  quota: {
    type: Number as PropType<number | null>,
    default: null,
  },
  fetchedAt: {
    type: String as PropType<string | null>,
    default: null,
  },
  hasSearched: {
    type: Boolean,
    default: false,
  },
  results: {
    type: Array as PropType<AssrtSubtitleSearchItem[]>,
    required: true,
  },
  details: {
    type: Object as PropType<Record<number, AssrtSubtitleDetail | undefined>>,
    required: true,
  },
  expandedIds: {
    type: Object as PropType<Record<number, boolean | undefined>>,
    required: true,
  },
  detailLoading: {
    type: Object as PropType<Record<number, boolean | undefined>>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatToChinaTime: {
    type: Function as PropType<(value: string | null | undefined) => string>,
    required: true,
  },
  formatFileSize: {
    type: Function as PropType<(size: number | null | undefined) => string>,
    required: true,
  },
  formatProducer: {
    type: Function as PropType<(producer: AssrtSubtitleDetail["producer"]) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "update:token", value: string): void;
  (event: "update:query", value: string): void;
  (event: "search"): void;
  (event: "toggle-detail", item: AssrtSubtitleSearchItem): void;
  (event: "copy-id", id: number): void;
  (event: "copy-download-url", id: number): void;
}>();
</script>

<style scoped>
.toolbar {
  display: grid;
  gap: 10px;
}

.toolbar-main {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr) auto;
  gap: 10px;
}

.toolbar-meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-note {
  color: #606266;
  font-size: 13px;
}

.subtitle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.subtitle-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  background: #fff;
}

.subtitle-body {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.subtitle-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.subtitle-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.subtitle-meta {
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.subtitle-detail {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
  display: grid;
  gap: 8px;
}

.subtitle-detail-loading {
  color: #909399;
  font-size: 13px;
}

.subtitle-filelist {
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px;
}

.subtitle-filelist-title {
  font-size: 13px;
  color: #334155;
  margin-bottom: 8px;
}

.subtitle-filelist ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.subtitle-filelist li {
  color: #475569;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 760px) {
  .toolbar-main {
    grid-template-columns: 1fr;
  }

  .subtitle-grid {
    grid-template-columns: 1fr;
  }
}
</style>
