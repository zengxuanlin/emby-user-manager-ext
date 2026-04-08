<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-main">
        <el-button type="primary" @click="$emit('refresh')" :loading="loading">刷新统计</el-button>
      </div>
      <div class="toolbar-meta">
        <span class="toolbar-note">最近刷新：{{ formatToChinaTime(fetchedAt) }}</span>
      </div>
    </div>

    <div class="top-gap emby-stats-sections">
      <section class="emby-stats-section">
        <div class="emby-stats-head">
          <div>
            <h3>最近入库</h3>
            <p>按入库时间倒序展示最新 10 条电影/剧集</p>
          </div>
          <el-tag type="success" effect="plain">{{ latest.length }}</el-tag>
        </div>

        <el-empty v-if="latest.length === 0" description="暂无最近入库数据" />
        <div v-else class="emby-stats-grid">
          <article v-for="item in latest" :key="`latest-${item.itemId}`" class="emby-stats-card">
            <div class="emby-stats-poster-wrap">
              <img
                v-if="getStatsImageUrl(item)"
                :src="getStatsImageUrl(item)"
                :alt="item.name"
                class="emby-stats-poster"
              />
              <div v-else class="emby-stats-poster-fallback">{{ formatMediaType(item.type) }}</div>
            </div>

            <div class="emby-stats-body">
              <div class="emby-stats-title">
                <strong>{{ item.name }}</strong>
                <el-tag size="small" type="success">{{ formatMediaType(item.type) }}</el-tag>
              </div>
              <div class="emby-stats-meta">入库时间：{{ formatToChinaTime(item.dateCreated) }}</div>
              <div class="emby-stats-meta">上映日期：{{ formatToChinaTime(item.premiereDate) }}</div>
              <div class="emby-stats-meta">年份：{{ item.productionYear ?? "-" }}</div>
              <div class="emby-stats-meta">评分：{{ formatRating(item.communityRating) }}</div>
              <div class="emby-stats-meta">时长：{{ formatRuntimeTicks(item.runtimeTicks) }}</div>
              <p class="emby-stats-overview">{{ item.overview || "暂无简介" }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="emby-stats-section">
        <div class="emby-stats-head">
          <div>
            <h3>热门观看</h3>
            <p>按播放次数倒序展示播放最多的 10 条电影/剧集</p>
          </div>
          <el-tag type="warning" effect="plain">{{ popular.length }}</el-tag>
        </div>

        <el-empty v-if="popular.length === 0" description="暂无热门观看数据" />
        <div v-else class="emby-stats-grid">
          <article v-for="item in popular" :key="`popular-${item.itemId}`" class="emby-stats-card">
            <div class="emby-stats-poster-wrap">
              <img
                v-if="getStatsImageUrl(item)"
                :src="getStatsImageUrl(item)"
                :alt="item.name"
                class="emby-stats-poster"
              />
              <div v-else class="emby-stats-poster-fallback">{{ formatMediaType(item.type) }}</div>
            </div>

            <div class="emby-stats-body">
              <div class="emby-stats-title">
                <strong>{{ item.name }}</strong>
                <el-tag size="small" type="warning">{{ formatMediaType(item.type) }}</el-tag>
              </div>
              <div class="emby-stats-meta">播放次数：{{ item.playCount ?? 0 }}</div>
              <div class="emby-stats-meta">最近播放：{{ formatToChinaTime(item.lastPlayedDate) }}</div>
              <div class="emby-stats-meta">上映日期：{{ formatToChinaTime(item.premiereDate) }}</div>
              <div class="emby-stats-meta">年份：{{ item.productionYear ?? "-" }}</div>
              <div class="emby-stats-meta">评分：{{ formatRating(item.communityRating) }}</div>
              <div class="emby-stats-meta">时长：{{ formatRuntimeTicks(item.runtimeTicks) }}</div>
              <p class="emby-stats-overview">{{ item.overview || "暂无简介" }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { EmbyStatsItem } from "../../api";

defineProps({
  fetchedAt: {
    type: String as PropType<string | null>,
    default: null,
  },
  latest: {
    type: Array as PropType<EmbyStatsItem[]>,
    required: true,
  },
  popular: {
    type: Array as PropType<EmbyStatsItem[]>,
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
  getStatsImageUrl: {
    type: Function as PropType<(item: EmbyStatsItem) => string>,
    required: true,
  },
  formatRuntimeTicks: {
    type: Function as PropType<(runtimeTicks: number | null) => string>,
    required: true,
  },
  formatMediaType: {
    type: Function as PropType<(type: string | null) => string>,
    required: true,
  },
  formatRating: {
    type: Function as PropType<(rating: number | null) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "refresh"): void;
}>();
</script>

<style scoped>
.toolbar {
  display: grid;
  gap: 10px;
}

.toolbar-main {
  display: flex;
  justify-content: flex-start;
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

.emby-stats-sections {
  display: grid;
  gap: 18px;
}

.emby-stats-section {
  display: grid;
  gap: 12px;
}

.emby-stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.emby-stats-head h3 {
  margin: 0;
  font-size: 18px;
}

.emby-stats-head p {
  margin: 4px 0 0;
  color: #909399;
  font-size: 13px;
}

.emby-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.emby-stats-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  display: grid;
  grid-template-columns: 1fr;
}

.emby-stats-poster-wrap {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #dbeafe, #eff6ff 45%, #f8fafc);
}

.emby-stats-poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #f8fafc;
}

.emby-stats-poster-fallback {
  height: 100%;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 16px;
}

.emby-stats-body {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.emby-stats-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.emby-stats-meta {
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}

.emby-stats-overview {
  margin: 0;
  color: #303133;
  font-size: 14px;
  line-height: 1.7;
}

@media (max-width: 760px) {
  .emby-stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 761px) and (max-width: 1180px) {
  .emby-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
