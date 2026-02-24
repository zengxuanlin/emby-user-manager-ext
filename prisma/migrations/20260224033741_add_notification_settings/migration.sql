-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "embyWebhookUrl" TEXT,
    "senderEmail" TEXT,
    "emailAuthCode" TEXT,
    "ingestionPushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);
