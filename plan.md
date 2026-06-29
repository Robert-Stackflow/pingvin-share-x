# Pingvin Share X 实用增强路线图

## Summary

分期实现：先把 Asset 做成统一操作中心，再把 ReverseShare 产品化升级为投递箱，然后引入轻量统一访问控制、资产搜索标签、活动日志。后续再接 QR、清理规则、存储统计、Webhook、API Token、PWA Share Target。

默认决策：
- 资产操作使用“复制/克隆”，不移动原 Asset。
- 文件 Asset 克隆时复制存储对象到新 asset id，避免引用计数复杂度。
- ReverseShare 升级为 Inbox，保留旧接口/旧 `/upload/:token` 兼容。
- 访问控制 v1 使用轻量统一 `AccessPolicy`，先覆盖密码、过期、访问次数、下载开关、匿名访问、一次性链接。
- 活动日志提供“我的活动”和“管理员全站活动”。

## Key Changes

### 1. 统一资产操作

- 在资产列表、共享编辑、房间消息、投递箱待处理列表中统一使用 `AssetActionMenu`：
  - 预览
  - 复制内容/复制链接
  - 下载文件
  - 生成共享
  - 生成短链
  - 发送到房间
  - 删除
- 后端新增资产动作接口：
  - `POST /api/assets/:id/share`
  - `POST /api/assets/:id/short-link`
  - `POST /api/assets/:id/send-to-room`
  - `POST /api/assets/:id/clone`
  - `PATCH /api/assets/:id`
- `POST /api/assets/:id/share` 创建一个已完成共享，并克隆该 Asset 到共享中。
- `POST /api/assets/:id/short-link`：
  - LINK Asset 默认短链到原始 URL。
  - FILE/TEXT Asset 默认先生成单资产共享，再短链到 `/s/:shareId`。
- 前端新增统一 `AssetPreviewDialog`：
  - TEXT 显示正文并支持复制。
  - LINK 显示 URL、打开、复制、生成短链。
  - FILE 复用现有图片/音频/视频/PDF/文本预览能力。

### 2. 投递箱 / Inbox

- 新增产品入口“投递箱”，替代 UI 上的“预留共享/反向共享”。
- 保留旧 `ReverseShare` 数据与旧接口兼容，但新增 Inbox API 作为主入口：
  - `POST /api/inboxes`
  - `GET /api/inboxes`
  - `GET /api/inboxes/:token`
  - `POST /api/inboxes/:token/submissions`
  - `GET /api/inboxes/:id/submissions`
  - `POST /api/inbox-submissions/:id/accept`
  - `POST /api/inbox-submissions/:id/reject`
  - `DELETE /api/inboxes/:id`
- 新增 `InboxSubmission`：
  - `PENDING`
  - `ACCEPTED`
  - `REJECTED`
- 访客上传后先进入待处理列表，不直接生成共享。
- 所有者可以：
  - 接收到“我的资产”
  - 接收并生成共享
  - 拒绝并删除文件资源
- `/upload/:token` 保持可用，内部跳转或复用 `/inbox/:token` 页面，避免旧链接失效。

### 3. 统一访问控制

- 新增 `AccessPolicy` 作为新对象的统一权限来源，挂载到 Share、Clipboard Room、ShortLink、Inbox。
- 字段包括：
  - `passwordHash`
  - `expiresAt`
  - `maxViews`
  - `views`
  - `allowDownload`
  - `allowAnonymous`
  - `oneTime`
- 现有字段兼容处理：
  - Share 的 `expiration`、`ShareSecurity.password/maxViews` 同步迁移到 `AccessPolicy`。
  - Clipboard Room 的 `passcodeHash` 迁移到 `AccessPolicy.passwordHash`。
  - ShortLink 的 `isActive` 保留，同时新增访问策略控制过期、次数、匿名。
- 新增统一 `AccessPolicyService`：
  - 校验访问
  - 校验密码
  - 记录访问次数
  - 判断下载权限
  - 签发访问 token/cookie
- 前端新增统一“访问控制”表单组件，在共享、短链、房间、投递箱创建/编辑 dialog 中复用。

### 4. 资产搜索、标签、收藏

- Asset 增加：
  - `favorite`
  - `source`
  - `lastAccessedAt`
- 新增标签模型：
  - `AssetTag`
  - `AssetTagAssignment`
- `GET /api/assets` 支持查询：
  - `q`
  - `type`
  - `source`
  - `favorite`
  - `tag`
  - `sort`
- 前端资产页改为工具型列表：
  - 搜索框
  - 类型筛选
  - 来源筛选：上传 / 共享 / 房间 / 投递箱
  - 标签筛选
  - 收藏筛选
  - 最近使用排序
- 支持资产行内收藏、打标签、移除标签。

### 5. 活动日志 / 审计

- 新增 `ActivityEvent`：
  - `actorId`
  - `action`
  - `targetType`
  - `targetId`
  - `metadata`
  - `ipHash`
  - `userAgent`
  - `createdAt`
- 记录事件：
  - Asset 创建、删除、克隆、下载、预览
  - Share 创建、完成、删除、过期、下载
  - ShortLink 创建、访问、停用、删除
  - Room 创建、编辑、删除、添加资产
  - Inbox 创建、收到投递、接收、拒绝
  - AccessPolicy 拒绝访问、密码验证成功
- 前端新增：
  - `/account/activity`：当前用户相关活动
  - 管理下拉菜单新增“活动日志”
  - `/admin/activity`：管理员全站活动
- 活动日志支持时间、动作、目标类型、用户筛选。

## Later Additions

- QR Code：共享、房间、短链、投递箱统一在链接弹窗里生成。
- 批量清理规则：过期共享、无主临时资产、拒绝投递、无人访问短链。
- 存储统计：按用户、类型、来源、时间统计用量。
- Webhook：共享下载、短链访问、投递箱收到文件等事件发送 HTTP 回调。
- API Token：脚本上传文件/文本、创建短链、创建投递箱。
- PWA Share Target：移动端系统分享菜单发送文本/链接/文件到资产库或房间。

## Test Plan

- 后端：
  - 新增 Asset action service/controller tests。
  - 新增 Inbox service/controller tests。
  - 新增 AccessPolicy guard/service tests。
  - 新增 ActivityEvent record/list tests。
  - 更新 Share、Clipboard、ShortLink 现有测试，确认迁移后行为不变。
  - fresh SQLite 跑 `prisma migrate deploy`。
- 前端：
  - 更新 `ui-layout.spec.js`，覆盖资产操作菜单、投递箱、访问控制组件、活动日志。
  - 跑 `npx tsc --noEmit --pretty false`。
  - 浏览器冒烟：资产生成共享/短链、发送房间、投递箱上传并接收、短链次数限制、禁止下载。
- 回归：
  - 旧 `/upload/:token` 链接仍可访问。
  - 旧共享密码和最大访问次数仍生效。
  - 旧 `/s/:shareId` 共享入口不被短链逻辑破坏。

## Assumptions

- 不做复杂目录树，避免产品变成网盘。
- 不做组织/团队权限，仍以个人用户和管理员为主。
- v1 不做文件去重和引用计数，文件克隆复制存储对象。
- v1 活动日志只做查询和展示，不做告警。
- 访问控制迁移保留旧字段兼容，后续稳定后再考虑清理 legacy schema。
