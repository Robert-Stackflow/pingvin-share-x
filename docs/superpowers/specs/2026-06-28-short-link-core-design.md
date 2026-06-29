# 子项目 3 设计:短链与访问分析核心

> 路线图见 `2026-06-25-asset-platform-roadmap.md`。本切片先落地短链的核心数据、跳转、Redis 缓存/计数接入和基础分析页面。

## 目标

- 支持登录用户创建短链接。
- 短链目标支持外部 URL 和站内路径。
- 提供公开短链入口 `/l/:code`,访问时跳转到目标地址。
- 记录明细访问日志:时间、IP hash、User-Agent、Referer。
- 维护聚合访问次数,并通过现有全局 CacheModule 接入 Redis/内存缓存。
- 提供用户自己的短链列表和统计 API,前端展示总访问量、唯一访客、最后访问、按天访问、来源分布、User-Agent 分布和最近访问。

## 非目标

- 自定义域名、二维码批量导出、地理位置解析、设备识别暂不做。
- 短链协作权限和团队空间暂不做;本期短链归创建者所有。
- 高级生命周期策略暂不做,例如过期时间、批量归档和恢复;本期补齐单条短链的编辑、禁用和删除。

## 数据模型

```prisma
enum ShortLinkTargetType {
  URL
  INTERNAL_PATH
}

model ShortLink {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  code       String              @unique
  title      String?
  targetType ShortLinkTargetType
  targetUrl  String
  isActive   Boolean             @default(true)
  visits     Int                 @default(0)

  ownerId String?
  owner   User? @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  visitLogs ShortLinkVisit[]

  @@index([ownerId])
  @@index([targetType])
}

model ShortLinkVisit {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  shortLinkId String
  shortLink   ShortLink @relation(fields: [shortLinkId], references: [id], onDelete: Cascade)

  ipHash    String?
  userAgent String?
  referer   String?

  @@index([shortLinkId, createdAt])
  @@index([createdAt])
}
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/short-links` | 创建短链 `{ targetType, targetUrl, title?, code? }` |
| GET | `/short-links` | 列出当前用户短链 |
| GET | `/short-links/:code/stats` | 查看当前用户该短链统计 |
| PATCH | `/short-links/:code` | 编辑当前用户该短链的目标、标题和启用状态 |
| DELETE | `/short-links/:code` | 删除当前用户该短链和访问日志 |
| GET | `/short-links/:code/visit` | 公开访问入口,记录访问并 302 跳转 |

前端 `/l/:code` 在 SSR 阶段调用公开访问入口,读取后端返回的 `Location` 后用 Next redirect 完成跳转。

## Redis/缓存

短链 service 使用现有全局 Nest `CACHE_MANAGER`:

- `short-link:{code}:target` 缓存目标地址。
- `short-link:{code}:visits` 缓存访问计数。

当 `cache.redis-enabled` 开启时,现有 `AppCacheModule` 会把这些 key 写入 Redis;未开启时使用内存 fallback。数据库仍是权威存储,Redis 用于缓存与快速计数。

## 统计口径

- `totalVisits` 使用数据库计数和缓存计数中的较大值,避免缓存领先数据库响应时前端短暂回退。
- `uniqueVisitors` 基于访问日志中的 `ipHash` 去重;不存储、不返回原始 IP。
- `visitsByDay`、`visitsByReferer` 和 `visitsByUserAgent` 使用该短链的全量访问日志聚合。
- `recentVisits` 只返回最近 100 条明细,供前端展示访问时间、Referer 和 User-Agent。
- 空 Referer 归为 `Direct`,空 User-Agent 归为 `Unknown`。

## 前端

- `/account/short-links`:创建外部 URL 或站内路径短链、复制 `/l/:code`、打开目标、编辑目标/标题/状态、删除短链、查看统计。
- 统计区域以运营台形式展示核心指标和轻量条形图,不额外引入图表库。
- `/l/[code]`:公开短链跳转页面,无可见 UI。

## 验证

- 后端 Node tests 覆盖 schema、service、controller。
- Prisma fresh migration replay 覆盖新表创建。
- 前端 `tsc`/build 覆盖页面和服务类型。
- HTTP smoke 覆盖创建短链、访问跳转、访问日志和统计增长。
