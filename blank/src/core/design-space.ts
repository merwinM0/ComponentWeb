import { GRID, EDIT_SPACE } from './grid';
import type { DesignSize, Placement } from './types';

export const designSize = (node: Placement): DesignSize => node.design ?? { width: node.colSpan * GRID.cell, height: node.rowSpan * GRID.cell };
export function validDesign(value: unknown): value is DesignSize {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const size = value as DesignSize;
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width >= 24 && size.width <= EDIT_SPACE.width && size.height >= 24 && size.height <= EDIT_SPACE.height;
}
export function displayScale(node: Placement, width = node.colSpan * GRID.cell, height = node.rowSpan * GRID.cell) {
  const design = designSize(node);
  return { x: width / design.width, y: height / design.height };
}
