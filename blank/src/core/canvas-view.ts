import type { DesignSize } from './types';

/** 适应可见工作区只调整统一显示倍率，不改画布或组件的逻辑像素。 */
export function fitCanvasScale(width: number, height: number, canvas: DesignSize): number | null {
  if (![width, height, canvas.width, canvas.height].every(Number.isFinite) || width <= 4 || height <= 4 || canvas.width <= 0 || canvas.height <= 0) return null;
  return Math.min((width - 4) / canvas.width, (height - 4) / canvas.height);
}
