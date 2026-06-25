# 子项目 0 设计:Mantine 6 → 8 升级

> 路线图见 `2026-06-25-asset-platform-roadmap.md`。本子项目无依赖,是整个重构的地基。
> 日期:2026-06-25。

## 1. 目标与非目标

**目标**
- 升级 `@mantine/*` 6.0.21 → 8.x(最新稳定)。
- 移除 emotion 运行时(`@emotion/react`、`@emotion/server`、`@mantine/next`)。
- 以 PostCSS(`postcss-preset-mantine`)+ CSS Modules 取代 `createStyles` / `sx` / `<Global>`。
- 在 Mantine 8 API 下重建主题与配色系统,**视觉与功能保持等价**。
- 升级后 `next build` 与 `next lint` 通过,核心页面人工冒烟通过。

**非目标(明确排除)**
- 不新增任何功能。
- 不改页面布局 / 信息架构 / 视觉风格(留给子项目 1/2/3 的重设计)。
- 不引入 Tailwind / shadcn 或其他 UI 体系。
- 不动后端。

## 2. 执行策略(已确认)

1. **目标版本:直上 Mantine 8**,不在 7 停留。
2. **codemod 优先**:先跑 Mantine 官方 codemod(`npx @mantine/codemod`)做批量机械替换,
   再手工修复 codemod 覆盖不到的部分。
3. 一次性切换,不做 v6/v7 并存(并存需 emotion + CSS 双引擎,得不偿失)。

## 3. 技术栈变更

| 项 | 现状 (v6) | 目标 (v8) |
|---|---|---|
| 样式引擎 | emotion | 原生 CSS + `postcss-preset-mantine` |
| 局部样式 | `createStyles` / `sx` | `*.module.css` + Mantine CSS 变量 |
| 全局样式 | `<Global>` | 全局 `.css`(在 `_app` 引入) |
| SSR | `@mantine/next` `createGetInitialProps` | `ColorSchemeScript` in `_document` |
| 配色切换 | `ColorSchemeProvider` + `useColorScheme` + cookie | `MantineProvider` `colorScheme` + `useMantineColorScheme`,自定义 colorSchemeManager 保留 cookie/SSR |
| 主题对象 | `MantineThemeOverride`(含 `colorScheme`) | `createTheme`(不含 `colorScheme`) |
| 富文本 | `@uiw/react-md-editor` | 保持(独立于 Mantine) |

## 4. 受影响范围(已实测)

- `createStyles`:**11 文件** → 各自就近建 `*.module.css`。
- `sx=`:**13 文件** → 改 `style` / `className` / `Box` 样式属性。
- `spacing=`:**18 文件** → Stack/Group 改 `gap`(codemod 覆盖)。
- `position=`:**31 文件** → Group 改 `justify`(codemod 覆盖,需甄别 `Tooltip`/`Affix` 等仍叫 `position` 的)。
- `theme.fn`:**8 文件** → 改 CSS 变量 / `lighten`/`darken`/`alpha` 函数。
- `<MediaQuery>`:**6 文件** → 改 `visibleFrom`/`hiddenFrom` 或 CSS Modules 媒体查询。
- `Grid.Col span`:改 `span={{ base: n }}` 写法。
- `_app.tsx`:重写 `MantineProvider` 用法(去 `withGlobalStyles`/`withNormalizeCSS`,引入 styles.css)、
  `ColorSchemeProvider` → 内置 + `useMantineColorScheme`、`<Global>` 移除、主题合并逻辑适配 `createTheme`。
- `_document.tsx`:`@mantine/next` → `<ColorSchemeScript>`。
- `styles/mantine.style.ts`、`styles/global.style.tsx`、`styles/header.style.ts`:重写为 `theme.ts` + CSS。

## 5. 需保留的现有行为

- victoria 调色板与 `primaryColor: "victoria"` 默认。
- admin 动态主色:hex → 10 级色阶生成(`createMantineScaleFromHex`)→ `theme.colors.adminPrimary`。
- admin 可配置 `themeRadius` / `themeColorScheme`(system/light/dark)默认值。
- custom CSS 注入(`appearance.customCss`)。
- 配色 cookie(`mantine-color-scheme`)+ 服务端注入实现首屏无闪烁。
- `@mantine/modals`、`@mantine/notifications`、`@mantine/dropzone`、`@mantine/form` 全部保留功能。

## 6. CSS 引入清单(v8 必需)

在 `_app.tsx` 顶部按序引入:
```
@mantine/core/styles.css
@mantine/notifications/styles.css
@mantine/dropzone/styles.css
```
(`@mantine/modals`、`@mantine/form` 无独立 CSS。)

## 7. 配色管理器设计

Mantine 8 默认用 `localStorage`。为保留现有"服务端 cookie 注入 + 首屏无闪烁 + admin 默认配色"行为,
实现一个 **cookie 版 `MantineColorSchemeManager`**:
- `get`/`set` 读写 `mantine-color-scheme` cookie(`sameSite: lax`)。
- 在 `_document` 用 `<ColorSchemeScript>` 输出初始 `data-mantine-color-scheme`。
- admin 默认配色仍由 `_app` 在无用户偏好时计算。

## 8. 风险

- Mantine 8 要求 React 18+(已满足:React 18.3)。
- `modals`/`notifications`/`dropzone` v8 有小幅 API 变更,需逐一核对。
- `next-pwa` 与 Next 14 兼容,不受本升级影响。
- codemod 不处理 `createStyles` 与 `theme.fn`,这两类必须手工迁移——是工作量主体。

## 9. 验证基线

升级前后逐页人工对照(深浅色各一遍):
- `/`(首页/上传入口)、`/upload`、`/share/[shareId]`(分享查看,含 md 渲染、文件列表、密码弹窗)
- `/account`、`/account/shares`、`/account/reverseShares`
- `/admin`、`/admin/config/[category]`(动态主色/圆角/自定义 CSS 生效)
- `/auth/signIn`、`/auth/signUp`、reset password、totp
- 通知 toast、确认 modal、dropzone 拖拽、配色切换无首屏闪烁。

验收门槛:`next build` 通过、`next lint` 通过、上述页面视觉与功能等价、无 emotion 残留依赖。
