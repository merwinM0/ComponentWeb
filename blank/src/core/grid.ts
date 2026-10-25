/** 桌面画布使用 16:9 设计比例；显示大小由工作区等比适配，不以超大像素扩边。 */
export const CANVAS = { width: 1344, height: 756 } as const;
/** 原位编辑的临时可用范围，网格步长不变；完成后缩回原显示框。 */
export const EDIT_SPACE = { width: 3840, height: 2880 } as const;
export const GRID = { cols: 112, rows: 63, cell: 12 } as const;
/** 仅用于兼容上一版已保存到远处的内容，不用于新建画布。 */
export const LARGE_GRID = { cols: 320, rows: 240, cell: 12 } as const;
export interface CanvasGrid { cols: number; rows: number; cell: 12 }
export const canvasSize = (grid: CanvasGrid) => ({ width: grid.cols * grid.cell, height: grid.rows * grid.cell });
/** v3 的 960×720 画布；迁移只扩边界，像素与嵌套基准不变。 */
export const CLASSIC_GRID = { cols: 80, rows: 60, cell: 12 } as const;
export const LEGACY_GRID = { cols: 40, rows: 30, cell: 24 } as const;
export const FINE_GRID = { cols: 120, rows: 90, cell: 8 } as const;
export const catalogueSize = (size: [number, number]): [number, number] => [size[0] * 2, size[1] * 2];
export function matchesGrid(value: unknown, expected: { cols: number; rows: number; cell: number }): boolean {
  if (!value || typeof value !== 'object') return false;
  const grid = value as Record<string, unknown>;
  return grid.cols === expected.cols && grid.rows === expected.rows && grid.cell === expected.cell;
}
