# emby-user-manager-ext

Emby 会员系统 MVP（手工充值版），已包含：

- 用户管理（绑定 Emby 用户信息、邮箱）
- 会员状态管理（ACTIVE / EXPIRED）
- 管理员手工充值（按月续期）
- 到期任务（定时与手动触发）
- Emby Webhook 入库与去重
- 邮件通知（SMTP 真实发信 + 数据库日志）

## 1) 初始化

```bash
cp .env.example .env
npm install
docker compose up -d postgres
docker compose ps
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

如果你本机已经有 PostgreSQL，也可以不使用 Docker。  
但要保证 `.env` 的 `DATABASE_URL` 指向可访问的实例。

如果 Docker 启动后仍连接失败，先检查：

```bash
docker compose logs -f postgres
```

SMTP 真实发信配置在管理后台“通知设置”里保存（数据库 `NotificationSetting`）：

- `senderEmail`
- `emailAuthCode`
- `smtpHost`
- `smtpPort`
- `smtpSecure`

前端：

```bash
npm --prefix frontend install
npm run front:dev
```

默认前端地址：`http://localhost:5173`  
前端默认通过 `/api` 代理到后端 `http://localhost:3000`

## Docker 一键部署（推荐）

1. 推送到 `main` 后，GitHub Actions 会自动构建并推送镜像到 GHCR：

- `ghcr.io/zengxuanlin/emby-user-manager-ext-api:latest`
- `ghcr.io/zengxuanlin/emby-user-manager-ext-web:latest`

2. 直接编辑 `docker-compose.yml`，至少填写 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`AUTH_SECRET`、`EMBY_*`。
3. 启动数据库：

```bash
docker compose up -d postgres
```

4. 执行数据库迁移：

```bash
docker compose run --rm api npx prisma migrate deploy
```

5. 启动全部服务：

```bash
docker compose pull
docker compose up -d
```

访问地址：

- 管理前端：`http://localhost:8080`
- 后端 API：`http://localhost:3000`

## 2) 初始化（无 Docker 版本）

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

## 3) 管理员鉴权

先通过登录接口获取 token：

`POST /auth/login`

```json
{
  "username": "admin",
  "password": "your-password"
}
```

成功后，对所有 `/admin/*` 接口使用：

- `Authorization: Bearer <token>`

## Emby 配置

在 `.env` 中配置：

- `EMBY_BASE_URL`: Emby 服务地址，例如 `http://127.0.0.1:8096`
- `EMBY_API_KEY`: Emby 的 API Key（在 Emby 管理后台生成）

系统会使用这两个配置来：

- 测试 Emby 连通性
- 在会员开通/到期时同步用户可用状态

## 4) 核心接口

### 健康检查

`GET /health`

### 测试 Emby 连接

`GET /admin/emby/test`

返回示例：

```json
{
  "ok": true,
  "serverName": "Emby Server",
  "version": "4.8.x",
  "serverId": "xxxx"
}
```

### 获取 Emby 用户列表（管理页主列表）

`GET /admin/emby/users?q=tom`

返回字段包含：

- Emby 用户信息（`embyUserId`、`embyUsername`、`embyDisabled`）
- 本地系统关联信息（`localLinked`、`email`、`emailPushEnabled`、`membershipStatus`、`membershipEndAt`）

### 一键同步 Emby 用户到本地

`POST /admin/emby/sync-users`

返回示例：

```json
{
  "ok": true,
  "total": 120,
  "created": 120,
  "updated": 0
}
```

### 新增 Emby 用户

`POST /admin/emby/users/create`

```json
{
  "username": "new_user",
  "password": "123456",
  "localEmail": "new_user@example.com",
  "emailPushEnabled": true
}
```

### 获取 Emby 用户权限

`GET /admin/emby/users/:embyUserId/policy`

### 更新 Emby 用户权限

`PUT /admin/emby/users/:embyUserId/policy`

```json
{
  "embyUsername": "tom",
  "localEmail": "tom@example.com",
  "emailPushEnabled": true,
  "policy": {
    "IsAdministrator": false,
    "IsDisabled": false,
    "EnableRemoteAccess": true,
    "EnableMediaPlayback": true
  }
}
```

### 修改 Emby 用户密码

`PUT /admin/emby/users/:embyUserId/password`

```json
{
  "password": "new_password"
}
```

### 获取通知设置

`GET /admin/system/notification-settings`

### 保存通知设置

`PUT /admin/system/notification-settings`

```json
{
  "senderEmail": "sender@example.com",
  "emailAuthCode": "mail-auth-code",
  "smtpHost": "smtp.example.com",
  "smtpPort": 465,
  "smtpSecure": true,
  "ingestionPushEnabled": true
}
```

### 新增或更新用户

`POST /admin/users/upsert`

```json
{
  "embyUserId": "12345",
  "embyUsername": "tom",
  "email": "tom@example.com"
}
```

### 用户列表（仅本地数据库）

`GET /admin/users?q=tom`

### 手工充值

`POST /admin/recharges/manual`

```json
{
  "embyUserId": "12345",
  "amount": 30,
  "months": 1,
  "note": "后台手工续费"
}
```

到期时间规则：

`newEndAt = max(oldEndAt, now) + months`

### 充值记录列表

`GET /admin/recharges?q=tom&limit=200`

### 查询用户会员详情

`GET /admin/memberships/:embyUserId`

### Emby Webhook

`POST /webhooks/emby`

说明：

- 在 Emby 后台把 webhook 回调地址配置为你的服务地址：`/webhooks/emby`
- 系统会自动解析“新入库资源”事件，并群发到所有 `emailPushEnabled=true` 且有邮箱的用户

示例 body：

```json
{
  "eventType": "PlaybackStart",
  "eventId": "evt-001",
  "eventTime": "2026-02-24T10:00:00.000Z",
  "embyUserId": "12345",
  "payload": {
    "itemId": "abc"
  }
}
```

### 手动触发到期任务

`POST /admin/jobs/expire-memberships`

## 5) Emby API 接入点

当前 `src/emby.ts` 已接入真实 Emby API：

- `GET /System/Info` 用于连接测试
- `GET /Users/{id}` + `POST /Users/{id}/Policy` 用于同步会员状态

## 6) 生产建议

- 邮件服务：Resend / SendGrid
- 队列重试：Redis + BullMQ
- 权限：管理员角色分级
- 部署：Docker Compose（API + PostgreSQL + Redis）
