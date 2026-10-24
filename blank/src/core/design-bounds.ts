import { EDIT_SPACE, GRID } from './grid';
import { designSize } from './design-space';
import { childrenOf } from './tree';
import type { Placement } from './types';

/** 原位编辑临时网格均可使用；新增/移动内容时扩展基准，但不暗改用户明确输入的基准尺寸。 */
export function growDesign(nodes: Placement[], previous: Placement[], rootId: string | null) {
  const root = nodes.find(node => node.id === rootId), before = previous.find(node => node.id === rootId);
  if (!root || !before || root.layout?.mode !== 'free') return nodes;
  const size = designSize(root), original = designSize(before);
  if (size.width !== original.width || size.height !== original.height) return nodes;
  const children = childrenOf(nodes, root.id), old = childrenOf(previous, root.id);
  if (JSON.stringify(children.map(geometry)) === JSON.stringify(old.map(geometry))) return nodes;
  const inset = ((root.layout.padding ?? 12) + (root.props.borderStyle === 'none' ? 0 : root.props.borderWidth ?? 1)) * 2;
  const width = Math.min(EDIT_SPACE.width, Math.max(size.width, ...children.map(node => (node.col + node.colSpan) * GRID.cell + inset)));
  const height = Math.min(EDIT_SPACE.height, Math.max(size.height, ...children.map(node => (node.row + node.rowSpan) * GRID.cell + inset)));
  return width === size.width && height === size.height ? nodes : nodes.map(node => node.id === root.id ? { ...node, design: { width, height } } : node);
}
const geometry = (node: Placement) => [node.id, node.col, node.row, node.colSpan, node.rowSpan];

export function insertionSpace(nodes: Placement[], parentId: string | null, scopeRootId: string | null) {
  if (!scopeRootId || parentId !== scopeRootId) return nodes;
  return nodes.map(node => node.id === scopeRootId && node.layout?.mode === 'free' ? { ...node, design: { ...EDIT_SPACE } } : node);
}
