# Mantine 6 → 8 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the frontend from Mantine 6.0.21 (emotion-based) to Mantine 8 (native CSS + PostCSS), removing emotion entirely while keeping visual output and behavior equivalent.

**Architecture:** One-shot major upgrade on branch `feat/mantine8-upgrade`. Run the official Mantine codemod for mechanical replacements (`spacing`→`gap`, `position`→`justify`, `Grid.Col span`, imports), then hand-migrate the parts the codemod cannot touch: `createStyles`→CSS Modules, `theme.fn`→CSS variables / Mantine util functions, `<Global>`→a global stylesheet, `<MediaQuery>`→`visibleFrom`/`hiddenFrom`, and the `_app`/`_document` provider wiring (incl. a cookie-backed `colorSchemeManager` to preserve SSR no-flash + admin default color scheme).

**Tech Stack:** Next.js 14 (pages router), React 18.3, Mantine 8 (`@mantine/core`, `@mantine/hooks`, `@mantine/form`, `@mantine/modals`, `@mantine/notifications`, `@mantine/dropzone`), `postcss-preset-mantine`, `postcss-simple-vars`, CSS Modules, `cookies-next`.

## Global Constraints

- **Mantine version floor:** all `@mantine/*` packages pinned to the same `^8` minor (use the latest `8.x` resolved at install time; never mix majors).
- **No new features.** This is a pure migration. Do not add functionality, pages, config keys, or UI affordances.
- **No layout / visual / IA changes.** Output must be visually equivalent in both light and dark color schemes.
- **No new UI system.** Do not introduce Tailwind, shadcn, styled-components, or keep emotion.
- **Do not touch the backend.** No changes under `backend/`.
- **React 18+** (already `react@^18.3.1`, `react-dom@^18.3.1` — satisfies Mantine 8).
- **Preserve these behaviors exactly:**
  - `victoria` palette + `primaryColor: "victoria"` default.
  - Admin dynamic primary color: hex → 10-step scale (`createMantineScaleFromHex`) → `theme.colors.adminPrimary`.
  - Admin-configurable `themeRadius` (default `sm`) and `themeColorScheme` (`system`/`light`/`dark`, default `system`).
  - Custom CSS injection from `appearance.customCss`.
  - Color-scheme cookie `mantine-color-scheme` (`sameSite: lax`) + server-side injection for first-paint no-flash.
  - `Modal` title style (`fontSize: lg`, `fontWeight: 700`).
- **Test gate (this is a UI-library migration — no unit tests are fabricated):** every task's verification is `npx tsc --noEmit` clean for touched files + the project still type-checks, plus `next lint` clean for touched files. The final task adds `next build` + manual light/dark smoke per the spec's verification baseline. A task is "done" only when its listed checks pass.

**Reference spec:** `docs/superpowers/specs/2026-06-25-mantine8-upgrade-design.md`
**Roadmap:** `docs/superpowers/specs/2026-06-25-asset-platform-roadmap.md`

---

## File Structure

New files:
- `frontend/postcss.config.cjs` — PostCSS pipeline for Mantine 8.
- `frontend/src/styles/theme.ts` — `createTheme` theme object (replaces `mantine.style.ts`).
- `frontend/src/styles/global.css` — global rules (replaces `global.style.tsx`).
- `frontend/src/utils/colorSchemeManager.util.ts` — cookie-backed `MantineColorSchemeManager`.
- `frontend/src/styles/header.module.css` and one `*.module.css` beside each of the 11 `createStyles` files.

Deleted files:
- `frontend/src/styles/mantine.style.ts`, `frontend/src/styles/global.style.tsx`, `frontend/src/styles/header.style.ts` (replaced).

Modified files (major): `frontend/package.json`, `frontend/next.config.js` (no change expected — verify only), `frontend/src/pages/_app.tsx`, `frontend/src/pages/_document.tsx`, the 11 `createStyles` consumers, the 8 `theme.fn` files, the 6 `<MediaQuery>` files, the 13 `sx=` files.

---

## Task 1: Dependencies, PostCSS, CSS imports, and codemod

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/postcss.config.cjs`
- Verify (no change expected): `frontend/next.config.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable dependency set on Mantine 8; `postcss-preset-mantine` active so later CSS Modules can use `light-dark()`, `rem()`, `lighten()`, `darken()`, `alpha()`, and Mantine mixins.

- [ ] **Step 1: Remove emotion + old Mantine, install Mantine 8 + PostCSS**

Run (from `frontend/`):

```bash
cd /Users/danqiong/ProgramData/pingvin-share-x/frontend
npm rm @emotion/react @emotion/server @mantine/next
npm i @mantine/core@^8 @mantine/hooks@^8 @mantine/form@^8 @mantine/modals@^8 @mantine/notifications@^8 @mantine/dropzone@^8
npm i -D postcss postcss-preset-mantine postcss-simple-vars
```

Expected: `package.json` no longer lists `@emotion/*` or `@mantine/next`; all `@mantine/*` are on the same `8.x`.

- [ ] **Step 2: Verify no emotion / @mantine/next remain in the manifest**

Run:

```bash
grep -nE '@emotion|@mantine/next' package.json || echo "CLEAN"
```

Expected: prints `CLEAN`.

- [ ] **Step 3: Create the PostCSS config**

Create `frontend/postcss.config.cjs`:

```js
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};
```

- [ ] **Step 4: Confirm next.config.js needs no change**

Read `frontend/next.config.js`. It wraps `withPWA(...)` with `transpilePackages`, `output: "standalone"`, `images.unoptimized`, `env.VERSION`. None of these conflict with Mantine 8. No edit required — this step is a confirmation only.

- [ ] **Step 5: Run the official Mantine codemod**

Run (from `frontend/`):

```bash
npx @mantine/codemod@latest 6-to-7 ./src
npx @mantine/codemod@latest 7-to-8 ./src
```

This mechanically rewrites: `spacing`→`gap` (Stack/Group/etc., 18 files), Group `position`→`justify` (31 files — note it leaves `Tooltip`/`Affix`/`Popover` `position` alone), `Grid.Col span`→`span={{ base: n }}`, and import path adjustments. It does **not** touch `createStyles`, `sx`, `theme.fn`, `<Global>`, `<MediaQuery>`, or the providers — those are Tasks 2–5.

- [ ] **Step 6: Review codemod output and revert false positives**

Run:

```bash
git --no-pager diff --stat
```

Then inspect any `position=` changes on non-`Group` components. Run:

```bash
git --no-pager grep -nE '<(Tooltip|Affix|Popover|FloatingTooltip|HoverCard)[^>]*justify=' src || echo "NO BAD RENAMES"
```

Expected: `NO BAD RENAMES`. If any appear, change that `justify=` back to `position=` on that component (only `Group`/flex layout components take `justify` in v8).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json postcss.config.cjs src
git commit -m "chore(mantine8): upgrade deps, add postcss config, run codemod"
```

---

## Task 2: Theme, global CSS, color-scheme manager, and provider wiring

This is the load-bearing task: `_app.tsx` and `_document.tsx` move off emotion/`@mantine/next` onto Mantine 8's CSS-variable provider, while preserving the cookie no-flash + admin theming behavior verbatim.

**Files:**
- Create: `frontend/src/styles/theme.ts`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/utils/colorSchemeManager.util.ts`
- Delete: `frontend/src/styles/mantine.style.ts`, `frontend/src/styles/global.style.tsx`
- Modify: `frontend/src/pages/_document.tsx`
- Modify: `frontend/src/pages/_app.tsx`

**Interfaces:**
- Produces:
  - `theme.ts` default export: `theme: MantineThemeOverride` (from `createTheme`) containing the `victoria` palette, `primaryColor: "victoria"`, and the `Modal` title component style. **No `colorScheme` key** (removed in v7+).
  - `colorSchemeManager.util.ts` export: `cookieColorSchemeManager(): MantineColorSchemeManager` reading/writing cookie `mantine-color-scheme`.
  - `_app.tsx` keeps using `App.getInitialProps` and the admin theming helpers (`createMantineScaleFromHex`, etc.) unchanged; only the provider tree and theme merge change.

- [ ] **Step 1: Create `frontend/src/styles/theme.ts`**

```ts
import { createTheme, MantineThemeOverride } from "@mantine/core";

const theme: MantineThemeOverride = createTheme({
  colors: {
    victoria: [
      "#E2E1F1",
      "#C2C0E7",
      "#A19DE4",
      "#7D76E8",
      "#544AF4",
      "#4940DE",
      "#4239C8",
      "#463FA8",
      "#47428E",
      "#464379",
    ],
  },
  primaryColor: "victoria",
  components: {
    Modal: {
      styles: {
        title: {
          fontSize: "var(--mantine-font-size-lg)",
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;
```

- [ ] **Step 2: Create `frontend/src/styles/global.css`**

The old `<Global>` used `theme.colorScheme` branching for `table.md` backgrounds. In v8 use `light-dark()` (enabled by `postcss-preset-mantine`).

```css
a {
  color: inherit;
  text-decoration: none;
}

table.md,
table.md th:nth-of-type(odd),
table.md td:nth-of-type(odd) {
  background: light-dark(rgba(220, 220, 220, 0.5), rgba(50, 50, 50, 0.5));
}

table.md td {
  padding-left: 0.5em;
  padding-right: 0.5em;
}
```

- [ ] **Step 3: Create `frontend/src/utils/colorSchemeManager.util.ts`**

Mantine 8 defaults to `localStorage`. To preserve the existing cookie + SSR no-flash behavior, implement a cookie-backed manager using `cookies-next` (already a dependency).

```ts
import { MantineColorScheme, MantineColorSchemeManager } from "@mantine/core";
import { getCookie, setCookie } from "cookies-next";

const COOKIE_KEY = "mantine-color-scheme";

export function cookieColorSchemeManager(): MantineColorSchemeManager {
  let handleStorageEvent: ((event: StorageEvent) => void) | undefined;

  return {
    get: (defaultValue) => {
      if (typeof window === "undefined") return defaultValue;
      const value = getCookie(COOKIE_KEY);
      return (value as MantineColorScheme) || defaultValue;
    },

    set: (value) => {
      setCookie(COOKIE_KEY, value, { sameSite: "lax" });
    },

    subscribe: () => {},

    unsubscribe: () => {
      if (handleStorageEvent) {
        window.removeEventListener("storage", handleStorageEvent);
      }
    },

    clear: () => {
      setCookie(COOKIE_KEY, "", { maxAge: 0 });
    },
  };
}
```

- [ ] **Step 4: Rewrite `frontend/src/pages/_document.tsx`**

Replace `@mantine/next`'s `createGetInitialProps` with `<ColorSchemeScript>`. Keep the manifest/favicon/meta tags.

```tsx
import { ColorSchemeScript } from "@mantine/core";
import Document, { Head, Html, Main, NextScript } from "next/document";

export default class _Document extends Document {
  render() {
    return (
      <Html>
        <Head>
          <ColorSchemeScript defaultColorScheme="auto" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" type="image/x-icon" href="/img/favicon.ico" />
          <link rel="apple-touch-icon" href="/img/icons/icon-128x128.png" />

          <meta name="robots" content="noindex" />
          <meta name="theme-color" content="#46509e" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
```

- [ ] **Step 5: Rewrite the provider wiring in `frontend/src/pages/_app.tsx`**

Make these changes (keep `App.getInitialProps` and all the hex-scale helpers `normalizeHexColor`/`hexToRgb`/`rgbToHex`/`mixHexColors`/`createMantineScaleFromHex` and the `availableMantineColors`/`availableMantineRadii` arrays unchanged):

1. Replace the import block top:

```tsx
import {
  Container,
  MantineColorScheme,
  MantineProvider,
  MantineThemeOverride,
  Stack,
  mergeThemeOverrides,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "../styles/global.css";
```

   - Remove imports of `ColorScheme`, `ColorSchemeProvider`, `useColorScheme`, `GlobalStyle` (`../styles/global.style`), and `globalStyle` (`../styles/mantine.style`).
   - Add: `import theme from "../styles/theme";` and `import { cookieColorSchemeManager } from "../utils/colorSchemeManager.util";`.

2. Remove the manual color-scheme state. Delete these lines:

```tsx
const systemTheme = useColorScheme(pageProps.colorScheme);
...
const [colorScheme, setColorScheme] = useState<ColorScheme>(systemTheme);
```

   and delete the `toggleColorScheme` function plus the `useEffect` that calls it (the block starting `const userColorPreference = userPreferences.get("colorScheme");`). Color scheme is now owned by `MantineProvider` + the cookie manager. The admin default + user preference is applied via `forceColorScheme`/`defaultColorScheme` below.

3. Compute the effective default color scheme (replaces the deleted effect) as a derived value:

```tsx
const userColorPreference = userPreferences.get("colorScheme");
const defaultColorScheme: MantineColorScheme = (
  user
    ? (userColorPreference ?? "system")
    : adminDefaultColorScheme
) as MantineColorScheme;
```

4. Replace the `mergedTheme` construction. `createTheme` objects merge with `mergeThemeOverrides`; `colorScheme` is no longer part of the theme:

```tsx
const mergedTheme: MantineThemeOverride = mergeThemeOverrides(
  theme,
  adminTheme,
);
```

   (Delete the old `mergedTheme` object literal that spread `globalStyle`, `adminTheme`, `colorScheme`, and merged `colors`.)

5. Replace the JSX provider tree (the `<MantineProvider ...>...</MantineProvider>` block) with:

```tsx
<MantineProvider
  theme={mergedTheme}
  defaultColorScheme={defaultColorScheme}
  colorSchemeManager={cookieColorSchemeManager()}
>
  {customCss && (
    <style id="admin-custom-css">
      {customCss.replace(/<\/style/gi, "<\\/style")}
    </style>
  )}
  <Notifications />
  <ModalsProvider>
    <ConfigContext.Provider
      value={{
        configVariables,
        refresh: async () => {
          setConfigVariables(await configService.list());
        },
      }}
    >
      <UserContext.Provider
        value={{
          user,
          refreshUser: async () => {
            const user = await userService.getCurrentUser();
            setUser(user);
            return user;
          },
        }}
      >
        {excludeDefaultLayoutRoutes.includes(route) ? (
          <Component {...pageProps} />
        ) : (
          <Stack justify="space-between" mih="100vh">
            <div>
              <Header />
              <Container>
                <Component {...pageProps} />
              </Container>
            </div>
            <Footer />
          </Stack>
        )}
      </UserContext.Provider>
    </ConfigContext.Provider>
  </ModalsProvider>
</MantineProvider>
```

   Note: `withGlobalStyles withNormalizeCSS` removed (replaced by the CSS imports), `<ColorSchemeProvider>` and `<GlobalStyle />` removed, and the `<Stack sx={{ minHeight: "100vh" }}>` became `<Stack mih="100vh">`.

6. In `App.getInitialProps`, the `colorScheme` cookie read is now only needed if any other code consumes `pageProps.colorScheme`. Remove the `colorScheme` field from the `pageProps` type and object since `<ColorSchemeScript>` + the cookie manager handle first paint. Change the initializer to:

```tsx
let pageProps: {
  user?: CurrentUser;
  configVariables?: Config[];
  route?: string;
  language?: string;
} = {
  route: ctx.resolvedUrl,
};
```

   (Drop the `getCookie("mantine-color-scheme", ctx)` line and the `ColorScheme` import usage there.)

- [ ] **Step 6: Migrate the color-scheme toggle consumer(s)**

The old `toggleColorScheme` was passed via `ColorSchemeProvider`. Find consumers:

```bash
git --no-pager grep -nE 'useMantineColorScheme|toggleColorScheme|ColorSchemeProvider|useColorScheme' src
```

For each consumer (e.g. the header's light/dark switch), replace usage of the context with the v8 hook:

```tsx
import { useMantineColorScheme } from "@mantine/core";
// ...
const { colorScheme, setColorScheme, toggleColorScheme } =
  useMantineColorScheme();
```

`toggleColorScheme()` flips light/dark. To read whether dark is active where code previously compared `colorScheme === "dark"`, use `useComputedColorScheme("light")` (resolves `auto`):

```tsx
import { useComputedColorScheme } from "@mantine/core";
const computed = useComputedColorScheme("light");
const dark = computed === "dark";
```

Update each consumer accordingly (do not change which icon/label shows — only the data source).

- [ ] **Step 7: Delete the replaced style files**

```bash
git rm src/styles/mantine.style.ts src/styles/global.style.tsx
```

- [ ] **Step 8: Type-check the touched files**

Run (from `frontend/`):

```bash
npx tsc --noEmit
```

Expected: no errors originating in `_app.tsx`, `_document.tsx`, `theme.ts`, `colorSchemeManager.util.ts`, or the toggle consumers. (Errors from not-yet-migrated `createStyles`/`theme.fn`/`MediaQuery`/`sx` files are expected here and handled in Tasks 3–5 — note them but they don't block this task's provider work. If you prefer a clean gate, defer this `tsc` run's pass criterion to Task 6 and only confirm no *new provider-related* errors.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(mantine8): migrate theme, global css, color scheme manager, providers"
```

---

## Task 3: Migrate `createStyles` (11 files) to CSS Modules

`createStyles` is removed in v7+. Each file gets a co-located `*.module.css`. Mantine CSS variables replace `theme.*` references; `theme.fn.largerThan/smallerThan` become media queries; `theme.colorScheme` branches become `light-dark()` or `[data-mantine-color-scheme]` selectors.

**The 11 files:** `src/styles/header.style.ts`, `src/components/auth/SignInForm.tsx`, `src/components/admin/configuration/ConfigurationNavBar.tsx`, `src/components/header/Header.tsx`, `src/components/upload/Dropzone.tsx`, `src/pages/index.tsx`, `src/pages/404.tsx`, `src/pages/error.tsx`, `src/pages/auth/resetPassword/index.tsx`, `src/pages/auth/resetPassword/[resetPasswordToken].tsx`, `src/pages/admin/index.tsx`.

**Interfaces:**
- Consumes: Mantine 8 CSS variables (`--mantine-spacing-md`, `--mantine-radius-sm`, `--mantine-font-size-sm`, `--mantine-color-dark-0`, `--mantine-color-gray-7`, `--mantine-primary-color-0`, etc.) and breakpoint vars from `postcss.config.cjs`.
- Produces: each former `useStyles()` call site uses `import classes from "./X.module.css"` and `className={classes.name}` (and `cx`→`clsx` if combining).

**Migration recipe (apply per file):**
- `theme.spacing.md` → `var(--mantine-spacing-md)`
- `theme.radius.sm` → `var(--mantine-radius-sm)`
- `theme.fontSizes.sm` → `var(--mantine-font-size-sm)`
- `theme.colors.dark[0]` → `var(--mantine-color-dark-0)`; `theme.colors.gray[7]` → `var(--mantine-color-gray-7)`
- `theme.colors[theme.primaryColor][N]` → `var(--mantine-primary-color-N)` (only `0`,`1`...`9` exist; `light`/`filled` variants also available, but the existing code uses numeric indices)
- `theme.colorScheme === "dark" ? A : B` → `light-dark(B, A)`
- `theme.fn.largerThan("sm")` → `@media (min-width: $mantine-breakpoint-sm)`
- `theme.fn.smallerThan("sm")` → `@media (max-width: $mantine-breakpoint-sm)` (use `em`-based; the simple-vars provide the value)
- `theme.fn.rgba(color, a)` → `alpha(color, a)` (postcss-preset-mantine mixin) or a literal `rgba(...)` if the color is static
- `cx(...)` → `clsx(...)` from the `clsx` package (Mantine 8 ships it transitively; if not resolvable, `npm i clsx`)

- [ ] **Step 1: Migrate `src/styles/header.style.ts` → `src/styles/header.module.css`**

Create `frontend/src/styles/header.module.css`:

```css
.root {
  position: relative;
  z-index: 1;
}

.dropdown {
  position: absolute;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 0;
  border-top-right-radius: 0;
  border-top-left-radius: 0;
  border-top-width: 0;
  overflow: hidden;
}

@media (min-width: $mantine-breakpoint-sm) {
  .dropdown {
    display: none;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

@media (max-width: $mantine-breakpoint-sm) {
  .links {
    display: none;
  }
}

@media (min-width: $mantine-breakpoint-sm) {
  .burger {
    display: none;
  }
}

.link {
  display: block;
  line-height: 1;
  padding: 8px 12px;
  border-radius: var(--mantine-radius-sm);
  text-decoration: none;
  color: light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-0));
  font-size: var(--mantine-font-size-sm);
  font-weight: 500;
}

.link:hover {
  background-color: light-dark(
    var(--mantine-color-gray-0),
    var(--mantine-color-dark-6)
  );
}

@media (max-width: $mantine-breakpoint-sm) {
  .link {
    border-radius: 0;
    padding: var(--mantine-spacing-md);
  }
}

.linkActive,
.linkActive:hover {
  background-color: light-dark(
    var(--mantine-primary-color-0),
    alpha(var(--mantine-primary-color-9), 0.25)
  );
  color: light-dark(
    var(--mantine-primary-color-7),
    var(--mantine-primary-color-3)
  );
}
```

Then `git rm src/styles/header.style.ts` and update `src/components/header/Header.tsx` to `import classes from "../../styles/header.module.css"` (see Step 2).

- [ ] **Step 2: Migrate `src/components/header/Header.tsx`**

Read the file. Replace `const { classes, cx } = useStyles();` (the import from `../../styles/header.style`) with:

```tsx
import classes from "../../styles/header.module.css";
import clsx from "clsx";
```

Replace every `cx(classes.link, { [classes.linkActive]: condition })` with `clsx(classes.link, { [classes.linkActive]: condition })`. Replace any `theme.fn`/`theme.colorScheme` reads in the component body per Task 4's recipe (this file also appears in the `theme.fn` list — finish both here). Keep all JSX/markup identical.

- [ ] **Step 3: Migrate the remaining 9 `createStyles` files**

For each of: `src/components/auth/SignInForm.tsx`, `src/components/admin/configuration/ConfigurationNavBar.tsx`, `src/components/upload/Dropzone.tsx`, `src/pages/index.tsx`, `src/pages/404.tsx`, `src/pages/error.tsx`, `src/pages/auth/resetPassword/index.tsx`, `src/pages/auth/resetPassword/[resetPasswordToken].tsx`, `src/pages/admin/index.tsx`:

  1. Read the file's `createStyles((theme) => ({ ... }))` block.
  2. Create a sibling `<basename>.module.css` translating each rule using the migration recipe above.
  3. Replace the `createStyles` import + `useStyles()` call with `import classes from "./<basename>.module.css"` and (if it used `cx`) `import clsx from "clsx"`.
  4. Replace `classes.x`/`cx(...)` references in JSX; leave markup unchanged.
  5. Delete the now-empty style block / `useStyles` declaration.

Locate each call shape first:

```bash
git --no-pager grep -nE 'createStyles|useStyles' src
```

- [ ] **Step 4: Confirm no `createStyles` remain**

```bash
git --no-pager grep -nE 'createStyles|makeStyles' src || echo "NO createStyles"
```

Expected: `NO createStyles`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `createStyles`, `useStyles`, `classes`, or `*.module.css` imports. (CSS Module default imports type as `Record<string,string>` via Next's built-in declaration — no extra `.d.ts` needed.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(mantine8): migrate createStyles to CSS Modules"
```

---

## Task 4: AppShell v7 rewrite + removed layout primitives

> **Scope note (discovered during execution):** Task 1's manual codemod only applied `position`→`justify` and `spacing`→`gap` (the official `@mantine/codemod` package was unreachable). The remaining v7/v8 deltas the codemod would have done are therefore split across Tasks 4–5. Task 4 is the **judgment-heavy structural** wave: Mantine v7 fully rewrote `AppShell` and removed the standalone `Header`/`Navbar`/`Footer` layout exports. Task 5 is the mechanical prop/API sweep.

**Goal of this task:** Drive the 5 layout files below to compile under Mantine 8 with visually-equivalent layout, replacing removed exports and the old AppShell API. Fix ALL deltas in these 5 files (including their own prop renames, `<MediaQuery>`, and `theme.colorScheme`) since you're restructuring them anyway.

**Files:**
- Modify: `src/pages/admin/config/[category].tsx` (v6 AppShell → v7 AppShell)
- Modify: `src/components/admin/configuration/ConfigurationHeader.tsx`
- Modify: `src/components/admin/configuration/ConfigurationNavBar.tsx`
- Modify: `src/components/footer/Footer.tsx`
- Modify: `src/components/header/Header.tsx`

**Background — Mantine v6 → v7 AppShell change:**
- v6: `<AppShell navbar={<Navbar.../>} header={<Header.../>} styles={{ main: {...} }}>{children}</AppShell>` with standalone `<Header height={60}>`, `<Navbar width={{sm:200,lg:300}} hiddenBreakpoint="sm" hidden={...}>`, `<Navbar.Section>`.
- v7+: `<AppShell header={{ height: 60 }} navbar={{ width: { sm: 200, lg: 300 }, breakpoint: "sm", collapsed: { mobile: !opened } }} padding="md">` with `<AppShell.Header>`, `<AppShell.Navbar>`, `<AppShell.Main>` as children. There is no `Navbar.Section` (use a `Box`/`div`/`AppShell.Section`). `Header`/`Navbar`/`Footer` are no longer top-level `@mantine/core` exports.

- [ ] **Step 1: Rewrite `src/pages/admin/config/[category].tsx` to the v7 AppShell API**

Replace the `<AppShell ...>` usage. The current code passes `navbar={<ConfigurationNavBar .../>}` and `header={<ConfigurationHeader .../>}` and a `styles.main` background that branches on `theme.colorScheme`. New shape:

```tsx
<AppShell
  header={{ height: 60 }}
  navbar={{
    width: { sm: 200, lg: 300 },
    breakpoint: "sm",
    collapsed: { mobile: !isMobileNavBarOpened },
  }}
  padding="md"
  styles={{
    main: {
      background: "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))",
    },
  }}
>
  <AppShell.Header>
    <ConfigurationHeader
      isMobileNavBarOpened={isMobileNavBarOpened}
      setIsMobileNavBarOpened={setIsMobileNavBarOpened}
    />
  </AppShell.Header>
  <AppShell.Navbar>
    <ConfigurationNavBar
      categoryId={categoryId}
      isMobileNavBarOpened={isMobileNavBarOpened}
      setIsMobileNavBarOpened={setIsMobileNavBarOpened}
    />
  </AppShell.Navbar>
  <AppShell.Main>
    <Container size="lg">
      {/* ...existing body unchanged... */}
    </Container>
  </AppShell.Main>
</AppShell>
```

Remove the now-unused `useMantineTheme()` import/usage in this file if the `theme.colorScheme` read was the only consumer (the `light-dark()` string above replaces it). `useMediaQuery` from `@mantine/hooks` stays (it is NOT removed in v8). Also rename any `sx` in this file's body in Step-5 style (the two `<Text sx={{ whiteSpace: "pre-line" }} color="dimmed" ...>` → `style={{ whiteSpace: "pre-line" }} c="dimmed"`) so this file reaches zero errors.

- [ ] **Step 2: Rewrite `ConfigurationHeader.tsx`**

It now renders INSIDE `<AppShell.Header>`, so drop the removed `<Header height={60} p="md">` wrapper and return a padded `Box` instead. Replace `<MediaQuery>` with `visibleFrom`/`hiddenFrom`, and `weight={600}` → `fw={600}`:

```tsx
import { Box, Burger, Button, Group, Text } from "@mantine/core";
// ...
return (
  <Box px="md" h="100%">
    <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
      <Group justify="space-between" w="100%">
        <Link href="/" passHref>
          <Group>
            <Logo height={35} width={35} />
            <Text fw={600}>{config.get("general.appName")}</Text>
          </Group>
        </Link>
        <Button visibleFrom="sm" variant="light" component={Link} href="/admin">
          <FormattedMessage id="common.button.go-back" />
        </Button>
      </Group>
      <Burger
        hiddenFrom="sm"
        opened={isMobileNavBarOpened}
        onClick={() => setIsMobileNavBarOpened((o) => !o)}
        size="sm"
      />
    </div>
  </Box>
);
```

(`<MediaQuery smallerThan="sm" styles={{display:"none"}}>` = hidden below sm = `visibleFrom="sm"`; `<MediaQuery largerThan="sm" ...>` = hidden at sm+ = `hiddenFrom="sm"`.)

- [ ] **Step 3: Rewrite `ConfigurationNavBar.tsx`**

It now renders inside `<AppShell.Navbar>`. Drop the removed `<Navbar ... width hiddenBreakpoint hidden>` wrapper and `<Navbar.Section>`; return a `Box`/`Stack` of the content. Keep the existing `ConfigurationNavBar.module.css` `.activeLink` usage. Replace `<MediaQuery largerThan="sm">` with `hiddenFrom="sm"` and `color="dimmed"` → `c="dimmed"`:

```tsx
import { Box, Button, Group, Stack, Text, ThemeIcon } from "@mantine/core";
// ...
return (
  <Box p="md" h="100%" style={{ display: "flex", flexDirection: "column" }}>
    <Box>
      <Text size="xs" c="dimmed" mb="sm">
        <FormattedMessage id="admin.config.title" />
      </Text>
      <Stack gap="xs">
        {categories.map((category) => (
          /* ...existing Box/Group/ThemeIcon/Text item unchanged except c="dimmed" if any... */
        ))}
      </Stack>
    </Box>
    <Button
      hiddenFrom="sm"
      mt="xl"
      pt="sm"
      pb="sm"
      variant="light"
      component={Link}
      href="/admin"
    >
      <FormattedMessage id="common.button.go-back" />
    </Button>
  </Box>
);
```

If `ConfigurationNavBar.module.css` `.navbar` (the media-query-only rule) is now unused after removing the `<Navbar>` wrapper, delete that rule; leave `.activeLink` intact.

- [ ] **Step 4: Rewrite `Footer.tsx`**

`Footer` is rendered standalone in `_app`'s layout `<Stack>` (NOT in an AppShell), so the removed `<Footer as MFooter height="auto" py px zIndex>` becomes a `Box component="footer"`. Also rename `color`→`c` and `align`→`ta` on `Text`:

```tsx
import { Anchor, Box, SimpleGrid, Text } from "@mantine/core";
// ...
return (
  <Box component="footer" py={6} px="xl" style={{ zIndex: 100 }}>
    {!config.get("legal.enabled") && (
      <Text size="xs" c="dimmed" ta="center">
        Powered by{" "}
        <Anchor size="xs" href="https://github.com/smp46/pingvin-share-x" target="_blank">
          Pingvin Share X
        </Anchor>
      </Text>
    )}
    {config.get("legal.enabled") && (
      <SimpleGrid cols={isMobile ? 2 : 3} m={0}>
        {!isMobile && <div></div>}
        <Text size="xs" c="dimmed" ta={isMobile ? "left" : "center"}>
          {/* ...unchanged... */}
        </Text>
        <div>
          <Text size="xs" c="dimmed" ta="right">
            {/* ...unchanged... */}
          </Text>
        </div>
      </SimpleGrid>
    )}
  </Box>
);
```

`useMediaQuery` stays (not removed in v8).

- [ ] **Step 5: Rewrite the `Header` primitive in `src/components/header/Header.tsx`**

This is the main site header (rendered in `_app` layout). Replace the removed `Header as MantineHeader` with a `Box`:

```tsx
// import: remove `Header as MantineHeader`, add `Box`
<Box component="header" h={HEADER_HEIGHT} mb={0} className={classes.root}>
  {/* ...existing header content unchanged... */}
</Box>
```

Apply any `weight`/`align`/`color`/`leftIcon` renames present in this file (the tsc errors will name them) so the file reaches zero errors.

- [ ] **Step 6: Verify these 5 files compile**

Run (from `frontend/`):

```bash
npx tsc --noEmit 2>&1 | grep -E 'category|ConfigurationHeader|ConfigurationNavBar|footer/Footer|header/Header.tsx' || echo "5 LAYOUT FILES CLEAN"
```

Expected: `5 LAYOUT FILES CLEAN`. Errors remaining in OTHER files (prop renames, sx, Col, etc.) are expected — they are Task 5.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(mantine8): rewrite AppShell to v7 API, replace removed layout primitives"
```

---

## Task 5: Mechanical v8 prop/API sweep — drive `tsc` to zero

**Goal:** Resolve every remaining Mantine v7/v8 delta across all other files so `npx tsc --noEmit` returns **zero errors**. This is mechanical and repetitive; the compiler errors are your worklist — each names the file, line, component, and offending prop. The done-condition is unambiguous: `tsc` clean.

**Files:** all files still reporting `tsc` errors after Task 4 (~35 files). Do NOT re-touch the 5 layout files from Task 4. Do NOT touch `backend/`.

**Rename / fix table (apply per compiler error — the error's target component disambiguates which rule applies):**

| v6 (old) | v8 (new) | Applies to |
|---|---|---|
| `weight={n}` | `fw={n}` | `Text`, `Title` |
| `align="x"` | `ta="x"` | `Text`, `Title` **only** — do NOT change `align` on `Group`/`Stack`/`Flex`/`Grid` (there it stays `align` = align-items) |
| `color="dimmed"` / `color="x"` | `c="x"` | `Text`, `Title`, `Anchor` **only** — do NOT change `color` on `Button`/`Badge`/`ThemeIcon`/`Alert`/`ActionIcon` (there `color` stays) |
| `icon={<X/>}` | `leftSection={<X/>}` | inputs: `TextInput`, `PasswordInput`, `FileInput`, `Select`, etc. |
| `leftIcon={<X/>}` | `leftSection={<X/>}` | `Button` |
| `rightIcon={<X/>}` | `rightSection={<X/>}` | `Button` |
| `<Col xs={6}>` | `<Grid.Col span={{ base: 12, xs: 6 }}>` | `showCreateReverseShareModal.tsx`, `showCreateUploadModal.tsx`, `admin/index.tsx` — remove the `Col` import; use `Grid.Col` |
| `precision={0}` | `decimalScale={0}` | `NumberInput` (`FileSizeInput.tsx`, `TimespanInput.tsx`) |
| `sx={{...}}` | `style={{...}}` (static values) or a `*.module.css` + `className` (theme/responsive/pseudo) | any component (16 occurrences) |
| `theme.colorScheme === "dark" ? A : B` (in JSX, not styles) | `const computedColorScheme = useComputedColorScheme("light");` then `computedColorScheme === "dark" ? A : B` | `FilePreview.tsx`, `showCompletedUploadModal.tsx`, `imprint/index.tsx`, `privacy/index.tsx`, `admin/index.tsx` |
| `<MediaQuery smallerThan="md" styles={{display:"none"}}>` | `hiddenFrom`/`visibleFrom` on the child (or wrap in `<Box hiddenFrom="md">`) | `ManageShareTable.tsx` |

- [ ] **Step 1: NumberInput `onChange` value coercion (`FileSizeInput.tsx`, `TimespanInput.tsx`)**

In v8 `NumberInput`'s `onChange` value is `number | string`. Coerce to a number before arithmetic. In `FileSizeInput.tsx`:

```tsx
onChange={(value) => {
  const inputVal = typeof value === "number" ? value : Number(value) || 0;
  setInputValue(inputVal);
  onChange(multipliers[unit] * inputVal);
}}
```

In `TimespanInput.tsx`:

```tsx
onChange={(value) => {
  const inputVal = typeof value === "number" ? value : Number(value) || 0;
  setInputValue(inputVal);
  onChange({ value: inputVal, unit });
}}
```

Also `precision={0}` → `decimalScale={0}` in both. If `inputValue` state is typed `number`, keep it `number` (the coercion guarantees it).

- [ ] **Step 2: Fix `src/utils/toast.util.tsx` notifications API**

v7+ removed the standalone `showNotification` export; use `notifications.show`. Verify the exact exported type name in the installed package (it may be `NotificationData` rather than `NotificationProps`):

```bash
grep -nE 'export (declare )?(function|const|interface|type) (showNotification|notifications|NotificationData|NotificationProps)' node_modules/@mantine/notifications/lib/*.d.ts node_modules/@mantine/notifications/**/*.d.ts 2>/dev/null | head
```

Then update the import to `{ notifications }` (+ the correct props type) and replace `showNotification(x)` calls with `notifications.show(x)`. The notification option keys (`title`, `message`, `color`, `icon`, `loading`, `autoClose`) are unchanged.

- [ ] **Step 3: `TextEditor.tsx` inline `theme.fn` + `theme.colorScheme`**

`TextEditor.tsx` passes a Mantine `styles` callback using `theme.fn.smallerThan("sm")` (×2) and reads `theme.colorScheme`. Move the responsive rules into a co-located `TextEditor.module.css` (`@media (max-width: $mantine-breakpoint-sm) { ... }`) applied via `className`, and replace the `theme.colorScheme` read with `useComputedColorScheme("light")`. Preserve the editor's rendered appearance.

- [ ] **Step 4: Apply the rename table across all remaining files**

Work through the `tsc` errors. For each error, apply the matching rule from the table. Re-run `npx tsc --noEmit` frequently and let the shrinking error list guide you. For `sx`, prefer `style={{...}}` when the object is static CSS (e.g. `sx={{ whiteSpace: "pre-line" }}` → `style={{ whiteSpace: "pre-line" }}`, `sx={{ display:"flex", overflowX:"auto" }}` → `style={{ display:"flex", overflowX:"auto" }}`); use a `*.module.css` + `className` only when the `sx` referenced theme functions, pseudo-classes, or breakpoints.

- [ ] **Step 5: Verify zero type errors**

```bash
npx tsc --noEmit 2>&1 | grep -cE 'error TS'
```

Expected: `0`. Then confirm no v6 API remnants:

```bash
git grep -nE 'showNotification|<MediaQuery|theme\.fn|theme\.colorScheme|<Col |leftIcon=| sx=' src || echo "NO V6 API REMNANTS"
```

Expected: `NO V6 API REMNANTS` (note: `useMediaQuery` hook and `align`/`color` on layout components are legitimately retained and won't match these patterns).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(mantine8): sweep prop renames, sx, Col, NumberInput, notifications APIs to v8"
```

---

## Task 6: Full build, lint, and manual smoke verification

**Files:** none created; this is the acceptance gate for the spec's verification baseline. Also fold in the Minor findings recorded in the progress ledger (e.g. the `colorSchemeManager` dead-code cleanup) if trivial.

- [ ] **Step 1: Full type-check**

```bash
cd /Users/danqiong/ProgramData/pingvin-share-x/frontend
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors (warnings acceptable only if pre-existing). Fix any new errors introduced by the migration.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds; no emotion/`@mantine/next` resolution errors, no "createStyles is not exported", no "Header/Navbar/Footer/Col/MediaQuery is not exported" errors.

- [ ] **Step 4: Confirm emotion + v6 API fully removed**

```bash
git grep -nE '@emotion|@mantine/next|createStyles|ColorSchemeProvider|withGlobalStyles|showNotification|<MediaQuery|theme\.fn|theme\.colorScheme' src || echo "FULLY MIGRATED"
grep -nE '@emotion|@mantine/next' package.json || echo "PKG CLEAN"
```

Expected: `FULLY MIGRATED` and `PKG CLEAN`.

- [ ] **Step 5: Manual smoke (light + dark, per spec §9)**

Run `npm run dev` (with the backend running, or `API_URL` set). For each, verify visual + functional equivalence in **both** color schemes:
- `/` (home/upload entry), `/upload`
- `/share/[shareId]` — markdown render, file list, password modal
- `/account`, `/account/shares`, `/account/reverseShares`
- `/admin`, `/admin/config/[category]` — **AppShell layout (header + responsive navbar + mobile burger) intact**, dynamic primary color (incl. `custom` hex → `adminPrimary`), `themeRadius`, custom CSS all take effect
- `/auth/signIn`, `/auth/signUp`, reset-password flow, TOTP
- Footer (legal on/off), notification toasts, confirm modals, dropzone drag-and-drop, color-scheme toggle with **no first-paint flash**

Record any visual regression and fix it before sign-off.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(mantine8): finalize upgrade — build, lint, smoke verified"
```

---

## Self-Review Notes

- **Spec coverage:** deps/emotion removal (T1), PostCSS (T1), `_document` ColorSchemeScript (T2), `_app` provider rewrite + cookie manager + admin theming preserved (T2), `createStyles`→CSS Modules ×11 (T3), `theme.fn` ×8 (T3 in-style + T4 inline) and `<MediaQuery>` ×6 (T4), `sx` ×13 + modals/notifications/dropzone/form deltas (T5), build/lint/no-emotion/manual smoke baseline (T6). victoria palette, adminPrimary hex scale, themeRadius, themeColorScheme, custom CSS, color cookie no-flash, Modal title style — all carried in T2/T3 with verbatim values.
- **Type consistency:** `cookieColorSchemeManager()` (T2) consumed in `_app.tsx` (T2). `theme` default export (T2) consumed via `mergeThemeOverrides(theme, adminTheme)` (T2). CSS Module default-import pattern consistent across T3/T4/T5.
- **Note on test gate:** UI-library migration — gate is `tsc --noEmit` + `next lint` + `next build` + manual light/dark smoke, not unit tests. Stated in Global Constraints and applied per task.

