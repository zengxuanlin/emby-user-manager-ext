import express from "express";
import morgan from "morgan";
import cron from "node-cron";
import { z } from "zod";
import { MembershipStatus } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { createAdminSessionToken, requireAdmin } from "./auth.js";
import { addUtcMonths, nowUtc } from "./date.js";
import { sendEmail } from "./email.js";
import {
  getExpireJobSettings,
  getNotificationSettings,
  updateExpireJobSettings,
  updateNotificationSettings,
} from "./settings.js";
import {
  createEmbyUser,
  deleteEmbyUser,
  getEmbyUserPolicy,
  listEmbyRealtimeActivities,
  listEmbyUsers,
  setEmbyUserPolicy,
  syncUserMembershipToEmby,
  testEmbyConnection,
  updateEmbyUserPassword,
} from "./emby.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
let expirationTask: ReturnType<typeof cron.schedule> | null = null;

function asSingle(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function adminNameOf(req: express.Request): string {
  return req.adminName ?? "unknown-admin";
}

function formatToShanghaiTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function applyExpireJobSchedule(expireJobCron: string): void {
  if (expirationTask) {
    expirationTask.stop();
  }
  expirationTask = cron.schedule(expireJobCron, async () => {
    try {
      await runExpirationJob();
    } catch (error) {
      console.error("Expiration job failed:", error);
    }
  });
  console.log(`[cron] membership-expire schedule set: ${expireJobCron}`);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

app.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  if (
    parsed.data.username !== config.adminUsername ||
    parsed.data.password !== config.adminPassword
  ) {
    return res.status(401).json({ message: "invalid username or password" });
  }

  const session = createAdminSessionToken(parsed.data.username);
  return res.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    username: parsed.data.username,
  });
});

app.get("/admin/emby/test", requireAdmin, async (_req, res) => {
  const result = await testEmbyConnection();
  res.json(result);
});

app.get("/admin/system/notification-settings", requireAdmin, async (_req, res) => {
  const settings = await getNotificationSettings();
  res.json({ settings });
});

const updateNotificationSettingsSchema = z.object({
  senderEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  emailAuthCode: z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  smtpHost: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  ingestionPushEnabled: z.boolean(),
});

app.put("/admin/system/notification-settings", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const parsed = updateNotificationSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "invalid notification settings payload",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      })),
    });
  }

  const settings = await updateNotificationSettings({
    senderEmail: parsed.data.senderEmail ?? null,
    emailAuthCode: parsed.data.emailAuthCode ?? null,
    smtpHost: parsed.data.smtpHost ?? null,
    smtpPort: parsed.data.smtpPort,
    smtpSecure: parsed.data.smtpSecure,
    ingestionPushEnabled: parsed.data.ingestionPushEnabled,
  });

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "NOTIFICATION_SETTINGS_UPDATE",
      targetType: "NotificationSetting",
      targetId: "default",
      detailJson: JSON.stringify({
        senderEmail: settings.senderEmail,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        ingestionPushEnabled: settings.ingestionPushEnabled,
      }),
    },
  });

  res.json({ ok: true, settings });
});

app.get("/admin/emby/users", requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const embyUsers = await listEmbyUsers();
  const filtered = q
    ? embyUsers.filter(
        (item) =>
          item.embyUserId.toLowerCase().includes(q) ||
          item.embyUsername.toLowerCase().includes(q),
      )
    : embyUsers;

  const embyUserIds = filtered.map((item) => item.embyUserId);
  const localUsers =
    embyUserIds.length === 0
      ? []
      : await prisma.appUser.findMany({
          where: { embyUserId: { in: embyUserIds } },
          include: { memberships: true },
        });
  const localByEmbyId = new Map(localUsers.map((u) => [u.embyUserId, u]));

  const users = filtered.map((embyUser) => {
    const local = localByEmbyId.get(embyUser.embyUserId);
    const membership = local?.memberships?.[0];
    return {
      embyUserId: embyUser.embyUserId,
      embyUsername: embyUser.embyUsername,
      embyDisabled: embyUser.embyDisabled,
      embyCreatedAt: embyUser.embyCreatedAt,
      localLinked: Boolean(local),
      email: local?.email ?? null,
      emailPushEnabled: local?.emailPushEnabled ?? false,
      membershipStatus: membership?.status ?? null,
      membershipEndAt: membership?.endAt ?? null,
      lastRechargeAmount: membership?.lastRechargeAmount ?? null,
    };
  });

  res.json({ users });
});

app.get("/admin/emby/activities", requireAdmin, async (_req, res) => {
  const activities = (await listEmbyRealtimeActivities()).filter((item) => Boolean(item.userId));
  res.json({ activities, fetchedAt: new Date().toISOString() });
});

app.post("/admin/emby/sync-users", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const embyUsers = await listEmbyUsers();
  let created = 0;
  let updated = 0;

  for (const item of embyUsers) {
    const exists = await prisma.appUser.findUnique({
      where: { embyUserId: item.embyUserId },
      select: { id: true },
    });

    const user = await prisma.appUser.upsert({
      where: { embyUserId: item.embyUserId },
      create: {
        embyUserId: item.embyUserId,
        embyUsername: item.embyUsername,
        isActive: !item.embyDisabled,
        memberships: { create: { status: MembershipStatus.EXPIRED } },
      },
      update: {
        embyUsername: item.embyUsername,
        isActive: !item.embyDisabled,
      },
    });

    await prisma.membership.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: MembershipStatus.EXPIRED,
      },
      update: {},
    });

    if (exists) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EMBY_USERS_SYNC",
      targetType: "AppUser",
      targetId: "batch",
      detailJson: JSON.stringify({
        total: embyUsers.length,
        created,
        updated,
      }),
    },
  });

  res.json({
    ok: true,
    total: embyUsers.length,
    created,
    updated,
  });
});

app.delete("/admin/emby/users/:embyUserId", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const embyUserId = asSingle(req.params.embyUserId);

  await deleteEmbyUser(embyUserId);

  const local = await prisma.appUser.findUnique({
    where: { embyUserId },
    select: { id: true },
  });
  if (local) {
    await prisma.appUser.delete({ where: { id: local.id } });
  }

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EMBY_USER_DELETE",
      targetType: "EmbyUser",
      targetId: embyUserId,
      detailJson: JSON.stringify({
        removedLocalUser: Boolean(local),
      }),
    },
  });

  res.json({ ok: true });
});

const createEmbyUserSchema = z.object({
  username: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "username is required").max(100)),
  password: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "password must be at least 1 character").max(100))
    .optional(),
  localEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  emailPushEnabled: z.boolean().optional(),
});

app.post("/admin/emby/users/create", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const parsed = createEmbyUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "invalid create payload",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      })),
    });
  }

  const created = await createEmbyUser(parsed.data.username, parsed.data.password);

  const user = await prisma.appUser.upsert({
    where: { embyUserId: created.embyUserId },
    create: {
      embyUserId: created.embyUserId,
      embyUsername: created.embyUsername,
      email: parsed.data.localEmail ?? null,
      emailPushEnabled: parsed.data.emailPushEnabled ?? false,
      memberships: { create: { status: MembershipStatus.EXPIRED } },
    },
    update: {
      embyUsername: created.embyUsername,
      email: parsed.data.localEmail ?? undefined,
      emailPushEnabled:
        parsed.data.emailPushEnabled !== undefined ? parsed.data.emailPushEnabled : undefined,
    },
    include: { memberships: true },
  });

  await prisma.membership.upsert({
    where: { userId: user.id },
    create: { userId: user.id, status: MembershipStatus.EXPIRED },
    update: {},
  });

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EMBY_USER_CREATE",
      targetType: "EmbyUser",
      targetId: created.embyUserId,
      detailJson: JSON.stringify({
        embyUsername: created.embyUsername,
        localEmail: parsed.data.localEmail ?? null,
        emailPushEnabled: parsed.data.emailPushEnabled ?? false,
      }),
    },
  });

  res.json({
    ok: true,
    user: {
      embyUserId: created.embyUserId,
      embyUsername: created.embyUsername,
      email: user.email,
      emailPushEnabled: user.emailPushEnabled,
    },
  });
});

app.get("/admin/emby/users/:embyUserId/policy", requireAdmin, async (req, res) => {
  const embyUserId = asSingle(req.params.embyUserId);
  const policy = await getEmbyUserPolicy(embyUserId);
  const local = await prisma.appUser.findUnique({
    where: { embyUserId },
    select: { email: true, emailPushEnabled: true },
  });
  res.json({
    embyUserId,
    policy,
    local: {
      email: local?.email ?? null,
      emailPushEnabled: local?.emailPushEnabled ?? false,
    },
  });
});

const updatePolicySchema = z.object({
  policy: z.record(z.string(), z.unknown()),
  embyUsername: z.string().min(1).optional(),
  localEmail: z.string().email().nullable().optional(),
  emailPushEnabled: z.boolean().optional(),
});

app.put("/admin/emby/users/:embyUserId/policy", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const embyUserId = asSingle(req.params.embyUserId);
  const parsed = updatePolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  await setEmbyUserPolicy(embyUserId, parsed.data.policy);

  if (parsed.data.localEmail !== undefined || parsed.data.emailPushEnabled !== undefined) {
    const existing = await prisma.appUser.findUnique({
      where: { embyUserId },
      include: { memberships: true },
    });

    if (!existing) {
      await prisma.appUser.create({
        data: {
          embyUserId,
          embyUsername: parsed.data.embyUsername ?? embyUserId,
          email: parsed.data.localEmail ?? null,
          emailPushEnabled: parsed.data.emailPushEnabled ?? false,
          memberships: { create: { status: MembershipStatus.EXPIRED } },
        },
      });
    } else {
      await prisma.appUser.update({
        where: { id: existing.id },
        data: {
          email: parsed.data.localEmail !== undefined ? parsed.data.localEmail : existing.email,
          emailPushEnabled:
            parsed.data.emailPushEnabled !== undefined
              ? parsed.data.emailPushEnabled
              : existing.emailPushEnabled,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EMBY_USER_POLICY_UPDATE",
      targetType: "EmbyUser",
      targetId: embyUserId,
      detailJson: JSON.stringify(parsed.data.policy),
    },
  });

  res.json({ ok: true });
});

const updatePasswordSchema = z.object({
  password: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "password must be at least 1 character").max(100)),
});

app.put("/admin/emby/users/:embyUserId/password", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const embyUserId = asSingle(req.params.embyUserId);
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "invalid password payload",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      })),
    });
  }

  await updateEmbyUserPassword(embyUserId, parsed.data.password);

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EMBY_USER_PASSWORD_UPDATE",
      targetType: "EmbyUser",
      targetId: embyUserId,
      detailJson: JSON.stringify({ updated: true }),
    },
  });

  res.json({ ok: true });
});

const upsertUserSchema = z.object({
  embyUserId: z.string().min(1),
  embyUsername: z.string().min(1),
  email: z.string().email().optional(),
});

app.post("/admin/users/upsert", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const parsed = upsertUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const user = await prisma.appUser.upsert({
    where: { embyUserId: parsed.data.embyUserId },
    create: {
      embyUserId: parsed.data.embyUserId,
      embyUsername: parsed.data.embyUsername,
      email: parsed.data.email,
      isEmailVerified: false,
      memberships: { create: { status: MembershipStatus.EXPIRED } },
    },
    update: {
      embyUsername: parsed.data.embyUsername,
      email: parsed.data.email,
    },
    include: { memberships: true },
  });

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "USER_UPSERT",
      targetType: "AppUser",
      targetId: user.id,
      detailJson: JSON.stringify(parsed.data),
    },
  });

  return res.json({ user });
});

app.get("/admin/users", requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.appUser.findMany({
    where: q
      ? {
          OR: [
            { embyUserId: { contains: q, mode: "insensitive" } },
            { embyUsername: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { memberships: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ users });
});

const rechargeSchema = z.object({
  embyUserId: z.string().min(1),
  amount: z.number().positive(),
  months: z.number().int().positive().max(36),
  note: z.string().max(500).optional(),
});

const setMembershipEndAtSchema = z.object({
  endAt: z.string().datetime(),
});

app.post("/admin/recharges/manual", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const user = await prisma.appUser.findUnique({
    where: { embyUserId: parsed.data.embyUserId },
    include: { memberships: true },
  });
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const now = nowUtc();
  const membership = user.memberships[0];
  const oldEndAt = membership?.endAt ?? null;
  const startFrom = oldEndAt && oldEndAt > now ? oldEndAt : now;
  const newEndAt = addUtcMonths(startFrom, parsed.data.months);

  const result = await prisma.$transaction(async (tx) => {
    const updatedMembership = membership
      ? await tx.membership.update({
          where: { id: membership.id },
          data: {
            status: MembershipStatus.ACTIVE,
            startAt: membership.startAt ?? now,
            endAt: newEndAt,
            lastRechargeAmount: parsed.data.amount,
          },
        })
      : await tx.membership.create({
          data: {
            userId: user.id,
            status: MembershipStatus.ACTIVE,
            startAt: now,
            endAt: newEndAt,
            lastRechargeAmount: parsed.data.amount,
          },
        });

    const recharge = await tx.rechargeRecord.create({
      data: {
        userId: user.id,
        adminName,
        amount: parsed.data.amount,
        months: parsed.data.months,
        startFrom,
        oldEndAt,
        newEndAt,
        note: parsed.data.note,
      },
    });

    await tx.auditLog.create({
      data: {
        actor: adminName,
        action: "MANUAL_RECHARGE",
        targetType: "AppUser",
        targetId: user.id,
        detailJson: JSON.stringify({
          amount: parsed.data.amount,
          months: parsed.data.months,
          oldEndAt: oldEndAt?.toISOString() ?? null,
          newEndAt: newEndAt.toISOString(),
        }),
      },
    });

    return { updatedMembership, recharge };
  });

  await syncUserMembershipToEmby(
    user.id,
    user.embyUserId,
    "ACTIVE",
    result.updatedMembership.endAt,
  );

  if (user.email && user.emailPushEnabled) {
    await sendEmail({
      userId: user.id,
      to: user.email,
      subject: "Emby 会员已续期",
      body: `你的会员已续期，新的到期时间为 ${newEndAt.toISOString()}。`,
      eventType: "MEMBERSHIP_RECHARGED",
    });
  }

  return res.json({
    membership: result.updatedMembership,
    recharge: result.recharge,
  });
});

app.put("/admin/memberships/:embyUserId/end-at", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const embyUserId = asSingle(req.params.embyUserId);
  const parsed = setMembershipEndAtSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const user = await prisma.appUser.findUnique({
    where: { embyUserId },
    include: { memberships: true },
  });
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const nextEndAt = new Date(parsed.data.endAt);
  const now = nowUtc();
  const nextStatus = nextEndAt > now ? MembershipStatus.ACTIVE : MembershipStatus.EXPIRED;
  const membership = user.memberships[0];
  const oldEndAt = membership?.endAt ?? null;

  const updatedMembership = membership
    ? await prisma.membership.update({
        where: { id: membership.id },
        data: {
          status: nextStatus,
          startAt: membership.startAt ?? now,
          endAt: nextEndAt,
        },
      })
    : await prisma.membership.create({
        data: {
          userId: user.id,
          status: nextStatus,
          startAt: now,
          endAt: nextEndAt,
        },
      });

  await syncUserMembershipToEmby(
    user.id,
    user.embyUserId,
    nextStatus === MembershipStatus.ACTIVE ? "ACTIVE" : "EXPIRED",
    updatedMembership.endAt ?? null,
  );

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "MEMBERSHIP_END_AT_SET",
      targetType: "AppUser",
      targetId: user.id,
      detailJson: JSON.stringify({
        embyUserId: user.embyUserId,
        oldEndAt: oldEndAt?.toISOString() ?? null,
        newEndAt: updatedMembership.endAt?.toISOString() ?? null,
        status: updatedMembership.status,
      }),
    },
  });

  res.json({ ok: true, membership: updatedMembership });
});

app.get("/admin/recharges", requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

  const records = await prisma.rechargeRecord.findMany({
    where: q
      ? {
          OR: [
            { user: { embyUserId: { contains: q, mode: "insensitive" } } },
            { user: { embyUsername: { contains: q, mode: "insensitive" } } },
            { adminName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      user: {
        select: {
          id: true,
          embyUserId: true,
          embyUsername: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json({ records });
});

app.get("/admin/memberships/:embyUserId", requireAdmin, async (req, res) => {
  const embyUserId = asSingle(req.params.embyUserId);
  const user = await prisma.appUser.findUnique({
    where: { embyUserId },
    include: {
      memberships: true,
      recharges: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  res.json({ user });
});

const webhookSchema = z
  .object({
    eventType: z.string().optional(),
    event: z.string().optional(),
    NotificationType: z.string().optional(),
    eventId: z.string().optional(),
    eventTime: z.string().optional(),
    embyUserId: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

function asObj(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function pickText(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseIngestionInfo(
  eventTypeRaw: string,
  rawBody: Record<string, unknown>,
): {
  isIngestionEvent: boolean;
  mediaKind: "movie" | "series" | "other";
  dedupKey: string | null;
  itemId: string | null;
  seriesId: string | null;
  seriesName: string | null;
  year: string | null;
  itemTitle: string | null;
  itemType: string | null;
  libraryName: string | null;
  addedAt: string | null;
} {
  const payload = asObj(rawBody.payload) ?? {};
  const payloadItems = Array.isArray(payload.Items) ? payload.Items : [];
  const firstItem = payloadItems.length > 0 ? asObj(payloadItems[0]) : null;
  const itemObj = asObj(payload.Item) ?? firstItem ?? asObj(rawBody.Item) ?? {};
  const eventType = eventTypeRaw.toLowerCase();

  const itemId =
    pickText(payload, ["ItemId", "itemId", "Id", "id"]) ??
    pickText(itemObj, ["Id", "id"]) ??
    pickText(rawBody, ["ItemId", "itemId", "Id", "id"]);

  const seriesId =
    pickText(payload, ["SeriesId", "seriesId"]) ??
    pickText(itemObj, ["SeriesId", "seriesId"]);

  const itemTitle =
    pickText(payload, ["ItemName", "itemName", "Name", "name"]) ??
    pickText(itemObj, ["Name", "name"]) ??
    pickText(rawBody, ["ItemName", "itemName", "Name", "name"]);

  const seriesName =
    pickText(payload, ["SeriesName", "seriesName"]) ??
    pickText(itemObj, ["SeriesName", "seriesName"]);

  const year =
    pickText(payload, ["ProductionYear", "Year", "year"]) ??
    pickText(itemObj, ["ProductionYear", "Year", "year"]);

  const itemType =
    pickText(payload, ["ItemType", "itemType", "Type", "type"]) ??
    pickText(itemObj, ["Type", "type"]) ??
    pickText(rawBody, ["ItemType", "itemType", "Type", "type"]);

  const libraryName =
    pickText(payload, ["LibraryName", "libraryName", "CollectionName"]) ??
    pickText(rawBody, ["LibraryName", "libraryName", "CollectionName"]);

  const addedAt =
    pickText(payload, ["DateCreated", "CreatedAt", "createdAt"]) ??
    pickText(itemObj, ["DateCreated", "CreatedAt", "createdAt"]) ??
    pickText(rawBody, ["eventTime", "EventTime", "DateCreated", "CreatedAt"]);

  const byEventType =
    eventType.includes("library") ||
    eventType.includes("itemadded") ||
    eventType.includes("newitem") ||
    eventType.includes("newlibrarycontent");
  const byPayloadHint = Boolean(itemTitle && (libraryName || itemType));

  const itemTypeLower = (itemType ?? "").toLowerCase();
  const mediaKind: "movie" | "series" | "other" = itemTypeLower.includes("movie")
    ? "movie"
    : itemTypeLower.includes("episode") ||
        itemTypeLower.includes("series") ||
        itemTypeLower.includes("season")
      ? "series"
      : "other";

  let dedupKey: string | null = null;
  if (mediaKind === "movie") {
    dedupKey = itemId
      ? `movie:${itemId}`
      : itemTitle
        ? `movie-title:${itemTitle.toLowerCase()}:${year ?? "unknown"}`
        : null;
  } else if (mediaKind === "series") {
    dedupKey = seriesId
      ? `series:${seriesId}`
      : seriesName
        ? `series-name:${seriesName.toLowerCase()}`
        : itemTitle
          ? `series-title:${itemTitle.toLowerCase()}`
          : null;
  }

  return {
    isIngestionEvent: byEventType || byPayloadHint,
    mediaKind,
    dedupKey,
    itemId,
    seriesId,
    seriesName,
    year,
    itemTitle,
    itemType,
    libraryName,
    addedAt,
  };
}

app.post("/webhooks/emby", async (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[webhook] invalid payload", {
      contentType: req.header("content-type") ?? null,
      bodyType: typeof req.body,
    });
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const rawBody = req.body as Record<string, unknown>;
  const userObj = asObj(rawBody.User) ?? asObj(rawBody.user);
  const embyUserId =
    parsed.data.embyUserId ??
    pickText(rawBody, ["embyUserId", "EmbyUserId", "UserId", "userId"]) ??
    (userObj ? pickText(userObj, ["Id", "id", "UserId", "userId"]) : null) ??
    undefined;
  const eventType =
    parsed.data.eventType ??
    parsed.data.event ??
    parsed.data.NotificationType ??
    pickText(rawBody, ["Event", "event", "NotificationType", "eventType"]) ??
    "UNKNOWN";
  const eventTime =
    parsed.data.eventTime ??
    pickText(rawBody, ["Date", "date", "EventTime", "eventTime"]) ??
    undefined;
  console.info("[webhook] received", {
    contentType: req.header("content-type") ?? null,
    bodyKeys: Object.keys(rawBody),
    eventType,
    embyUserId: embyUserId ?? null,
    eventTime: eventTime ?? null,
  });
  const ingestion = parseIngestionInfo(eventType, rawBody);

  const eventKey = ingestion.isIngestionEvent && ingestion.dedupKey
    ? `INGEST:${ingestion.dedupKey}`
    : (parsed.data.eventId ??
      `${eventType}:${embyUserId ?? "unknown"}:${eventTime ?? ""}`);

  let userId: string | undefined;
  if (embyUserId) {
    const user = await prisma.appUser.findUnique({
      where: { embyUserId },
    });
    userId = user?.id;
  }

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        eventType,
        eventKey,
        userId,
        embyEventTime: eventTime ? new Date(eventTime) : null,
        payloadJson: JSON.stringify(rawBody),
      },
    });

    const eventTypeLower = eventType.toLowerCase();
    const isTestEvent =
      eventTypeLower.includes("webhooktest") || eventTypeLower.includes("notificationtest");
    if (isTestEvent) {
      const receivers = await prisma.appUser.findMany({
        where: {
          emailPushEnabled: true,
          email: { not: null },
          isActive: true,
        },
        select: { id: true, email: true },
      });
      console.info("[webhook] webhooktest receivers", { count: receivers.length });

      const testTitle = pickText(rawBody, ["Title", "title"]) ?? "Test Notification";
      const testDesc = pickText(rawBody, ["Description", "description"]) ?? "";
      const testDate = pickText(rawBody, ["Date", "date"]) ?? eventTime ?? "-";
      const bodyLines = [
        "收到 Emby Webhook 测试通知。",
        `事件: ${eventType}`,
        `标题: ${testTitle}`,
        `描述: ${testDesc || "-"}`,
        `时间: ${testDate}`,
      ];

      for (const receiver of receivers) {
        if (!receiver.email) {
          continue;
        }
        await sendEmail({
          userId: receiver.id,
          to: receiver.email,
          subject: "Emby Webhook 测试通知",
          body: bodyLines.join("\n"),
          eventType: `WEBHOOK_${eventType}`,
        });
      }

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { emailDispatched: receivers.length > 0 },
      });
    } else if (ingestion.isIngestionEvent && ingestion.itemTitle) {
      const receivers = await prisma.appUser.findMany({
        where: {
          emailPushEnabled: true,
          email: { not: null },
          isActive: true,
        },
        select: { id: true, email: true },
      });
      console.info("[webhook] ingestion receivers", {
        count: receivers.length,
        itemTitle: ingestion.itemTitle,
        mediaKind: ingestion.mediaKind,
      });

      const subject =
        ingestion.mediaKind === "movie"
          ? `Emby 电影入库: ${ingestion.itemTitle}`
          : ingestion.mediaKind === "series"
            ? `Emby 剧集入库: ${ingestion.seriesName ?? ingestion.itemTitle}`
            : `Emby 新入库通知: ${ingestion.itemTitle}`;
      const ingestTimeText = formatToShanghaiTime(ingestion.addedAt ?? eventTime ?? null);
      const bodyLines =
        ingestion.mediaKind === "movie"
          ? [
              "检测到电影入库：",
              `片名: ${ingestion.itemTitle}`,
              `年份: ${ingestion.year ?? "-"}`,
              `媒体库: ${ingestion.libraryName ?? "-"}`,
              `资源ID: ${ingestion.itemId ?? "-"}`,
              `时间: ${ingestTimeText}`,
            ]
          : ingestion.mediaKind === "series"
            ? [
                "检测到剧集入库：",
                `剧名: ${ingestion.seriesName ?? ingestion.itemTitle}`,
                `触发条目: ${ingestion.itemTitle}`,
                `类型: ${ingestion.itemType ?? "-"}`,
                `媒体库: ${ingestion.libraryName ?? "-"}`,
                `剧集ID: ${ingestion.seriesId ?? "-"}`,
                `时间: ${ingestTimeText}`,
                "说明: 同一剧集只会发送一次入库通知。",
              ]
            : [
                "检测到新的入库资源：",
                `片名: ${ingestion.itemTitle}`,
                `类型: ${ingestion.itemType ?? "-"}`,
                `媒体库: ${ingestion.libraryName ?? "-"}`,
                `时间: ${ingestTimeText}`,
              ];

      for (const receiver of receivers) {
        if (!receiver.email) {
          continue;
        }
        await sendEmail({
          userId: receiver.id,
          to: receiver.email,
          subject,
          body: bodyLines.join("\n"),
          eventType: `WEBHOOK_LIBRARY_${eventType}`,
        });
      }

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { emailDispatched: receivers.length > 0 },
      });
    } else if (userId) {
      const user = await prisma.appUser.findUnique({ where: { id: userId } });
      if (user?.email && user.emailPushEnabled) {
        await sendEmail({
          userId,
          to: user.email,
          subject: `Emby 通知: ${eventType}`,
          body: `我们收到了一个 Emby 事件: ${eventType}`,
          eventType: `WEBHOOK_${eventType}`,
        });
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { emailDispatched: true },
        });
      }
    } else {
      console.info("[webhook] no email branch matched", {
        eventType,
        hasUserId: Boolean(userId),
        isIngestionEvent: ingestion.isIngestionEvent,
        itemTitle: ingestion.itemTitle ?? null,
      });
    }
  } catch (error) {
    if (String(error).includes("Unique constraint")) {
      return res.json({
        ok: true,
        deduped: true,
        reason: "ingestion notification already sent for this media key",
      });
    }
    throw error;
  }

  return res.json({ ok: true });
});

async function runExpirationJob(): Promise<{ expiredCount: number }> {
  const now = nowUtc();
  const expiring = await prisma.membership.findMany({
    where: {
      status: MembershipStatus.ACTIVE,
      endAt: { lte: now },
    },
    include: { user: true },
  });

  for (const membership of expiring) {
    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.EXPIRED },
    });

    await syncUserMembershipToEmby(
      membership.userId,
      membership.user.embyUserId,
      "EXPIRED",
      membership.endAt ?? null,
    );

    if (membership.user.email) {
      await sendEmail({
        userId: membership.userId,
        to: membership.user.email,
        subject: "Emby 会员已到期",
        body: `你的账户已于 ${formatToShanghaiTime(membership.endAt)} 到期，请及时续费以恢复会员权限。`,
        eventType: "MEMBERSHIP_EXPIRED",
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "MEMBERSHIP_EXPIRE_JOB",
      targetType: "Membership",
      targetId: "batch",
      detailJson: JSON.stringify({ expiredCount: expiring.length, runAt: now.toISOString() }),
    },
  });

  return { expiredCount: expiring.length };
}

app.post("/admin/jobs/expire-memberships", requireAdmin, async (_req, res) => {
  const result = await runExpirationJob();
  res.json(result);
});

app.get("/admin/system/expire-job-settings", requireAdmin, async (_req, res) => {
  const settings = await getExpireJobSettings();
  res.json({ settings });
});

const updateExpireJobSettingsSchema = z.object({
  expireJobCron: z.string().min(1),
});

app.put("/admin/system/expire-job-settings", requireAdmin, async (req, res) => {
  const adminName = adminNameOf(req);
  const parsed = updateExpireJobSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const expireJobCron = parsed.data.expireJobCron.trim();
  if (!cron.validate(expireJobCron)) {
    return res.status(400).json({ message: "invalid cron expression" });
  }

  const settings = await updateExpireJobSettings({ expireJobCron });
  applyExpireJobSchedule(settings.expireJobCron);

  await prisma.auditLog.create({
    data: {
      actor: adminName,
      action: "EXPIRE_JOB_CRON_UPDATE",
      targetType: "NotificationSetting",
      targetId: "default",
      detailJson: JSON.stringify({ expireJobCron: settings.expireJobCron }),
    },
  });

  res.json({ ok: true, settings });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "internal server error" });
});

void getExpireJobSettings()
  .then((settings) => {
    if (cron.validate(settings.expireJobCron)) {
      applyExpireJobSchedule(settings.expireJobCron);
    } else {
      console.warn(`[cron] invalid stored expression, fallback to default: ${settings.expireJobCron}`);
      applyExpireJobSchedule("5 2 * * *");
    }
  })
  .catch((error) => {
    console.warn("[cron] failed to load stored schedule, fallback to default", error);
    applyExpireJobSchedule("5 2 * * *");
  });

app.listen(config.port, () => {
  console.log(`Server listening on :${config.port}`);
});
