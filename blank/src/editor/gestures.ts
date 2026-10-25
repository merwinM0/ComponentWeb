import { alignmentGuides } from '../core/alignment-guides';
import { createNode, GRID, type Placement } from '../core/model';
import { registry } from '../components/registry';
import { bounds, childrenOf, descendants, validateTree } from '../core/tree';
import { cloneForest, reorderNodes } from '../core/operations';
import { isContainer } from '../core/types';
import { workingSize } from '../core/assembly';
import { resizeEditingNode } from '../core/edit-region';
import { EDIT_SPACE } from '../core/grid';
import type { Combinations } from '../core/combinations';
import { Editor, toast } from './editor';

export function setupGestures(editor: Editor, combinations: Combinations) {
  type State = {
    pointer: number; kind: 'add' | 'move' | 'resize' | 'marquee'; x: number; y: number; active: boolean;
    roots: Placement[]; added: Placement[]; worlds: Map<string, ReturnType<Editor['logicalRect']>>;
    candidate: Placement[]; valid: boolean; parentId: string | null; element: HTMLElement; selection: Set<string>;
  };
  let state: State | undefined;
  const marquee = document.createElement('div'); marquee.className = 'marquee'; marquee.hidden = true; editor.canvas.append(marquee);
  const guides = document.createElement('div'); guides.className = 'alignment-guides'; guides.setAttribute('aria-hidden', 'true'); editor.canvas.append(guides);
  const point = (event: PointerEvent) => { const rect = editor.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / editor.zoom / GRID.cell, y: (event.clientY - rect.top) / editor.zoom / GRID.cell }; };
  function dropTarget(event: PointerEvent, excluded: Set<string>) {
    for (const hit of document.elementsFromPoint(event.clientX, event.clientY)) {
      let element = hit.closest<HTMLElement>('.node');
      while (element) {
        const node = editor.store.doc.nodes.find(node => node.id === element!.dataset.id);
        if (node && isContainer(node) && !excluded.has(node.id)) {
          const rect = editor.renderer.content(node.id).getBoundingClientRect();
          if (!node.skin || (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) return node.id;
        }
        element = element.parentElement?.closest<HTMLElement>('.node') ?? null;
      }
    }
    return null;
  }
  document.addEventListener('pointerdown', event => {
    if (!editor.active || editor.preview || event.button !== 0 || state) return;
    const target = event.target as HTMLElement;
    if (target.closest('.component-tile button,.node-label button')) return;
    const tile = target.closest<HTMLElement>('.component-tile');
    const rawElement = target.closest<HTMLElement>('.node');
    const raw = editor.store.doc.nodes.find(node => node.id === rawElement?.dataset.id);
    const node = editor.hitNode(target, event.altKey);
    const element = node ? editor.renderer.element(node.id)! : null;
    const background = event.target === editor.canvas || (raw && raw.id === node?.id && isContainer(raw) && event.altKey && event.composedPath().some(part => part instanceof HTMLElement && part === editor.renderer.content(raw.id)));
    if (!tile && !element && !background) return;
    if (!tile && !background && node && event.shiftKey) { event.preventDefault(); editor.select(node.id, true); return; }
    const p = point(event); const oldSelection = new Set(editor.selectedIds);
    let roots: Placement[] = [], added: Placement[] = [];
    let kind: State['kind'] = background ? 'marquee' : target.closest('.resize-handle') ? 'resize' : tile ? 'add' : 'move';
    if (tile) {
      if (tile.dataset.combination) {
        const snapshot = combinations.items.find(item => item.id === tile.dataset.combination)?.document;
        if (!snapshot) return;
        const clone = cloneForest(snapshot.nodes, snapshot.nodes.filter(item => !item.parentId).map(item => item.id));
        added = clone.nodes; roots = added.filter(item => clone.roots.includes(item.id));
      } else { roots = [createNode(tile.dataset.type!)]; added = roots; }
    } else if (background) { if (!event.shiftKey) editor.setSelection([]); }
    else if (node) {
      if (!editor.selectedIds.has(node.id) || editor.selectedTag) editor.select(node.id);
      roots = editor.selection;
      if (kind === 'resize' && roots.length !== 1) return;
      element!.dataset.pointerFocus = 'true'; element!.focus({ preventScroll: true }); delete element!.dataset.pointerFocus;
    }
    state = { pointer: event.pointerId, kind, x: p.x, y: p.y, active: false, roots, added,
      worlds: new Map(roots.map(item => [item.id, kind === 'add' ? { col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan } : editor.logicalRect(item.id)])),
      candidate: [], valid: false, parentId: background ? node?.id ?? null : null, element: tile ?? element ?? editor.canvas, selection: background && !event.shiftKey ? new Set() : oldSelection };
    state.element.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener('pointermove', event => {
    if (!state || event.pointerId !== state.pointer) return;
    const s = state; const p = point(event);
    guides.replaceChildren();
    if (!s.active && Math.hypot(p.x - s.x, p.y - s.y) * GRID.cell * editor.zoom < 4) return;
    s.active = true; document.body.classList.add('gesture-active');
    if (s.kind === 'marquee') {
      const box = { col: Math.min(s.x, p.x), row: Math.min(s.y, p.y), colSpan: Math.abs(p.x - s.x), rowSpan: Math.abs(p.y - s.y) };
      Object.assign(marquee.style, { left: `${box.col * GRID.cell}px`, top: `${box.row * GRID.cell}px`, width: `${box.colSpan * GRID.cell}px`, height: `${box.rowSpan * GRID.cell}px` }); marquee.hidden = false;
      const found = childrenOf(editor.store.doc.nodes, s.parentId).filter(node => { const rect = editor.logicalRect(node.id); return rect.col < box.col + box.colSpan && rect.col + rect.colSpan > box.col && rect.row < box.row + box.rowSpan && rect.row + rect.rowSpan > box.row; });
      editor.setSelection([...s.selection, ...found.map(node => node.id)].filter(id => s.selection.has(id) || found.some(node => node.id === id)));
      return;
    }
    const excluded = descendants(editor.store.doc.nodes, s.roots.map(node => node.id));
    if (s.kind !== 'add') for (const id of excluded) editor.renderer.element(id)?.classList.add('dragging');
    const parentId = s.kind === 'resize' || s.roots.some(node => node.id === editor.scopeRootId) ? s.roots[0].parentId : dropTarget(event, excluded);
    document.querySelectorAll('.drop-target').forEach(element => element.classList.remove('drop-target'));
    if (parentId) editor.renderer.element(parentId)?.classList.add('drop-target');
    const parent = editor.store.doc.nodes.find(node => node.id === parentId);
    const origin = editor.origin(parentId); const dx = Math.round((p.x - s.x) / origin.scaleX), dy = Math.round((p.y - s.y) / origin.scaleY);
    const rootIds = new Set(s.roots.map(node => node.id));
    const updates = new Map<string, Placement>();
    for (const node of s.roots) {
      const world = s.worlds.get(node.id)!;
      const candidate = { ...node, parentId };
      if (s.kind === 'resize') {
        const min = registry.get(node.type)!.min;
        if (node.id === editor.scopeRootId) Object.assign(candidate, resizeEditingNode(node, Math.min(EDIT_SPACE.width, Math.max(min[0] * GRID.cell, workingSize(node).width + dx * GRID.cell)), Math.min(EDIT_SPACE.height, Math.max(min[1] * GRID.cell, workingSize(node).height + dy * GRID.cell))));
        else { candidate.colSpan = Math.max(min[0], node.colSpan + dx); candidate.rowSpan = Math.max(min[1], node.rowSpan + dy); }
      } else if (parent && parent.layout?.mode !== 'free') { candidate.col = 0; candidate.row = 0; }
      else if (s.kind === 'add') { candidate.col = Math.round((p.x - origin.col) / origin.scaleX - node.colSpan / 2); candidate.row = Math.round((p.y - origin.row) / origin.scaleY - node.rowSpan / 2); }
      else { candidate.col = (world.col - origin.col) / origin.scaleX + dx; candidate.row = (world.row - origin.row) / origin.scaleY + dy; }
      updates.set(node.id, candidate);
    }
    let nodes = [...editor.store.doc.nodes, ...s.added].map(node => updates.get(node.id) ?? node);
    if (parent && parent.layout?.mode !== 'free') {
      const siblings = childrenOf(editor.store.doc.nodes, parent.id).filter(node => !rootIds.has(node.id));
      const before = siblings.find(node => {
        const rect = editor.renderer.element(node.id)!.getBoundingClientRect();
        if (parent.layout!.mode === 'grid') return event.clientY < rect.top || (event.clientY <= rect.bottom && event.clientX < rect.left + rect.width / 2);
        return parent.layout!.direction === 'row' ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2;
      });
      nodes = reorderNodes(nodes, rootIds, before?.id ?? null);
    }
    const viewport = document.getElementById('viewport')!.getBoundingClientRect();
    const inside = event.clientX >= viewport.left && event.clientX <= viewport.right && event.clientY >= viewport.top && event.clientY <= viewport.bottom;
    const inPage = p.x >= 0 && p.y >= 0 && p.x * GRID.cell <= editor.pageSize.width && p.y * GRID.cell <= editor.pageSize.height;
    nodes = editor.prepareNodes(nodes);
    s.candidate = nodes; s.valid = inside && inPage && !editor.pageError(nodes) && !validateTree(nodes, !!editor.scopeRootId, editor.store.doc.grid);
    if (s.valid && s.kind === 'resize' && s.roots[0].id === editor.scopeRootId && !isContainer(s.roots[0])) { try { editor.renderer.checkNative(updates.get(s.roots[0].id)!, true); } catch { s.valid = false; } }
    const preview = bounds([...updates.values()].map(node => ({ ...node, col: node.col * origin.scaleX + origin.col, row: node.row * origin.scaleY + origin.row,
      colSpan: (node.id === editor.scopeRootId ? workingSize(node).width / GRID.cell : node.colSpan) * origin.scaleX, rowSpan: (node.id === editor.scopeRootId ? workingSize(node).height / GRID.cell : node.rowSpan) * origin.scaleY })));
    if (parent && parent.layout?.mode !== 'free') { preview.col = p.x - preview.colSpan / 2; preview.row = p.y - preview.rowSpan / 2; }
    if (inside && (!parent || parent.layout?.mode === 'free')) {
      const siblings = childrenOf(editor.store.doc.nodes, parentId).filter(node => !excluded.has(node.id)).map(node => editor.logicalRect(node.id));
      for (const guide of alignmentGuides(preview, siblings, 5 / editor.zoom / GRID.cell)) {
        const line = document.createElement('div'); line.className = `alignment-guide ${guide.axis}`;
        Object.assign(line.style, guide.axis === 'x' ? { left: `${guide.at * GRID.cell}px`, top: `${guide.from * GRID.cell}px`, height: `${(guide.to - guide.from) * GRID.cell}px` } : { top: `${guide.at * GRID.cell}px`, left: `${guide.from * GRID.cell}px`, width: `${(guide.to - guide.from) * GRID.cell}px` });
        guides.append(line);
      }
    }
    Object.assign(editor.ghost.style, { left: `${preview.col * GRID.cell}px`, top: `${preview.row * GRID.cell}px`, width: `${preview.colSpan * GRID.cell}px`, height: `${preview.rowSpan * GRID.cell}px` });
    editor.ghost.hidden = !inside; editor.ghost.classList.toggle('invalid', !s.valid);
    editor.ghost.querySelector('span')!.textContent = s.valid ? parent && parent.layout?.mode !== 'free' ? `放入 ${parent.layout!.mode.toUpperCase()} · 自动排版 / 调整顺序` : `${s.roots.length} 项 · ${Math.round(preview.colSpan * GRID.cell)} × ${Math.round(preview.rowSpan * GRID.cell)} px` : editor.scopeRootId ? '超出组件边界 · 请先调整编辑框尺寸' : '无法放置 · 重叠、越界或循环嵌套';
  });
  function finish(commit: boolean) {
    if (!state) return;
    const s = state; state = undefined; guides.replaceChildren(); editor.ghost.hidden = true; marquee.hidden = true;
    document.querySelectorAll('.dragging,.drop-target').forEach(element => element.classList.remove('dragging', 'drop-target')); document.body.classList.remove('gesture-active');
    if (s.element.hasPointerCapture(s.pointer)) s.element.releasePointerCapture(s.pointer);
    if (s.kind === 'marquee') { if (!s.active && s.parentId && commit) editor.select(s.parentId); return; }
    if (!commit || !s.active) return;
    if (s.valid) editor.commit(s.candidate, s.roots.map(node => node.id));
    else toast('放置已取消：请检查同级重叠、边界或容器嵌套');
  }
  document.addEventListener('pointerup', event => { if (event.pointerId === state?.pointer) finish(true); });
  for (const name of ['pointercancel', 'lostpointercapture'] as const) document.addEventListener(name, event => { if (event.pointerId === state?.pointer) finish(false); });
  window.addEventListener('blur', () => finish(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finish(false); });
  return { cancel: () => finish(false) };
}
