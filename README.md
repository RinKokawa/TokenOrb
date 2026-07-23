# TokenOrb

一个使用 Electron、React 19 和 TypeScript 构建的跨平台桌面悬浮球，实时显示你的 AI Token 余额。

## 第一阶段功能

- 透明、无边框、置顶的 `80x80` 悬浮窗口
- 鼠标拖动悬浮球，点击展开 `320x400` Token 面板
- Token 剩余百分比环、浮动动画和数字滚动动画
- Zustand Token 状态与可自动变化的 Mock 数据
- 系统托盘、窗口隐藏、开机启动和退出
- API Key 占位配置、刷新频率和 Dark/Light 主题
- Windows NSIS `.exe` 与 macOS `.dmg` 打包配置

不包含用户登录、云端同步、支付或数据库。

## 环境要求

- Node.js `20.19+`
- npm `10+`（随 Node.js 一起安装）
- Windows 10/11 或 macOS

## 完整初始化命令

如果需要从空目录手动复现依赖初始化：

```bash
mkdir token-orb
cd token-orb
npm init -y
npm install react@^19.1.0 react-dom@^19.1.0 zustand@^5.0.6 framer-motion@^12.23.6
npm install -D electron@^37.2.0 electron-builder@26.15.7 vite@^7.0.4 @vitejs/plugin-react@^5.0.0 typescript@^5.8.3 @types/node@^22.15.34 @types/react@^19.1.8 @types/react-dom@^19.1.6 tailwindcss@^4.1.11 @tailwindcss/vite@^4.1.11 eslint@^9.30.1 @eslint/js@^9.30.1 typescript-eslint@^8.36.0 eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.4.20 globals@^16.3.0 prettier@^3.6.2 concurrently@^9.2.0 wait-on@^8.0.3 cross-env@^7.0.3
```

当前项目已包含完整 `package.json`，正常使用只需：

```bash
npm install
npm run dev
```

## 常用命令

```bash
# 开发模式：同时启动 Vite、Electron TypeScript watch 和 Electron
npm run dev

# ESLint
npm run lint

# TypeScript 类型检查
npm run typecheck

# 构建 renderer 和 Electron main/preload
npm run build

# 当前平台安装包
npm run dist

# Windows NSIS 安装包
npm run dist:win

# macOS DMG 安装包
npm run dist:mac
```

Windows 安装包应在 Windows 主机生成，macOS DMG 应在 macOS 主机生成。产物输出到 `release/`。

## 项目结构

```text
token-orb/
├── build/
│   ├── icon.png
│   └── tray.png
├── electron/
│   ├── ipc/
│   │   └── token.ts
│   ├── main.ts
│   ├── preload.ts
│   ├── tray.ts
│   └── window.ts
├── src/
│   ├── api/
│   │   └── token.ts
│   ├── components/
│   │   ├── TokenBall.tsx
│   │   └── TokenPanel.tsx
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
├── tsconfig.app.json
├── tsconfig.electron.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 进程结构

```text
Electron main
  ├── BrowserWindow / Tray / Login Item
  └── ipcMain
          │
          │ contextBridge 白名单 API
          ▼
React renderer
  ├── src/api/token.ts
  ├── Zustand tokenStore
  └── TokenBall / TokenPanel / Settings
```

渲染进程启用了 `contextIsolation`，禁用了 `nodeIntegration`，只通过 `electron/preload.ts` 暴露受控 API。

## Mock 数据与真实 API

`electron/ipc/token.ts` 当前返回以下初始 Mock 数据，并每 15 秒轻微增加已用量：

```json
{
  "total": 1000000,
  "used": 300000,
  "remaining": 700000
}
```

Renderer 统一通过 `src/api/token.ts` 的 `getTokenBalance()` 获取数据。接入 OpenAI、Claude 或自定义 API 时，建议保留该返回结构，并将真实网络请求放在 Electron 主进程中，再通过 preload 白名单传回 renderer。

设置页的 API Key 仅是第一阶段 Mock 占位，保存在本机 `localStorage`，不会发起真实请求。接入生产 API 时应改用操作系统凭据存储，不要把真实密钥保存在 renderer 或提交到 Git。

## 窗口与托盘操作

- 按住悬浮球拖动可移动窗口。
- 单击悬浮球展开详情面板。
- 面板中的 `×` 折叠回悬浮球。
- `Hide` 隐藏窗口，可从系统托盘重新显示。
- 托盘菜单可打开设置、切换开机启动或退出应用。
