import { prisma } from "./db.js";

export interface NotificationSettingsData {
  senderEmail: string | null;
  emailAuthCode: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  ingestionPushEnabled: boolean;
}

export async function getNotificationSettings(): Promise<NotificationSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smtpPort: 465,
      smtpSecure: true,
      ingestionPushEnabled: true,
    },
    update: {},
  });

  return {
    senderEmail: setting.senderEmail,
    emailAuthCode: setting.emailAuthCode,
    smtpHost: setting.smtpHost,
    smtpPort: setting.smtpPort,
    smtpSecure: setting.smtpSecure,
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
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      ingestionPushEnabled: data.ingestionPushEnabled,
    },
    update: {
      senderEmail: data.senderEmail,
      emailAuthCode: data.emailAuthCode,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      ingestionPushEnabled: data.ingestionPushEnabled,
    },
  });

  return {
    senderEmail: setting.senderEmail,
    emailAuthCode: setting.emailAuthCode,
    smtpHost: setting.smtpHost,
    smtpPort: setting.smtpPort,
    smtpSecure: setting.smtpSecure,
    ingestionPushEnabled: setting.ingestionPushEnabled,
  };
}
