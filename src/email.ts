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
