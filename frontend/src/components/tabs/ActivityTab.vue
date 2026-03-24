<template>
  <div>
    <div class="row">
      <el-button type="primary" @click="$emit('refresh')" :loading="loading">刷新活动</el-button>
      <span>最近刷新：{{ formatToChinaTime(fetchedAt) }}</span>
    </div>

    <div class="top-gap">
      <el-empty v-if="activities.length === 0" description="暂无实时活动" />
      <div v-else class="activity-sections">
        <section class="activity-section">
          <div class="activity-section-head">
            <div>
              <h3>正在播放</h3>
              <p>当前正在观看的会话</p>
            </div>
            <el-tag type="success" effect="plain">{{ playingActivities.length }}</el-tag>
          </div>

          <el-empty v-if="playingActivities.length === 0" description="当前没有正在播放的内容" />
          <div v-else class="playing-cards">
            <article
              v-for="item in playingActivities"
              :key="item.sessionId || `${item.userName}-${item.deviceName}-${item.lastActivityAt}`"
              class="playing-card"
            >
              <div class="playing-poster-wrap">
                <img
                  v-if="getActivityImageUrl(item)"
                  :src="getActivityImageUrl(item)"
                  :alt="item.itemName || '正在播放封面'"
                  class="playing-poster"
                />
                <div v-else class="playing-poster-fallback">
                  <span>{{ item.itemType || "媒体" }}</span>
                </div>
                <el-tag class="playing-state-tag" size="small" type="success">播放中</el-tag>
              </div>

              <div class="playing-body">
                <div class="activity-title">
                  <strong>{{ item.itemName || "未知内容" }}</strong>
                </div>
                <div class="activity-meta">账号：{{ item.userName || "未知账号" }}</div>
                <div class="activity-meta">设备：{{ item.deviceName || "-" }}</div>
                <div class="activity-meta">客户端：{{ item.client || "-" }}</div>
                <div class="activity-meta">类型：{{ item.itemType || "-" }}</div>
                <div class="activity-meta">进度：{{ formatPlaybackProgress(item.positionTicks, item.runtimeTicks) }}</div>
                <div class="activity-meta">最近活动：{{ formatToChinaTime(item.lastActivityAt) }}</div>
              </div>
            </article>
          </div>
        </section>

        <section class="activity-section">
          <div class="activity-section-head">
            <div>
              <h3>活动动态</h3>
              <p>暂停、空闲或最近有活动的会话</p>
            </div>
            <el-tag type="info" effect="plain">{{ nonPlayingActivities.length }}</el-tag>
          </div>

          <el-empty v-if="nonPlayingActivities.length === 0" description="暂无其他活动动态" />
          <div v-else class="activity-cards">
            <div
              class="activity-card"
              v-for="item in nonPlayingActivities"
              :key="item.sessionId || `${item.userName}-${item.deviceName}-${item.lastActivityAt}`"
            >
              <div class="activity-title">
                <strong>{{ item.userName || "未知账号" }}</strong>
                <el-tag size="small" :type="item.playbackState === 'PAUSED' ? 'warning' : 'info'">
                  {{ formatActivityState(item.playbackState) }}
                </el-tag>
              </div>
              <div class="activity-meta">设备：{{ item.deviceName || "-" }}</div>
              <div class="activity-meta">客户端：{{ item.client || "-" }}</div>
              <div class="activity-meta">内容：{{ item.itemName || "-" }}</div>
              <div class="activity-meta">进度：{{ formatPlaybackProgress(item.positionTicks, item.runtimeTicks) }}</div>
              <div class="activity-meta">最近活动：{{ formatToChinaTime(item.lastActivityAt) }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { EmbyActivityItem } from "../../api";

const props = defineProps({
  activities: {
    type: Array as PropType<EmbyActivityItem[]>,
    required: true,
  },
  fetchedAt: {
    type: String,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatToChinaTime: {
    type: Function as PropType<(value?: string | null) => string>,
    required: true,
  },
  formatPlaybackProgress: {
    type: Function as PropType<(positionTicks: number | null, runtimeTicks: number | null) => string>,
    required: true,
  },
  formatActivityState: {
    type: Function as PropType<(state: EmbyActivityItem["playbackState"]) => string>,
    required: true,
  },
  getActivityImageUrl: {
    type: Function as PropType<(item: EmbyActivityItem) => string>,
    required: true,
  },
});

defineEmits<{
  (event: "refresh"): void;
}>();

const playingActivities = computed(() =>
  props.activities.filter((item) => item.playbackState === "PLAYING"),
);

const nonPlayingActivities = computed(() =>
  props.activities.filter((item) => item.playbackState !== "PLAYING"),
);
</script>

<style scoped>
.activity-sections {
  display: grid;
  gap: 18px;
}

.activity-section {
  display: grid;
  gap: 12px;
}

.activity-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.activity-section-head h3 {
  margin: 0;
  font-size: 18px;
}

.activity-section-head p {
  margin: 4px 0 0;
  color: #909399;
  font-size: 13px;
}

.playing-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.playing-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 1));
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.playing-poster-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #dbeafe, #eff6ff 45%, #f8fafc);
}

.playing-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.playing-poster-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 14px;
  letter-spacing: 0.08em;
}

.playing-state-tag {
  position: absolute;
  top: 12px;
  right: 12px;
}

.playing-body {
  padding: 14px;
  display: grid;
  gap: 6px;
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

.activity-meta {
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}

.activity-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

@media (max-width: 760px) {
  .playing-cards,
  .activity-cards {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 761px) and (max-width: 1180px) {
  .playing-cards {
    grid-template-columns: 1fr;
  }

  .activity-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
