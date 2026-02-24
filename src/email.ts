import nodemailer from "nodemailer";
import { prisma } from "./db.js";
import { getNotificationSettings } from "./settings.js";

interface SendEmailInput {
  userId?: string;
  to: string;
  subject: string;
  body: string;
  eventType: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const setting = await getNotificationSettings();
  if (!setting.ingestionPushEnabled) {
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "SKIPPED",
        failReason: "ingestion push disabled",
      },
    });
    return;
  }

  if (!setting.senderEmail || !setting.emailAuthCode) {
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "SKIPPED",
        failReason: "sender email or auth code not configured",
      },
    });
    return;
  }

  const smtpUser = setting.senderEmail;
  if (!smtpUser) {
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "SKIPPED",
        failReason: "SMTP user not configured",
      },
    });
    return;
  }

  const fromAddress = setting.senderEmail;
  if (!fromAddress) {
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "SKIPPED",
        failReason: "SMTP from address not configured",
      },
    });
    return;
  }

  const smtpHost = setting.smtpHost;
  const smtpPort = setting.smtpPort;
  const smtpSecure = setting.smtpSecure;
  if (!smtpHost) {
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "SKIPPED",
        failReason: "smtp host not configured in notification settings",
      },
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: setting.emailAuthCode,
    },
  });

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
  } catch (error) {
    const failReason = error instanceof Error ? error.message : String(error);
    await prisma.emailNotification.create({
      data: {
        userId: input.userId,
        recipient: input.to,
        subject: input.subject,
        body: input.body,
        eventType: input.eventType,
        status: "FAILED",
        failReason,
      },
    });
    return;
  }

  await prisma.emailNotification.create({
    data: {
      userId: input.userId,
      recipient: input.to,
      subject: input.subject,
      body: input.body,
      eventType: input.eventType,
      status: "SENT",
      dispatchedAt: new Date(),
    },
  });
}
