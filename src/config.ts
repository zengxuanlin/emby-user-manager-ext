import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  adminUsername: required("ADMIN_USERNAME"),
  adminPassword: required("ADMIN_PASSWORD"),
  authSecret: required("AUTH_SECRET"),
  embyWebhookSecret: required("EMBY_WEBHOOK_SECRET"),
  embyBaseUrl: required("EMBY_BASE_URL").replace(/\/+$/, ""),
  embyApiKey: required("EMBY_API_KEY"),
};
