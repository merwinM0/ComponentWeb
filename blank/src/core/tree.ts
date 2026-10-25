import { registry } from '../components/registry';
import { GRID, EDIT_SPACE, type CanvasGrid } from './grid';
import { isContainer, type Placement } from './types';
import { designSize, validDesign } from './design-space';

export const EPS = 1e-6;
export const childrenOf = (nodes: Placement[], parentId: string | null) => nodes.filter(node => node.parentId === parentId);
export function descendants(nodes: Placement[], ids: Iterable<string>): Set<string> {
  const result = new Set(ids);
  let changed = true;
  while (changed) { changed = false; for (const node of nodes) if (node.parentId && result.has(node.parentId) && !result.has(node.id)) { result.add(node.id); changed = true; } }
  return result;
}
export function topSelection(nodes: Placement[], ids: Iterable<string>): Placement[] {
  const selected = new Set(ids);
  return nodes.filter(node => {
    if (!selected.has(node.id)) return false;
    let parent = node.parentId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) { if (selected.has(parent)) return false; seen.add(parent); parent = nodes.find(other => other.id === parent)?.parentId ?? null; }
    return true;
  });
}
export function contentSize(parent?: Placement, grid: CanvasGrid = GRID) {
  if (!parent) return { cols: grid.cols, rows: grid.rows };
  const border = parent.props.borderStyle === 'none' ? 0 : (parent.props.borderWidth ?? 1);
  const inset = ((parent.layout?.padding ?? 12) + border) * 2 / GRID.cell;
  const size = designSize(parent);
  return { cols: Math.max(0, size.width / GRID.cell - inset), rows: Math.max(0, size.height / GRID.cell - inset) };
}
export const overlaps = (a: Placement, b: Placement) => a.col < b.col + b.colSpan - EPS && a.col + a.colSpan > b.col + EPS && a.row < b.row + b.rowSpan - EPS && a.row + a.rowSpan > b.row + EPS;
export function placementError(node: Placement, nodes: Placement[], draft = false, grid: CanvasGrid = GRID): string | null {
  const definition = registry.get(node.type);
  if (!definition || ![node.col, node.row, node.colSpan, node.rowSpan].every(Number.isFinite)) return '组件类型或坐标无效';
  if (node.colSpan < definition.min[0] - EPS || node.rowSpan < definition.min[1] - EPS) return '组件小于允许的最小尺寸';
  if (isContainer(node)) {
    const border = node.props.borderStyle === 'none' ? 0 : (node.props.borderWidth ?? 1);
    const inset = ((node.layout?.padding ?? 12) + border) * 2;
    if (node.design !== undefined && !validDesign(node.design)) return '组件内部设计尺寸无效';
    const size = designSize(node);
    if (size.width < inset + 1 || size.height < inset + 1) return '容器尺寸不足以容纳边框和内边距';
  }
  const parent = node.parentId ? nodes.find(other => other.id === node.parentId) : undefined;
  if (node.parentId && (!parent || !isContainer(parent))) return '父级不是可用的布局容器';
  if (parent?.layout?.mode !== undefined && parent.layout.mode !== 'free') return null;
  const size = !parent && draft ? { cols: EDIT_SPACE.width / GRID.cell, rows: EDIT_SPACE.height / GRID.cell } : contentSize(parent, grid);
  if (node.col < -EPS || node.row < -EPS || node.col + node.colSpan > size.cols + EPS || node.row + node.rowSpan > size.rows + EPS) return '组件超出了画布或父容器内容区';
  if (!draft && !parent?.layout?.overlap && nodes.some(other => other.id !== node.id && other.parentId === node.parentId && overlaps(node, other))) return '组件与同级组件重叠';
  return null;
}
export function validateTree(nodes: Placement[], draft = false, grid: CanvasGrid = GRID): string | null {
  if (nodes.length > 300) return '单个工作区最多 300 个组件';
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) return '组件 ID 重复或无效';
    ids.add(node.id);
    let cursor: Placement | undefined = node;
    const chain = new Set<string>();
    let containerDepth = 0;
    while (cursor) {
      if (chain.has(cursor.id)) return '不能循环嵌套容器';
      chain.add(cursor.id);
      if (isContainer(cursor) && ++containerDepth > 8) return '最多支持 8 层容器嵌套';
      if (!cursor.parentId) break;
      cursor = nodes.find(other => other.id === cursor!.parentId);
      if (!cursor) return '父容器不存在';
    }
    const error = placementError(node, nodes, draft, grid);
    if (error) return error;
  }
  return null;
}
export function bounds(nodes: Placement[]) {
  const col = Math.min(...nodes.map(node => node.col));
  const row = Math.min(...nodes.map(node => node.row));
  return { col, row, colSpan: Math.max(...nodes.map(node => node.col + node.colSpan)) - col, rowSpan: Math.max(...nodes.map(node => node.row + node.rowSpan)) - row };
}
