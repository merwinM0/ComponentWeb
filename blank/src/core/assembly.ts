import { createNode } from './model';
import { GRID } from './grid';
import { isContainer, type Placement } from './types';
import { childrenOf, overlaps } from './tree';
import { workingSize, regionOf, editRegionError, type EditRegion } from './edit-region';
export { workingSize } from './edit-region';

/** 只在既定编辑框内组装，不收紧、不扩展、不额外套已有容器。 */
export function assembleNodes(input: Placement[], rootId: string, source: Placement, fallback?: EditRegion): Placement[] {
  const fallbackContent = source.skin && fallback ? regionOf({ ...source, col: fallback.col, row: fallback.row, design: { width: fallback.cols * GRID.cell, height: fallback.rows * GRID.cell } }, true) : fallback;
  const error = editRegionError(input, rootId, fallbackContent); if (error) throw new Error(error);
  const nodes = structuredClone(input); let root = nodes.find(node => node.id === rootId);
  const loose = nodes.filter(node => !node.parentId && node.id !== rootId);
  if (!nodes.length || (root && !loose.length)) return nodes;
  const area = root ? regionOf(root) : fallback ?? regionOf(source);
  if (!root || !isContainer(root)) {
    const wrapper = createNode('layout.container'); wrapper.id = rootId; wrapper.col = area.col; wrapper.row = area.row;
    if (!root && source.skin) { wrapper.skin = source.skin; wrapper.props = { ...source.props }; wrapper.layout = { ...source.layout!, mode: 'free' }; }
    wrapper.props.title = root?.props.title || source.props.title || '组合组件'; if (!wrapper.skin) { wrapper.props.borderWidth = 0; wrapper.layout!.padding = 0; }
    wrapper.colSpan = root?.colSpan ?? source.colSpan; wrapper.rowSpan = root?.rowSpan ?? source.rowSpan;
    wrapper.design = { width: area.cols * GRID.cell, height: area.rows * GRID.cell };
    if (root) { const size = workingSize(root); root.id = crypto.randomUUID(); root.colSpan = size.width / GRID.cell; root.rowSpan = size.height / GRID.cell; }
    root = wrapper; nodes.push(wrapper);
  }
  const content = regionOf(root, true);
  for (const node of nodes.filter(node => !node.parentId && node !== root)) {
    node.parentId = root.id;
    if (root.layout!.mode !== 'free') { node.col = 0; node.row = 0; }
    else { node.col -= content.col; node.row -= content.row; }
  }
  return allowAssembledOverlap(nodes);
}
export function allowAssembledOverlap(nodes: Placement[]) {
  return nodes.map(node => {
    if (!isContainer(node) || node.layout?.mode !== 'free' || node.layout.overlap) return node;
    const children = childrenOf(nodes, node.id);
    return children.some((child, index) => children.slice(index + 1).some(other => overlaps(child, other))) ? { ...node, layout: { ...node.layout, overlap: true } } : node;
  });
}
