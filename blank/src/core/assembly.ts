import { createNode } from './model';
import { GRID, EDIT_SPACE } from './grid';
import { designSize } from './design-space';
import { nativeSurface } from './element-edits';
import { isContainer, type Placement } from './types';
import { childrenOf, overlaps } from './tree';

export function workingSize(node: Placement) {
  const size = isContainer(node) ? designSize(node) : nativeSurface(node);
  return { width: size.width, height: size.height };
}
/** 组装散件，根节点沿用外部 ID；不会每次额外套一层容器。 */
export function assembleNodes(input: Placement[], rootId: string, source: Placement): Placement[] {
  const nodes = structuredClone(input); let root = nodes.find(node => node.id === rootId);
  const loose = nodes.filter(node => !node.parentId && node.id !== rootId);
  if (!nodes.length || (root && !loose.length)) return nodes;
  if (root && isContainer(root) && root.layout!.mode !== 'free') {
    for (const node of loose) { node.parentId = root.id; node.col = 0; node.row = 0; }
    return nodes;
  }
  const oldRoot = root;
  if (!root || !isContainer(root)) {
    const wrapper = createNode('layout.container'); wrapper.id = rootId;
    wrapper.props.title = root?.props.title || source.props.title || '组合组件'; wrapper.props.borderWidth = 0; wrapper.layout!.padding = 0;
    wrapper.colSpan = root?.colSpan ?? source.colSpan; wrapper.rowSpan = root?.rowSpan ?? source.rowSpan;
    if (root) {
      const size = workingSize(root); root.id = crypto.randomUUID();
      root.colSpan = size.width / GRID.cell; root.rowSpan = size.height / GRID.cell;
    }
    root = wrapper; nodes.push(wrapper);
  }
  const top = nodes.filter(node => !node.parentId && node !== root);
  const inset = ((root.layout!.padding ?? 12) + (root.props.borderStyle === 'none' ? 0 : root.props.borderWidth ?? 1)) / GRID.cell;
  const oldSize = oldRoot && isContainer(oldRoot) ? workingSize(oldRoot) : null;
  const left = Math.min(...top.map(node => node.col - inset), ...(oldSize ? [oldRoot!.col] : []));
  const upper = Math.min(...top.map(node => node.row - inset), ...(oldSize ? [oldRoot!.row] : []));
  const right = Math.max(...top.map(node => node.col + node.colSpan + inset), ...(oldSize ? [oldRoot!.col + oldSize.width / GRID.cell] : []));
  const lower = Math.max(...top.map(node => node.row + node.rowSpan + inset), ...(oldSize ? [oldRoot!.row + oldSize.height / GRID.cell] : []));
  const width = Math.max(24, (right - left) * GRID.cell), height = Math.max(24, (lower - upper) * GRID.cell);
  if (width > EDIT_SPACE.width || height > EDIT_SPACE.height) throw new Error('组装范围过大，请将散件靠近后重试');
  if (oldSize) for (const child of nodes.filter(node => node.parentId === root!.id)) { child.col += oldRoot!.col - left; child.row += oldRoot!.row - upper; }
  for (const node of top) { node.parentId = root.id; node.col -= left + inset; node.row -= upper + inset; }
  root.col = Math.max(0, left); root.row = Math.max(0, upper); root.parentId = null; root.design = { width, height };
  return allowAssembledOverlap(nodes);
}

/** 组件内部允许标签叠放；工作区根组件之间仍禁止碰撞。 */
export function allowAssembledOverlap(nodes: Placement[]) {
  return nodes.map(node => {
    if (!isContainer(node) || node.layout?.mode !== 'free' || node.layout.overlap) return node;
    const children = childrenOf(nodes, node.id);
    return children.some((child, index) => children.slice(index + 1).some(other => overlaps(child, other))) ? { ...node, layout: { ...node.layout, overlap: true } } : node;
  });
}
