<template>
  <div>
    <div class="grid cols-2">
      <div class="row">
        <span>到期任务调度模式</span>
        <el-radio-group :model-value="cronMode" @update:model-value="$emit('update:cron-mode', $event)">
          <el-radio-button label="simple">简易配置</el-radio-button>
          <el-radio-button label="custom">Cron表达式</el-radio-button>
        </el-radio-group>
      </div>

      <template v-if="cronMode === 'simple'">
        <div class="row">
          <span>执行周期</span>
          <el-radio-group :model-value="simple.kind" @update:model-value="updateSimple('kind', $event)">
            <el-radio-button label="daily">每天</el-radio-button>
            <el-radio-button label="weekly">每周</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <span>执行时间（小时:分钟）</span>
          <small style="color: #909399;">小时范围 0-23，分钟范围 0-59</small>
        </div>
        <div class="grid cols-3">
          <el-input-number
            :model-value="simple.hour"
            :min="0"
            :max="23"
            controls-position="right"
            placeholder="小时"
            @update:model-value="updateSimple('hour', $event ?? 0)"
          />
          <el-input-number
            :model-value="simple.minute"
            :min="0"
            :max="59"
            controls-position="right"
            placeholder="分钟"
            @update:model-value="updateSimple('minute', $event ?? 0)"
          />
          <el-select
            v-if="simple.kind === 'weekly'"
            :model-value="simple.weekday"
            @update:model-value="updateSimple('weekday', $event)"
          >
            <el-option v-for="option in weekDayOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </div>
        <div>执行预览：<code>{{ getSimpleExpireCronHumanText() }}</code></div>
        <div>预览 Cron：<code>{{ getSimpleExpireCron() }}</code></div>
      </template>

      <template v-else>
        <el-input
          :model-value="cronInput"
          placeholder="例如: 5 2 * * *"
          @update:model-value="$emit('update:cron-input', $event)"
        />
      </template>

      <div class="row">
        <el-button type="primary" @click="$emit('submit-cron')" :loading="loadingCron">
          保存调度配置
        </el-button>
        <span>{{ cronResult }}</span>
      </div>
    </div>

    <div class="row top-gap">
      <el-button type="danger" @click="$emit('run-job')" :loading="loadingJob">立即执行到期任务</el-button>
      <span>{{ jobResult }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

interface ExpireJobSimpleForm {
  kind: "daily" | "weekly";
  hour: number;
  minute: number;
  weekday: string;
}

const props = defineProps({
  cronMode: {
    type: String as PropType<"simple" | "custom">,
    required: true,
  },
  cronInput: {
    type: String,
    required: true,
  },
  cronResult: {
    type: String,
    required: true,
  },
  jobResult: {
    type: String,
    required: true,
  },
  simple: {
    type: Object as PropType<ExpireJobSimpleForm>,
    required: true,
  },
  weekDayOptions: {
    type: Array as PropType<Array<{ value: string; label: string }>>,
    required: true,
  },
  loadingCron: {
    type: Boolean,
    default: false,
  },
  loadingJob: {
    type: Boolean,
    default: false,
  },
  getSimpleExpireCron: {
    type: Function as PropType<() => string>,
    required: true,
  },
  getSimpleExpireCronHumanText: {
    type: Function as PropType<() => string>,
    required: true,
  },
});

const emit = defineEmits<{
  (event: "update:cron-mode", value: "simple" | "custom"): void;
  (event: "update:cron-input", value: string): void;
  (event: "update:simple", value: ExpireJobSimpleForm): void;
  (event: "submit-cron"): void;
  (event: "run-job"): void;
}>();

function updateSimple<K extends keyof ExpireJobSimpleForm>(key: K, value: ExpireJobSimpleForm[K]) {
  emit("update:simple", {
    ...props.simple,
    [key]: value,
  });
}
</script>
