/** 画布物理尺寸保持不变；布局精度由 24px 细化为 8px。 */
export const CANVAS = { width: 960, height: 720 } as const;
export const GRID = { cols: 120, rows: 90, cell: 8 } as const;
export const LEGACY_GRID = { cols: 40, rows: 30, cell: 24 } as const;

/** 现有素材目录以 24px 为设计单位，注册时换算，避免组件默认/最小尺寸缩小。 */
export function catalogueSize(size: [number, number]): [number, number] {
  const ratio = LEGACY_GRID.cell / GRID.cell;
  return [size[0] * ratio, size[1] * ratio];
}

export function matchesGrid(value: unknown, expected: { cols: number; rows: number; cell: number }): boolean {
  if (!value || typeof value !== 'object') return false;
  const grid = value as Record<string, unknown>;
  return grid.cols === expected.cols && grid.rows === expected.rows && grid.cell === expected.cell;
}
