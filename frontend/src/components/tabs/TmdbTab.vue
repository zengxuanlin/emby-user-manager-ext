<template>
  <div>
    <div class="row">
      <el-input
        :model-value="query"
        placeholder="输入电影或剧集关键字"
        @update:model-value="$emit('update:query', $event)"
        @keyup.enter="$emit('search')"
      />
      <el-button type="primary" @click="$emit('search')" :loading="loading">搜索</el-button>
      <span>{{ summary }}</span>
    </div>

    <div class="top-gap">
      <el-empty v-if="!hasSearched && results.length === 0" description="输入关键字后开始搜索 TMDB" />
      <el-empty v-else-if="hasSearched && results.length === 0" description="没有找到匹配的 TMDB 结果" />
      <div v-else class="tmdb-grid">
        <article v-for="item in results" :key="`${item.mediaType}-${item.id}`" class="tmdb-card">
          <div class="tmdb-poster-wrap">
            <img
              v-if="item.posterUrl"
              :src="item.posterUrl"
              :alt="item.title"
              class="tmdb-poster"
            />
            <div v-else class="tmdb-poster-fallback">
              {{ item.mediaType === "movie" ? "电影" : "剧集" }}
            </div>
          </div>

          <div class="tmdb-body">
            <div class="tmdb-title-row">
              <strong>{{ item.title }}</strong>
              <el-tag size="small" :type="item.mediaType === 'movie' ? 'success' : 'warning'">
                {{ item.mediaType === "movie" ? "电影" : "剧集" }}
              </el-tag>
            </div>

            <div class="tmdb-actions">
              <el-button size="small" @click="$emit('copy-id', item.id)">复制 TMDB ID</el-button>
              <el-button
                size="small"
                type="primary"
                plain
                tag="a"
                :href="getTmdbPageUrl(item)"
                target="_blank"
                rel="noreferrer"
              >
                打开 TMDB 页面
              </el-button>
            </div>

            <div class="tmdb-meta">TMDB ID：{{ item.id }}</div>
            <div class="tmdb-meta" v-if="item.originalTitle && item.originalTitle !== item.title">
              原始标题：{{ item.originalTitle }}
            </div>
            <div class="tmdb-meta">上映/首播：{{ item.releaseDate || "-" }}</div>
            <div class="tmdb-meta">评分：{{ formatTmdbRating(item.rating, item.voteCount) }}</div>
            <div class="tmdb-meta">语言：{{ item.language || "-" }}</div>
            <div class="tmdb-meta">状态：{{ item.status || "-" }}</div>
            <div class="tmdb-meta">类型标签：{{ item.genres.length ? item.genres.join(" / ") : "-" }}</div>
            <div class="tmdb-meta" v-if="item.mediaType === 'movie'">片长：{{ formatRuntime(item.runtime) }}</div>
            <div class="tmdb-meta" v-else>
              剧集信息：{{ formatSeasonEpisode(item.seasonCount, item.episodeCount) }}
            </div>
            <div class="tmdb-meta">IMDb：{{ item.imdbId || "-" }}</div>
            <div class="tmdb-tagline" v-if="item.tagline">{{ item.tagline }}</div>
            <p class="tmdb-overview">{{ item.overview || "暂无剧情简介" }}</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { TmdbSearchItem } from "../../api";

defineProps({
  query: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  hasSearched: {
    type: Boolean,
    default: false,
  },
  results: {
    type: Array as PropType<TmdbSearchItem[]>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatTmdbRating: {
    type: Function as PropType<(rating: number | null, voteCount: number | null) => string>,
    required: true,
  },
  formatRuntime: {
    type: Function as PropType<(runtime: number | null) => string>,
    required: true,
  },
  formatSeasonEpisode: {
    type: Function as PropType<(seasonCount: number | null, episodeCount: number | null) => string>,
    required: true,
  },
  getTmdbPageUrl: {
    type: Function as PropType<(item: TmdbSearchItem) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "update:query", value: string): void;
  (event: "search"): void;
  (event: "copy-id", id: number): void;
}>();
</script>

<style scoped>
.tmdb-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.tmdb-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  display: grid;
  grid-template-columns: 1fr;
}

.tmdb-poster-wrap {
  background: linear-gradient(135deg, #e2e8f0, #f8fafc);
  aspect-ratio: 16 / 9;
}

.tmdb-poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #f8fafc;
}

.tmdb-poster-fallback {
  height: 100%;
  min-height: 240px;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 16px;
}

.tmdb-body {
  padding: 16px;
  display: grid;
  gap: 8px;
  align-content: start;
}

.tmdb-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tmdb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tmdb-meta {
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}

.tmdb-tagline {
  color: #0f766e;
  font-size: 13px;
  line-height: 1.5;
}

.tmdb-overview {
  margin: 0;
  color: #303133;
  font-size: 14px;
  line-height: 1.7;
}

@media (max-width: 760px) {
  .tmdb-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 761px) and (max-width: 1180px) {
  .tmdb-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
