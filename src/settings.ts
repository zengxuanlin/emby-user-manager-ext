import { prisma } from "./db.js";

export interface NotificationSettingsData {
  senderEmail: string | null;
  emailAuthCode: string | null;
  ingestionPushEnabled: boolean;
}

export async function getNotificationSettings(): Promise<NotificationSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ingestionPushEnabled: true,
    },
    update: {},
  });

  return {
    senderEmail: setting.senderEmail,
    emailAuthCode: setting.emailAuthCode,
    ingestionPushEnabled: setting.ingestionPushEnabled,
  };
}

export async function updateNotificationSettings(
  data: NotificationSettingsData,
): Promise<NotificationSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      senderEmail: data.senderEmail,
      emailAuthCode: data.emailAuthCode,
      ingestionPushEnabled: data.ingestionPushEnabled,
    },
    update: {
      senderEmail: data.senderEmail,
      emailAuthCode: data.emailAuthCode,
      ingestionPushEnabled: data.ingestionPushEnabled,
    },
  });

  return {
    senderEmail: setting.senderEmail,
    emailAuthCode: setting.emailAuthCode,
    ingestionPushEnabled: setting.ingestionPushEnabled,
  };
}
