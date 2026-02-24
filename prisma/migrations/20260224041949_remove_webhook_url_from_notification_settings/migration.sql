/*
  Warnings:

  - You are about to drop the column `embyWebhookUrl` on the `NotificationSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NotificationSetting" DROP COLUMN "embyWebhookUrl";
