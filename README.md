# TokenOrb

A lightweight, always-on-top desktop orb built with Electron + React 19 + TypeScript that
shows your [MiniMax](https://www.minimaxi.com) token balance in real time. The collapsed
form is a transparent, click-through-free 96×96 frosted-glass ball; a single click expands
it into a 340×560 details panel and a 340×660 settings view.

The renderer is fully sandboxed (`contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`) and only talks to Electron through a small `contextBridge` surface defined
in `electron/preload.ts`. Credential storage delegates to the operating system's secure
storage via Electron's `safeStorage`; nothing leaves the machine in plaintext.

---

## Highlights

- **Three window states** — collapsed `96×96`, expanded panel `340×560`, settings
  `340×660`. The shell is rounded, borderless, transparent, and pinned above the dock
  (`alwaysOnTop`, level `floating`).
- **Pointer-friendly drag** — long-press / mouse-down on the ball grabs the OS cursor and
  moves the window with a 16 ms tick; releasing or losing focus persists the position.
- **Tray menu** with `Show / Settings / Launch at login / Quit`. Closing (×) hides the
  window instead of quitting; only the tray menu or `Cmd/Ctrl+Q` actually exits.
- **Real MiniMax API client** in `electron/api/minimax.ts` that authenticates with the
  session `_token` cookie (or a full `Cookie:` header override) and reproduces the browser
  request shape (`Origin`, `Referer`, `User-Agent`, `sec-ch-ua-*`). Returns a
  per-model snapshot (`model`, `usedPercent`, `remainingPercent`,
  `current_interval_total_percent`, `weeklyUsedPercent`, `resetAt`) normalised from the
  `model_remains` array.
- **Editable credentials** — the settings page can save a base URL, group ID,
  `_token` cookie value, or full `Cookie:` header into the OS keychain. Leaving a field
  empty keeps the existing value; clearing removes it. The renderer never sees the
  secrets after they are saved.
- **Online / Mock / Offline behaviour** — if `MINIMAX_TOKEN` is missing, the UI falls back
  to a deterministic mock so the panel still animates. Real failures are surfaced as
  user-safe messages (`unauthorized`, `timeout`, `network`, `response`, `unknown`).
- **Visibility-aware refresh** with exponential backoff (5 s → 60 s ceiling). Polling
  pauses when the document is hidden and queues a refresh on `visibilitychange`. Single
  in-flight request at a time.
- **i18n** (`en` / `zh`), theme toggle (`dark` / `light`, persisted via
  `localStorage`), and `useReducedMotion()`-driven animations.

## Window states

| State       | Size    | Source                                               |
| ----------- | ------- | ---------------------------------------------------- |
| `collapsed` | 96×96   | `electron/window.ts` — floating ball, draggable      |
| `expanded`  | 340×560 | `src/components/TokenPanel.tsx` — usage overview     |
| `settings`  | 340×660 | `src/pages/Settings.tsx` — credentials & preferences |

The window is repositioned on every state change so it stays inside its current
display's work area (`electron/window/geometry.ts`).

## Position persistence

- `electron/window/persistence.ts` defines the `window-position.json` schema
  (`schemaVersion`, `x`, `y`, `displayId`).
- `electron/window/store.ts` writes the file to `app.getPath('userData')` with a
  `.tmp-<pid>-<ts>` swap and `0o600` permissions.
- On startup, `resolveStartupPosition()` rehydrates the position if the display still
  exists; otherwise it anchors the orb to the bottom-right corner of the primary display
  (`workArea.width − 96 − 24`, `workArea.height − 96 − 24`).

## MiniMax authentication

MiniMax does **not** use a Bearer API key. The Electron client reproduces the request a
logged-in browser makes to `https://www.minimaxi.com/backend/account/token_plan/remains_percent`
by sending:

```
Cookie: _token=<MINIMAX_TOKEN>; minimax_group_id_v2=<MINIMAX_GROUP_ID>
Origin: https://platform.minimaxi.com
Referer: https://platform.minimaxi.com/
User-Agent: <desktop Chrome / Edge UA>
```

If `MINIMAX_COOKIE` is provided in `.env`, the entire `Cookie:` header is reused
verbatim — useful when the session depends on tracking cookies the API also inspects.

### Resolving credentials (development)

1. Open <https://www.minimaxi.com> in a browser while logged in.
2. Copy the `_token` cookie value into `MINIMAX_TOKEN`.
3. Copy the `minimax_group_id_v2` cookie value into `MINIMAX_GROUP_ID`.
4. Save `.env` and restart the app (or save through **Settings → Credentials**, which
   uses the OS keychain instead of the dotenv fallback).

## Configuration

Two layers are merged at startup:

1. **Persistent (OS keychain)** — `electron/config/store.ts` reads
   `<userData>/minimax-config.json`. The token + cookie are stored as `safeStorage`
   ciphertext (base64). The Settings page can update or clear them at runtime
   (`electron/ipc/config.ts`).
2. **`.env` fallback** — `electron/config.ts` loads `.env` (or the packaged
   `process.resourcesPath/.env` when running from a packaged build) and falls back to it
   when the keychain has no value yet. `MINIMAX_BASE_URL` always wins if present in the
   environment, so packaged builds can override the URL without touching the saved
   preferences.

If `safeStorage.isEncryptionAvailable()` is `false` (no macOS Keychain, Windows Credential
Vault, or Linux Secret Service), credential writes are refused instead of being written
to disk in plaintext, and the Settings page renders an inline warning.

## Refresh & visibility

`src/lib/refreshReliability.ts` exposes `createRefreshScheduler` which:

- polls every `intervalMs` (`10 s`, `30 s`, `60 s`, `5 min` — chosen in Settings, stored
  in `localStorage`),
- listens to `document.visibilitychange` and pauses while the page is hidden,
- coalesces concurrent requests via `createSingleFlight`,
- applies `getRetryDelay(failureCount)` exponential backoff on errors.

The Zustand store (`src/store/tokenStore.ts`) maps API snapshots to renderer-friendly
state (`percentage`, `status`, `error`, `errorCode`, `nextPollAt`, `quotaResetAt`).

## Project layout

```text
token-orb/
├── build/
│   ├── icon.png
│   └── tray.png
├── electron/
│   ├── api/
│   │   ├── minimax.ts         # MiniMax fetchTokenPlan implementation
│   │   └── minimax.test.ts
│   ├── config/
│   │   ├── persistence.ts     # config schema + validation
│   │   ├── store.ts           # safeStorage-backed disk read/write
│   │   └── persistence.test.ts
│   ├── ipc/
│   │   ├── config.ts          # config:get / config:save handlers
│   │   └── token.ts           # token:get / token:update / token:fetch handlers
│   ├── shared/
│   │   ├── token.ts           # IPC payload types + createMockTokenPlanSnapshot
│   │   └── token.test.ts
│   ├── window/
│   │   ├── geometry.ts        # drag/clamp math
│   │   ├── persistence.ts     # position schema
│   │   ├── store.ts           # disk read/write for position
│   │   ├── geometry.test.ts
│   │   └── persistence.test.ts
│   ├── config.ts              # runtime config + .env fallback
│   ├── main.ts                # app lifecycle, single-instance lock
│   ├── preload.ts             # contextBridge whitelist
│   ├── tray.ts                # tray menu
│   └── window.ts              # BrowserWindow state machine
├── scripts/
│   ├── smoke-fetch.mjs        # smoke test → fetches one snapshot via fetchTokenPlan
│   └── smoke-dump.mjs         # smoke test → dumps the raw snapshot as JSON
├── src/
│   ├── api/
│   │   └── token.ts           # renderer-side fetchTokenPlan + mock fallback
│   ├── components/
│   │   ├── TokenBall.tsx
│   │   └── TokenPanel.tsx
│   ├── i18n/
│   │   └── index.ts           # en/zh dictionary + useT hook
│   ├── lib/
│   │   ├── balanceColor.ts
│   │   ├── refreshReliability.ts
│   │   ├── refreshReliability.test.ts
│   │   ├── theme.ts
│   │   └── balanceColor.test.ts
│   ├── pages/
│   │   └── Settings.tsx
│   ├── store/
│   │   └── tokenStore.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── vite-env.d.ts
├── electron-builder.yml
├── eslint.config.mjs
├── index.html
├── package.json
├── scripts/
├── tsconfig.app.json
├── tsconfig.electron.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Process architecture

```text
Electron main                        ┌──────────────────────────────────────┐
  ├── BrowserWindow (state machine)  │  Renderer (sandboxed React)          │
  ├── Tray (Show / Settings / Login) │  ├── TokenBall  (96×96 collapsed)    │
  ├── Single-instance lock           │  ├── TokenPanel (340×560 expanded)  │
  ├── safeStorage-backed config      │  ├── Settings   (340×660 settings)  │
  └── ipcMain                        │  └── Zustand tokenStore              │
        │                            └──────────────────────────────────────┘
        │ contextBridge whitelist via preload.ts
        ▼
   electronAPI: {
     getTokenBalance, updateTokenBalance, fetchTokenPlan,
     getConfigStatus, saveConfig,
     setWindowState, getAutoLaunch, setAutoLaunch,
     beginWindowDrag, endWindowDrag, showWindow, hideWindow, quitApp,
     onViewChange,
   }
```

## Installation

### Requirements

- Node.js `20.19+` (`engines.node` in `package.json`)
- npm `10+` (ships with the supported Node releases)
- Windows 10 / 11 or macOS

### Bootstrapping

```bash
git clone <repo> token-orb
cd token-orb
npm install
cp .env.example .env       # then edit MINIMAX_TOKEN / MINIMAX_GROUP_ID
npm run dev
```

The first `npm run dev` runs Vite (renderer) on `127.0.0.1:44129`, watches
`tsconfig.electron.json` for the main/preload, and starts Electron pointing at the dev
URL.

## Commands

```bash
# ─── development ───────────────────────────────────────────────────────
npm run dev                # vite + electron watch + electron app

# ─── quality gates ─────────────────────────────────────────────────────
npm test                   # vitest run (all *.test.ts files)
npm run lint               # eslint .
npm run typecheck          # tsc -b (renderer + electron project references)
npm run build              # lint + tsc -b + vite build + electron tsc
npm run format             # prettier --write .
npm run format:check       # prettier --check .

# ─── live MiniMax smoke tests (require MINIMAX_TOKEN in .env) ──────────
npm run smoke              # one-line summary per model
npm run smoke:dump         # full snapshot JSON

# ─── packaging ─────────────────────────────────────────────────────────
npm run dist               # current platform (electron-builder)
npm run dist:win           # Windows NSIS .exe (build on Windows)
npm run dist:mac           # macOS DMG (universal) — build on macOS
```

`release/` is the default packaging output directory.

### Smoke tests in detail

`scripts/smoke-fetch.mjs` is the canonical smoke test: it loads `.env`, calls the
**production** `fetchTokenPlan` from `dist-electron/api/minimax.js`, and prints one
line per `model_remains` entry:

```
[smoke] model=general used=30% remaining=70% weekly=12% total=100% resetAt=1750000000
```

`scripts/smoke-dump.mjs` calls the same production implementation but emits the entire
`TokenPlanSnapshot` as JSON (handy when you want to inspect every field, including
`model_remains` arrays with multiple entries).

Both scripts share the same authentication surface — the divergent
`Authorization: Bearer …` request from the legacy `smoke-dump.mjs` has been removed
in favour of the cookie-based browser-shape request the running app uses.

## Packaging

`electron-builder.yml` produces:

- **Windows** — NSIS `.exe`, `perMachine: false`, `oneClick: false`,
  `allowToChangeInstallationDirectory: true`, x64.
- **macOS** — universal `.dmg`, `category: public.app-category.utilities`.

`build/icon.png` is reused as the tray icon for the orb itself (resized to 16 px on
the fly) and `build/tray.png` becomes the menu bar / system tray glyph.

Build outputs land in `release/`. The Windows NSIS installer must be produced on a
Windows host; macOS DMG must be produced on macOS.

## Credential & security cautions

- **Never commit `.env`.** `.env` is git-ignored; `.env.example` is the only template.
- **Never paste credentials into issues, screenshots, or chat logs.** The runtime
  truncates them in logs (`[token:fetch] MiniMax …`), and the smoke scripts print only
  `tokenLength` / `cookieOverride` byte counts.
- The renderer never receives stored secrets. After `saveConfig` succeeds, the inputs
  are cleared from form state and the next `getConfigStatus` only reports boolean
  "configured" flags.
- `safeStorage` is platform-specific. macOS uses the Keychain, Windows uses the
  Credential Vault (DPAPI), Linux uses libsecret. If none of those is available,
  `electron/config/store.ts` refuses to persist plaintext, and the Settings page
  disables the **Save** button.
- The MiniMax API client validates `baseUrl` aggressively (`electron/api/minimax.ts` —
  `validateBaseUrl`) and refuses empty / non-http(s) / loopback-less URLs.

## Environment variables

| Name               | Required | Purpose                                               |
| ------------------ | -------- | ----------------------------------------------------- |
| `MINIMAX_TOKEN`    | optional | `_token` cookie value (development fallback only)     |
| `MINIMAX_GROUP_ID` | optional | `minimax_group_id_v2` cookie value                    |
| `MINIMAX_BASE_URL` | optional | Override the default `https://www.minimaxi.com`       |
| `MINIMAX_COOKIE`   | optional | Full `Cookie:` header — overrides the per-name values |

When `MINIMAX_TOKEN` is unset (and no credential is saved in the OS keychain) the app
falls back to a deterministic mock so the UI keeps animating. The panel surfaces a
"Mock Data" status dot in that case.

## License

Add your license of choice here before publishing.
