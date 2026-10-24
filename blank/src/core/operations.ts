import { createNode, findSpace, type Placement } from './model';
import { GRID } from './grid';
import { bounds, descendants, topSelection } from './tree';
import { isContainer, type ContainerLayout } from './types';

export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';
export function freeSiblings(nodes: Placement[], selected: Placement[]): boolean {
  if (!selected.length || selected.some(node => node.parentId !== selected[0].parentId)) return false;
  const parent = nodes.find(node => node.id === selected[0].parentId);
  return !parent || parent.layout?.mode === 'free';
}
export function moveNodes(nodes: Placement[], ids: Iterable<string>, dx: number, dy: number): Placement[] {
  const roots = topSelection(nodes, ids);
  if (!freeSiblings(nodes, roots)) throw new Error('请选择同一自由布局区域中的组件；自动布局内请调整顺序');
  const selected = new Set(roots.map(node => node.id));
  return nodes.map(node => selected.has(node.id) ? { ...node, col: node.col + dx, row: node.row + dy } : node);
}
export function alignNodes(nodes: Placement[], ids: Iterable<string>, alignment: Alignment): Placement[] {
  const selected = topSelection(nodes, ids);
  if (selected.length < 2 || !freeSiblings(nodes, selected)) throw new Error('对齐需要同一自由布局区域的至少两个组件');
  const box = bounds(selected);
  return nodes.map(node => {
    if (!selected.includes(node)) return node;
    switch (alignment) {
      case 'left': return { ...node, col: box.col };
      case 'right': return { ...node, col: box.col + box.colSpan - node.colSpan };
      case 'top': return { ...node, row: box.row };
      case 'bottom': return { ...node, row: box.row + box.rowSpan - node.rowSpan };
      case 'center-x': return { ...node, col: box.col + (box.colSpan - node.colSpan) / 2 };
      case 'center-y': return { ...node, row: box.row + (box.rowSpan - node.rowSpan) / 2 };
    }
  });
}
export function distributeNodes(nodes: Placement[], ids: Iterable<string>, axis: 'x' | 'y'): Placement[] {
  const selected = topSelection(nodes, ids);
  if (selected.length < 3 || !freeSiblings(nodes, selected)) throw new Error('等间距分布需要同一区域至少三个组件');
  const position = axis === 'x' ? 'col' : 'row';
  const span = axis === 'x' ? 'colSpan' : 'rowSpan';
  const sorted = [...selected].sort((a, b) => a[position] - b[position]);
  const start = sorted[0][position];
  const end = sorted.at(-1)![position] + sorted.at(-1)![span];
  const gap = (end - start - sorted.reduce((sum, node) => sum + node[span], 0)) / (sorted.length - 1);
  if (gap < -1e-6) throw new Error('当前范围不足以无重叠地分布组件');
  let cursor = start;
  const positions = new Map<string, number>();
  for (const node of sorted) { positions.set(node.id, cursor); cursor += node[span] + Math.max(0, gap); }
  return nodes.map(node => positions.has(node.id) ? { ...node, [position]: positions.get(node.id)! } : node);
}
export function groupNodes(nodes: Placement[], ids: Iterable<string>, mode: ContainerLayout['mode'] = 'free') {
  const selected = topSelection(nodes, ids);
  if (!freeSiblings(nodes, selected)) throw new Error('请先选择同一自由布局区域中的组件');
  const box = bounds(selected);
  const container = createNode('layout.container');
  Object.assign(container, box, { parentId: selected[0].parentId,
    colSpan: Math.max(box.colSpan, 4), rowSpan: Math.max(box.rowSpan, 4),
    props: { ...container.props, borderWidth: 0 }, layout: { ...container.layout!, mode, padding: mode === 'free' ? 0 : 12 } });
  container.design = { width: container.colSpan * GRID.cell, height: container.rowSpan * GRID.cell };
  const selectedIds = new Set(selected.map(node => node.id));
  const result = nodes.map(node => selectedIds.has(node.id) ? { ...node, parentId: container.id, col: node.col - box.col, row: node.row - box.row } : node);
  result.push(container);
  return { nodes: result, container };
}
export function cloneForest(nodes: Placement[], ids: Iterable<string>) {
  const roots = topSelection(nodes, ids);
  const all = descendants(nodes, roots.map(node => node.id));
  const mapping = new Map<string, string>([...all].map(id => [id, crypto.randomUUID()]));
  const copies = structuredClone(nodes.filter(node => all.has(node.id))).map(node => ({ ...node, id: mapping.get(node.id)!, parentId: node.parentId ? mapping.get(node.parentId) ?? node.parentId : null }));
  return { nodes: copies, roots: roots.map(node => mapping.get(node.id)!) };
}
export function placeForest(copies: Placement[], rootIds: string[], existing: Placement[], parentId: string | null, position?: { col: number; row: number }) {
  const roots = copies.filter(node => rootIds.includes(node.id));
  const box = bounds(roots);
  const probe = { ...roots[0], ...box, parentId, id: '__placement_probe__' };
  // 使用整体包围盒找空位，最终仍会逐个校验真实树。
  const found = position ? { ...probe, ...position } : findSpace(probe, existing);
  if (!found) throw new Error('没有足够空间放置组合');
  return copies.map(node => rootIds.includes(node.id) ? { ...node, parentId, col: node.col - box.col + found.col, row: node.row - box.row + found.row } : node);
}
export function reorderNodes(nodes: Placement[], ids: Iterable<string>, beforeId: string | null): Placement[] {
  const selected = new Set(topSelection(nodes, ids).map(node => node.id));
  if (beforeId && selected.has(beforeId)) return nodes;
  const moving = nodes.filter(node => selected.has(node.id));
  const rest = nodes.filter(node => !selected.has(node.id));
  const index = beforeId ? rest.findIndex(node => node.id === beforeId) : rest.length;
  rest.splice(index < 0 ? rest.length : index, 0, ...moving);
  return rest;
}
