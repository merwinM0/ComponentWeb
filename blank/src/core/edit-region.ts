import { registry } from '../components/registry';
import { GRID, EDIT_SPACE } from './grid';
import { designSize } from './design-space';
import { nativeSurface } from './element-edits';
import { isContainer, type Placement } from './types';

export interface EditRegion { col: number; row: number; cols: number; rows: number }
export const workingSize = (node: Placement) => { const size = isContainer(node) ? designSize(node) : nativeSurface(node); return { width: size.width, height: size.height }; };
export function regionOf(root: Placement, content = false): EditRegion {
  const size = workingSize(root);
  const inset = content && isContainer(root) ? ((root.layout?.padding ?? 0) + (root.props.borderStyle === 'none' ? 0 : root.props.borderWidth ?? 1)) / GRID.cell : 0;
  return { col: root.col + inset, row: root.row + inset, cols: size.width / GRID.cell - inset * 2, rows: size.height / GRID.cell - inset * 2 };
}
export const fitsRegion = (node: Pick<Placement, 'col' | 'row' | 'colSpan' | 'rowSpan'>, area: EditRegion) => node.col >= area.col - 1e-6 && node.row >= area.row - 1e-6 && node.col + node.colSpan <= area.col + area.cols + 1e-6 && node.row + node.rowSpan <= area.row + area.rows + 1e-6;
export function editRegionError(nodes: Placement[], rootId: string, fallback?: EditRegion): string | null {
  const root = nodes.find(node => node.id === rootId);
  if (root?.parentId) return '本层编辑对象不能放入自己的子项';
  if (root) { const size = workingSize(root); if (!fitsRegion({ ...root, colSpan: size.width / GRID.cell, rowSpan: size.height / GRID.cell }, { col: 0, row: 0, cols: EDIT_SPACE.width / GRID.cell, rows: EDIT_SPACE.height / GRID.cell })) return '编辑框超出可用工作区'; }
  const area = root ? regionOf(root, true) : fallback;
  if (area && nodes.some(node => !node.parentId && node.id !== rootId && !fitsRegion(node, area))) return '元素不能超出被编辑组件；请先扩大组件编辑框，再添加或移动';
  return null;
}
export function resizeEditingNode(node: Placement, width: number, height: number): Placement {
  const min = registry.get(node.type)!.min;
  if (![width, height].every(Number.isFinite) || width < min[0] * GRID.cell || height < min[1] * GRID.cell || width > EDIT_SPACE.width || height > EDIT_SPACE.height) throw new Error('编辑框尺寸超出允许范围');
  if (isContainer(node)) return { ...node, design: { width, height } };
  const old = nativeSurface(node);
  // 兼容旧版自动外扩且含偏移的标签：扩大边界不能再次拉长其自动宽度，保留原布局基准。
  const offset = node.elements?.some(edit => edit.style?.x || edit.style?.y);
  const expanded = old.x !== 0 || old.y !== 0 || old.width > old.baseWidth + 1e-6 || old.height > old.baseHeight + 1e-6;
  return { ...node, surface: offset && expanded ? { ...old, width, height } : { baseWidth: width, baseHeight: height, x: 0, y: 0, width, height } };
}
/** 移动编辑框时，尚未组装的内部散件跟随整体移动，不改变相对位置。 */
export function moveEditingRegion(nodes: Placement[], before: Placement[], rootId: string) {
  const root = nodes.find(node => node.id === rootId), old = before.find(node => node.id === rootId);
  if (!root || !old || (root.col === old.col && root.row === old.row)) return nodes;
  return nodes.map(node => { const previous = before.find(item => item.id === node.id);
    return node.id !== rootId && !node.parentId && previous && node.col === previous.col && node.row === previous.row ? { ...node, col: node.col + root.col - old.col, row: node.row + root.row - old.row } : node;
  });
}
