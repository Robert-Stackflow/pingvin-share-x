# 子项目 1 设计:Asset 核心模型

> 路线图见 `2026-06-25-asset-platform-roadmap.md`。依赖子项目 0(Mantine 8 升级,已完成)。
> 本子项目是子项目 2(在线剪贴板)、3(短链 + 分析)的数据/服务地基。
> 日期:2026-06-25。

## 1. 目标与非目标

**目标**
- 引入顶层实体 `Asset`(FILE / TEXT / LINK),取代现有 `File`。
- `Share` 重构为 Asset 容器:`Share.files: File[]` → `Share.assets: Asset[]`。
- `Asset` 可独立存在(`shareId = null`),也可挂在 Share 下。
- 统一存储抽象:本地与 S3 一律按 `assetId` 寻址(消除现有 local 用 id、S3 用文件名的不对称)。
- 统一 `AssetService` + `StorageService`(LOCAL/S3),下载与 zip 打包走 Asset。
- 新增 `/assets` API + 一个薄的「我的 Assets」前端页。
- 现有 share 上传/查看流程平滑迁移到 Asset,**功能不回归**。

**非目标(明确推迟)**
- standalone Asset 的对外访问(单条带密码/有效期的访问 URL)→ 子项目 2/3。
- 在线剪贴板(私人 + 口令房间)→ 子项目 2。
- 短链、Redis 计数、访问分析 → 子项目 3。
- 富文本编辑器升级、Asset 的拖拽排序等 UI 增强 → 收尾打磨期。
- TEXT/LINK 在 share 容器内的「上传/查看」UI 仅做最小可用,不做专门美化。

## 2. 已确认决策

| 决策点 | 选择 |
|---|---|
| Asset 建模 | **单表 + `type` 枚举**(FILE/TEXT/LINK 共表,类型字段可空) |
| 重构尺度 | **彻底替换 File**(删除 `File` 表,Share 改用 assets) |
| 数据迁移 | **无需迁移,可重置数据库**(路线图既定) |
| 存储寻址 | **一律按 `assetId`**(开放点 A,已认可) |
| API | **重构 /shares 底层 + 新增 /assets**(开放点 B,已认可) |
| 前端范围 | **最小适配现有 share 流程 + 薄「我的 Assets」页**(开放点 C,已认可) |
| standalone 访问控制 | 本期仅 owner 自己可 CRUD/下载;对外 URL 推迟 |

## 3. 数据模型

### 3.1 新增

```prisma
enum AssetType {
  FILE
  TEXT
  LINK
}

enum StorageProvider {
  LOCAL
  S3
}

model Asset {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  type    AssetType
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  // 挂到 Share 容器时非空;standalone 时为 null
  shareId String?
  share   Share?  @relation(fields: [shareId], references: [id], onDelete: Cascade)

  // --- type = FILE ---
  name    String?           // 文件名(含扩展名)
  size    String?           // 字节数,字符串(沿用 File.size 的字符串约定)
  mimeType String?          // 显式存 MIME(取代旧的「从扩展名推断」)
  storage StorageProvider?  // 该文件实际存储后端

  // --- type = TEXT ---
  content String?           // 文本/markdown 原文

  // --- type = LINK ---
  url     String?           // 目标 URL

  @@index([shareId])
  @@index([ownerId])
}
```

> **不变式(在 `AssetService` 校验,DB 层不强约束以保持 SQLite 简单):**
> - `FILE` ⇒ `name`、`size`、`mimeType`、`storage` 非空;`content`/`url` 为空。
> - `TEXT` ⇒ `content` 非空;其余类型字段为空。
> - `LINK` ⇒ `url` 非空;其余类型字段为空。

### 3.2 修改

- `Share`:删除 `files File[]`,改为 `assets Asset[]`。`storageProvider` 字段保留(仍记录该 share 创建时的默认存储后端,供 zip 等使用)。其余字段(security/recipients/expiration/views/uploadLocked/isZipReady)不变。
- `User`:新增反向关系 `assets Asset[]`。

### 3.3 删除

- `model File`(整表删除)。所有 `File` 引用迁移到 `Asset`。

> 既定可重置数据库:删除 `data/pingvin-share.db` 后 `prisma migrate dev` 重新生成;现有上传文件目录(`data/uploads/shares/*`)无需保留。

## 4. 存储布局(开放点 A)

统一按 `assetId` 寻址,**不再按 share 分目录**:

| 后端 | 旧布局 | 新布局 |
|---|---|---|
| 本地 | `data/uploads/shares/{shareId}/{fileId}` | `data/uploads/assets/{assetId}` |
| S3 | `{s3Path}{shareId}/{fileName}` | `{s3Path}assets/{assetId}` |
| zip(本地) | `shares/{shareId}/archive.zip` | `data/uploads/shares/{shareId}/archive.zip`(zip 仍按 share 缓存) |

- 仅 `type = FILE` 的 Asset 占用存储;TEXT/LINK 不落盘(全在 DB)。
- 上传分块临时文件:`data/uploads/assets/{assetId}.tmp-chunk`(取代旧 `shares/{shareId}/{fileId}.tmp-chunk`)。
- S3 改为按 `assetId` 作 key(与本地对称),不再用文件名作 key —— 顺带修掉旧实现 local/S3 不对称的问题。
- zip 打包:遍历 `share.assets` 中 `type = FILE` 的项,按各自 `storage` 读取字节,用 `asset.name` 作为 zip 内文件名。

> **常量调整**:`SHARE_DIRECTORY` 保留(用于 zip 缓存),新增 `ASSET_DIRECTORY = ${DATA_DIRECTORY}/uploads/assets`。

## 5. 服务抽象

### 5.1 StorageService(LOCAL / S3)

按 `assetId` 读写字节,签名以 assetId 为中心:

- `saveChunk(assetId, data, chunk, totalChunks): Promise<void>` — 写分块,最后一块合并落地。
- `getStream(assetId): Promise<Readable>` — 读文件流(下载用)。
- `remove(assetId): Promise<void>` — 删除底层字节。
- `getSize(assetId): Promise<number>` — 字节大小(S3 落地后回填 size 用)。

LOCAL 与 S3 各实现该接口;`FileService` 现有的 `getStorageService(provider)` 选择逻辑迁移到新的 `StorageService` 工厂(沿用 `s3.enabled` 配置 + per-asset `storage` 覆盖)。

### 5.2 AssetService

- `createFile(meta, chunk, share?, owner?)` — 建/续传 FILE Asset(分块上传,最后一块回填 size/mimeType/storage)。
- `createText({ content }, share?, owner?)` — 建 TEXT Asset。
- `createLink({ url }, share?, owner?)` — 建 LINK Asset。
- `get(assetId)` — 读元数据。
- `getDownloadStream(assetId)` — FILE 下载流;TEXT/LINK 不可下载(抛 400)。
- `remove(assetId)` — 删 DB 行 + 底层字节(FILE)。
- `listByOwner(ownerId)` — standalone(`shareId = null`)+ 该 owner 的 assets。
- `applyRenameRules(name)` — 沿用现有 `fileRename.util` 的改名规则(仅 FILE)。

### 5.3 权限

- **Share 内的 Asset**:沿用现有 Share token / ShareSecurity(密码、maxViews、expiration)。下载校验走 share 的守卫,不变。
- **Standalone Asset**:本期仅 `owner` 自己可 `GET/DELETE/download`(用现有 JwtGuard + owner 校验)。无对外/匿名访问、无独立 security —— 推迟到子项目 2/3。

## 6. API

### 6.1 重构(底层换 Asset,尽量保持前端兼容)

- `/shares` 系列:`create` 仍建 Share;文件上传端点底层改为建 `Asset(type=FILE, shareId)`。Share 的 DTO(`ShareDTO`/`MyShareDTO`/`AdminShareDTO`)把 `files` 字段映射为 assets 中 `type=FILE` 的项(对前端保持 `files`-like 形状,减少前端改动;字段含 `id/name/size/mimeType`)。
- zip / complete / 下载:底层走 Asset,对外行为不变。

> **兼容策略**:Share 相关响应继续暴露 `files: {id,name,size,...}[]`(由 assets 投影而来),这样现有 share 查看页改动最小。新页面才直接用 `/assets`。

### 6.2 新增 `/assets`

| 方法 | 路径 | 说明 | 守卫 |
|---|---|---|---|
| POST | `/assets` | 建 TEXT/LINK,或发起 FILE 分块上传(body 含 type) | JwtGuard(standalone 需登录) |
| GET | `/assets` | 列出我的 standalone assets | JwtGuard |
| GET | `/assets/:id` | 读元数据 | JwtGuard + owner |
| GET | `/assets/:id/download` | FILE 下载流 | JwtGuard + owner |
| DELETE | `/assets/:id` | 删除 | JwtGuard + owner |

DTO:`AssetDTO`(id/type/name?/size?/mimeType?/url?/content?/createdAt);`CreateAssetDTO`(type + 各类型字段)。

## 7. 前端范围(开放点 C)

- **必做**:现有 share **上传**(`showCreateUploadModal`、`Dropzone`、分块上传 service)与 **查看**(`/share/[shareId]`、`FileList`/`FilePreview`)适配到新的 assets 投影,保证不回归(文件上传、列表、下载、zip 全部照旧工作)。
- **新增薄页 `/account/assets`(「我的 Assets」)**:列出 standalone assets(名称/类型/大小/创建时间),支持删除、下载(FILE)。为子项目 2(剪贴板)铺路。复用现有 `ManageTable` 风格组件,不做新设计系统。
- **不做**:standalone 的对外分享 UI、TEXT 富编辑、LINK 预览卡片 —— 留给 2/3 及收尾。

## 8. 受影响范围(后端实测)

- 删/重写:`src/file/` 整个模块(`file.controller.ts`、`file.service.ts`、`local.service.ts`、`s3.service.ts`、`file.module.ts`、dto、guard)→ 迁移为 `src/asset/`(`asset.controller.ts`、`asset.service.ts`、`storage/local.storage.ts`、`storage/s3.storage.ts`、`asset.module.ts`、dto、guard)。
- 改:`prisma/schema.prisma`(Asset/枚举/Share/User,删 File)、`src/share/share.service.ts`(`files`→`assets`、zip、complete、transformShare 投影)、`src/share/share.controller.ts`、Share DTO(`share.dto.ts`/`myShare.dto.ts`/`adminShare.dto.ts`/`shareComplete.dto.ts`)。
- 改:`src/constants.ts`(新增 `ASSET_DIRECTORY`)、`prisma/seed`(若 seed 引用 File)。
- 前端:`services/upload.service`(分块上传)、`showCreateUploadModal.tsx`、`Dropzone.tsx`、`FileList.tsx`、`FilePreview.tsx`、share 查看页、share/account 相关 type(`types/share.type.ts`),新增 `pages/account/assets/index.tsx` + `services/asset.service.ts` + `types/asset.type.ts`。

## 9. 风险

- File→Asset 是破坏性 schema 变更;依赖「可重置数据库」前提,不写数据迁移脚本。
- S3 key 从「文件名」改为 assetId 是行为变更:旧 S3 桶里的对象不再可达(可接受,既定可重置)。
- Share 响应保持 `files`-like 投影以降低前端改动;需保证投影字段与旧 `File` 形状一致(id/name/size,新增 mimeType 可选)。
- standalone Asset 仅 owner 可访问 —— 子项目 2/3 才放开对外访问;本期不要提前引入 security 字段以免返工。
- clamav 扫描:现按 share 目录扫描,需改为按 asset 路径(`checkAndRemove` 适配)。

## 10. 验证基线

- 后端 `npm run build` + 现有 newman 系统测试(`test:system`)通过(share 上传/下载/zip/security 流程不回归)。
- 重置库后:创建 share + 上传多文件 → 列表/下载/zip 正常;TEXT/LINK 通过 `/assets` 能建/读/删。
- 前端 `tsc`/`build` 通过;share 上传查看页人工冒烟;`/account/assets` 列表/删除/下载可用。
- `Asset` 不变式由 `AssetService` 单测覆盖(create 三类型 + 非法组合拒绝)。
- standalone Asset 跨用户访问被拒(owner 校验)。
