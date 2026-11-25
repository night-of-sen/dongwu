const BASE = import.meta.env.BASE_URL || '/';

/**
 * 将站内静态资源路径规范化为支持子路径部署（如 GitHub Pages `/dongwu/`）与本地开发的统一 URL
 */
export function assetUrl(path) {
  if (!path) return path;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE}${clean}`;
}
