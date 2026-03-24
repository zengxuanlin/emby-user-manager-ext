<template>
  <div>
    <div class="grid cols-2">
      <el-input
        :model-value="form.senderEmail ?? ''"
        placeholder="发送人邮箱地址"
        @update:model-value="updateField('senderEmail', $event)"
      />
      <el-input
        :model-value="form.emailAuthCode ?? ''"
        type="password"
        show-password
        placeholder="邮箱授权码"
        @update:model-value="updateField('emailAuthCode', $event)"
      />
      <el-input
        :model-value="form.smtpHost ?? ''"
        placeholder="SMTP Host（如 smtp.qq.com）"
        @update:model-value="updateField('smtpHost', $event)"
      />
      <el-input-number
        :model-value="form.smtpPort"
        :min="1"
        :max="65535"
        controls-position="right"
        @update:model-value="updateField('smtpPort', $event ?? 465)"
      />
      <div class="row">
        <span>SMTP 使用 SSL/TLS</span>
        <el-switch
          :model-value="form.smtpSecure"
          @update:model-value="updateField('smtpSecure', $event)"
        />
      </div>
      <div class="row">
        <span>是否开启入库推送</span>
        <el-switch
          :model-value="form.ingestionPushEnabled"
          @update:model-value="updateField('ingestionPushEnabled', $event)"
        />
      </div>
    </div>
    <div class="row top-gap">
      <el-button type="primary" @click="$emit('submit')" :loading="loading">
        保存通知设置
      </el-button>
      <span>{{ result }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { NotificationSettings } from "../../api";

const props = defineProps({
  form: {
    type: Object as PropType<NotificationSettings>,
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

const emit = defineEmits<{
  (event: "update:form", value: NotificationSettings): void;
  (event: "submit"): void;
}>();

function updateField<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
  emit("update:form", {
    ...props.form,
    [key]: value,
  });
}
</script>
