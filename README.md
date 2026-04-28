# 前端 · Vite + React（共读打卡 Demo）

## 环境变量

复制 `.env.example` 为 `.env`：

- **`VITE_SUPABASE_URL`**、**`VITE_SUPABASE_ANON_KEY`**：浏览器端 Supabase Auth 必填
- **`VITE_API_BASE`**（可选）：请求里会拼成 **`${VITE_API_BASE}/api/...`**（见 `src/lib/api.ts`）。本地不配则用相对路径 **`/api`**，由 Vite 代理到 `127.0.0.1:3000`。线上网关若在域名后还有前缀（如 `/nestjs`），应填到该前缀为止，例如健康检查为 [`https://api.fangdu.chat/nestjs/api/health`](https://api.fangdu.chat/nestjs/api/health) 时设为 **`https://api.fangdu.chat/nestjs`**（不要写成 `.../nestjs/api`）

## 结构与约定

- **`src/auth/`**：`AuthProvider`、`useAuth()`、`auth-context` — 会话与 `access_token`
- **`src/lib/api.ts`**：`apiFetch` 自动附加 `Authorization: Bearer`，非 JSON 响应会抛出可读错误
- **路由**：`/login`、`/register`；受保护路由下为 `/squads`、小队详情

## 本地开发

默认 **`http://localhost:5174/nestjs-reading/`**（与线上子路径一致）。若要用根路径 **`http://localhost:5174/`**，在 `.env` 中设置 `VITE_PUBLIC_BASE_PATH=/`。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run lint
```

## 上线（Vercel）

在 Vercel 环境变量中至少配置：`VITE_SUPABASE_*`、`VITE_PUBLIC_BASE_PATH`（与主站子路径一致）、**`VITE_API_BASE=https://api.fangdu.chat/nestjs`**。  
后端 **`CORS_ORIGIN`** 需包含 `https://www.fangdu.chat` 与你的 `*.vercel.app` 预览域名。
