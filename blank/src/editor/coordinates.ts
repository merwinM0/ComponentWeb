import { GRID } from '../core/grid';
import { workingSize } from '../core/assembly';
import type { Placement } from '../core/types';
import type { Editor } from './editor';

export function hitNode(editor: Editor, target: HTMLElement, deep = false) {
  const id = target.closest<HTMLElement>('.node')?.dataset.id;
  let node = editor.store.doc.nodes.find(item => item.id === id);
  if (!node) return undefined;
  if (deep || editor.selectedIds.has(node.id) || (node.parentId !== null && node.parentId !== editor.scopeRootId && editor.selection.some(item => item.parentId === node!.parentId))) return node;
  while (node.parentId && node.parentId !== editor.scopeRootId) node = editor.store.doc.nodes.find(item => item.id === node!.parentId)!;
  return node;
}
export function logicalRect(editor: Editor, id: string) {
  const rect = editor.renderer.element(id)!.getBoundingClientRect(), canvas = editor.canvas.getBoundingClientRect();
  return { col: (rect.left - canvas.left) / editor.zoom / GRID.cell, row: (rect.top - canvas.top) / editor.zoom / GRID.cell,
    colSpan: rect.width / editor.zoom / GRID.cell, rowSpan: rect.height / editor.zoom / GRID.cell };
}
export function arrangeVisual(editor: Editor, action: (nodes: Placement[]) => Placement[]) {
  const root = editor.scopeRoot, size = root && workingSize(root);
  const nodes = root ? editor.store.doc.nodes.map(node => node.id === root.id ? { ...node, colSpan: size!.width / GRID.cell, rowSpan: size!.height / GRID.cell } : node) : editor.store.doc.nodes;
  return action(nodes).map(node => node.id === root?.id ? { ...node, colSpan: root.colSpan, rowSpan: root.rowSpan } : node);
}
export function contentOrigin(editor: Editor, parentId: string | null) {
  const target = editor.renderer.content(parentId), rect = target.getBoundingClientRect(), canvas = editor.canvas.getBoundingClientRect(), style = getComputedStyle(target);
  const scaleX = parentId ? rect.width / editor.zoom / parseFloat(style.width) : 1, scaleY = parentId ? rect.height / editor.zoom / parseFloat(style.height) : 1;
  return { col: (rect.left - canvas.left) / editor.zoom / GRID.cell - target.scrollLeft / GRID.cell * scaleX,
    row: (rect.top - canvas.top) / editor.zoom / GRID.cell - target.scrollTop / GRID.cell * scaleY, scaleX, scaleY };
}
