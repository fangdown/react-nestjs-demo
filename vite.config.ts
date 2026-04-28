import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 未设置 `VITE_PUBLIC_BASE_PATH` 时，开发与生产共用此前缀（如 `http://localhost:5174/nestjs-reading/`）。
 * 根路径部署时在 `.env` 中设 `VITE_PUBLIC_BASE_PATH=/`。
 */
const DEFAULT_PUBLIC_BASE = "/nestjs-reading/";

function normalizeBase(raw: string): string {
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function resolveBase(env: Record<string, string>): string {
  const explicit = env.VITE_PUBLIC_BASE_PATH?.trim();
  if (explicit === "/") {
    return "/";
  }
  if (explicit) {
    return normalizeBase(explicit);
  }
  return DEFAULT_PUBLIC_BASE;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = resolveBase(env);

  return {
    base,
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
