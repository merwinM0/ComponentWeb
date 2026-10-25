/** 首页固定视口的装饰坐标，与文档滚动和工作区的真实 12px 布局数据无关。 */
export const HOME_POINTER_GRID = 32;
export function homePointer(x: number, y: number, width: number, height: number) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const precise = (value: number) => Math.round(value * 1000) / 1000;
  x = clamp(x, 0, width); y = clamp(y, 0, height);
  const nx = x / width * 2 - 1, ny = y / height * 2 - 1;
  const cellX = Math.floor(Math.min(x, Math.max(0, width - 0.001)) / HOME_POINTER_GRID) * HOME_POINTER_GRID;
  const cellY = Math.floor(Math.min(y, Math.max(0, height - 0.001)) / HOME_POINTER_GRID) * HOME_POINTER_GRID;
  return { x: precise(x), y: precise(y), cellX, cellY, cellWidth: precise(Math.min(HOME_POINTER_GRID, width - cellX)), cellHeight: precise(Math.min(HOME_POINTER_GRID, height - cellY)),
    shiftX: precise(nx * 8), shiftY: precise(ny * 6), tiltX: precise(-ny * 3), tiltY: precise(nx * 4) };
}
