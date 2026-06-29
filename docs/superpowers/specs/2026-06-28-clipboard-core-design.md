# 子项目 2 设计:在线剪贴板核心

> 路线图见 `2026-06-25-asset-platform-roadmap.md`。依赖子项目 1 的 `Asset` 顶层模型。
> 本文记录在线剪贴板核心能力:私人剪贴板、房间剪贴板、口令读取、TEXT/LINK/FILE Asset 接入和基础前端。

## 目标

- 支持每个登录用户一个私人剪贴板。
- 支持登录用户创建房间式剪贴板,房间有公开 `roomId` 和可选口令。
- 剪贴板内容复用 `Asset`。`Asset` 通过 `clipboardId` 挂到私人剪贴板或房间。
- 提供后端 API:获取我的私人剪贴板、创建房间、获取我的房间、校验房间口令、往剪贴板添加 TEXT/LINK/FILE Asset,并下载 FILE Asset。

## 非目标

- 匿名房间编辑、实时协作、历史版本暂不做。
- 房间成员表、权限角色暂不做;本期房间由创建者管理,访客只做口令校验和读取基础信息的服务能力。
- 文件预览、文件夹和批量操作暂不做;本期支持剪贴板 FILE 上传、列表和下载。

## 数据模型

```prisma
enum ClipboardType {
  PRIVATE
  ROOM
}

model Clipboard {
  id        String        @id @default(uuid())
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  type      ClipboardType

  ownerId String?
  owner   User? @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  roomId       String? @unique
  name         String?
  passcodeHash String?

  assets Asset[]

  @@index([ownerId])
}
```

`Asset` 新增:

```prisma
clipboardId String?
clipboard   Clipboard? @relation(fields: [clipboardId], references: [id], onDelete: Cascade)
@@index([clipboardId])
```

不变式由 `ClipboardService` 保证:

- `PRIVATE` 必须有 `ownerId`,且每个用户只能有一个。
- `ROOM` 必须有唯一 `roomId`,创建者 `ownerId` 可为空但本期 API 只允许登录用户创建;同一用户可以创建多个房间。
- 挂到剪贴板的 Asset 不再属于 standalone 列表:standalone 条件为 `shareId = null && clipboardId = null`。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/clipboards/me` | 获取/创建当前用户私人剪贴板,含 assets |
| POST | `/clipboards/me/assets` | 向私人剪贴板添加 TEXT/LINK Asset;也可通过 `?type=FILE&name=...&chunkIndex=...&totalChunks=...` 上传 FILE chunk |
| GET | `/clipboards/me/assets/:assetId/download` | 下载当前用户私人剪贴板中的 FILE Asset |
| GET | `/clipboards/rooms` | 列出我创建的房间 |
| POST | `/clipboards/rooms` | 创建房间 `{ name?, passcode? }` |
| POST | `/clipboards/rooms/:roomId/assets` | 房主向房间添加 TEXT/LINK Asset;也可通过 FILE chunk query 上传 FILE |
| GET | `/clipboards/rooms/:roomId/assets/:assetId/download` | 下载房间中的 FILE Asset;受房间口令 token 保护 |
| POST | `/clipboards/rooms/:roomId/verify` | 校验房间口令 |
| GET | `/clipboards/rooms/:roomId` | 获取房间基础信息和 assets;有口令的房间需要携带 verify 后设置的房间 token cookie |

所有房间 API 响应都不能暴露 `passcodeHash`,只返回 `hasPasscode` 供前端决定是否显示口令输入。

前端 `/clipboard` 支持私人剪贴板与房间剪贴板的 TEXT/LINK/FILE 添加,并在列表中显示文件大小与下载动作。公开房间页 `/clipboard/rooms/:roomId` 支持口令解锁和文件下载。
