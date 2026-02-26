ALTER TABLE "NotificationSetting"
ADD COLUMN "expireJobCron" TEXT NOT NULL DEFAULT '5 2 * * *';
