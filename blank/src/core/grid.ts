/** 网格仅决定拖放步长，历史文档的亚网格像素位置仍精确保留。 */
export const CANVAS = { width: 960, height: 720 } as const;
export const GRID = { cols: 80, rows: 60, cell: 12 } as const;
export const LEGACY_GRID = { cols: 40, rows: 30, cell: 24 } as const;
export const FINE_GRID = { cols: 120, rows: 90, cell: 8 } as const;
export const catalogueSize = (size: [number, number]): [number, number] => [size[0] * 2, size[1] * 2];
export function matchesGrid(value: unknown, expected: { cols: number; rows: number; cell: number }): boolean {
  if (!value || typeof value !== 'object') return false;
  const grid = value as Record<string, unknown>;
  return grid.cols === expected.cols && grid.rows === expected.rows && grid.cell === expected.cell;
}
