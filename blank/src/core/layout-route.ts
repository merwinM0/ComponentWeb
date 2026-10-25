/** 哈希路由可用于静态部署，不需要服务器回退规则。 */
export const layoutHash = (id: string) => `#layout=${encodeURIComponent(id)}`;
export function layoutIdFromHash(hash: string): string | null {
  if (!hash.startsWith('#layout=')) return null;
  try { const id = decodeURIComponent(hash.slice(8)); return id && id.length <= 100 ? id : null; } catch { return null; }
}
