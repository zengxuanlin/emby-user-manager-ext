import { prisma } from "./db.js";

export interface NotificationSettingsData {
  senderEmail: string | null;
  emailAuthCode: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  ingestionPushEnabled: boolean;
}

export interface ExpireJobSettingsData {
  expireJobCron: string;
}

export async function getNotificationSettings(): Promise<NotificationSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smtpPort: 465,
      smtpSecure: true,
      expireJobCron: "5 2 * * *",
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
      expireJobCron: "5 2 * * *",
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

export async function getExpireJobSettings(): Promise<ExpireJobSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smtpPort: 465,
      smtpSecure: true,
      expireJobCron: "5 2 * * *",
      ingestionPushEnabled: true,
    },
    update: {},
  });

  return {
    expireJobCron: setting.expireJobCron,
  };
}

export async function updateExpireJobSettings(data: ExpireJobSettingsData): Promise<ExpireJobSettingsData> {
  const setting = await prisma.notificationSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smtpPort: 465,
      smtpSecure: true,
      expireJobCron: data.expireJobCron,
      ingestionPushEnabled: true,
    },
    update: {
      expireJobCron: data.expireJobCron,
    },
  });

  return {
    expireJobCron: setting.expireJobCron,
  };
}
