import { pathKey, type ElementEdit } from '../core/element-edits';
import { GRID } from '../core/grid';
import type { Placement } from '../core/types';
import { tagAt, tagPath } from './element-dom';
import { Editor, toast } from './editor';

export function setupElementEditing(editor: Editor) {
  const outline = document.createElement('div'); outline.className = 'element-outline'; outline.hidden = true; outline.setAttribute('aria-hidden', 'true'); outline.append(document.createElement('span')); editor.canvas.append(outline);
  let drag: { pointer: number; id: string; path: number[]; x: number; y: number; sx: number; sy: number; edit: ElementEdit; host: HTMLElement; candidate?: ElementEdit } | null = null;
  function render() {
    const selected = editor.selectedTag, host = selected && editor.renderer.tagHost(selected.id);
    const element = host && tagAt(host.shadowRoot!, selected!.path);
    if (!element || !element.getBoundingClientRect().width) { outline.hidden = true; return; }
    const box = element.getBoundingClientRect(), canvas = editor.canvas.getBoundingClientRect();
    Object.assign(outline.style, { left: `${(box.left - canvas.left) / editor.zoom}px`, top: `${(box.top - canvas.top) / editor.zoom}px`, width: `${box.width / editor.zoom}px`, height: `${box.height / editor.zoom}px` });
    outline.firstElementChild!.textContent = `<${element.localName}> · ${Math.round(box.width / editor.zoom)} × ${Math.round(box.height / editor.zoom)}`; outline.hidden = false;
  }
  editor.onSelectTag = (id, path) => {
    if (!editor.scopeRootId || !editor.renderer.tagHost(id)) return;
    editor.setSelection([id]); editor.selectedTag = { id, path }; editor.onSelection(); render();
  };
  function editsFor(id: string, edit: ElementEdit | null) {
    const node = editor.store.doc.nodes.find(node => node.id === id)!;
    const path = edit?.path ?? editor.selectedTag?.path;
    return [...(node.elements ?? []).filter(item => pathKey(item.path) !== pathKey(path ?? [])), ...(edit ? [edit] : [])];
  }
  editor.onChangeTag = (id, edit) => {
    const node = editor.store.doc.nodes.find(node => node.id === id); if (!node || !editor.scopeRootId) return;
    try {
      const elements = editsFor(id, edit), surface = editor.renderer.previewElements(id, elements);
      const updated: Placement = { ...node, elements, surface };
      if (id === editor.scopeRootId) { updated.col += (surface.x - (node.surface?.x ?? 0)) / GRID.cell; updated.row += (surface.y - (node.surface?.y ?? 0)) / GRID.cell; }
      if (!elements.length) { delete updated.elements; updated.surface = { ...surface, x: 0, y: 0, width: surface.baseWidth, height: surface.baseHeight }; }
      if (!editor.update(updated)) editor.render();
    } catch (error) { toast((error as Error).message); editor.render(); }
    render();
  };
  document.addEventListener('pointerdown', event => {
    if (!editor.scopeRootId || editor.preview || event.button !== 0 || event.altKey || event.shiftKey) return;
    const host = event.composedPath().find(item => item instanceof HTMLElement && item.classList.contains('tag-editable')) as HTMLElement | undefined;
    const element = event.composedPath().find(item => item instanceof HTMLElement && item.getRootNode() === host?.shadowRoot) as HTMLElement | undefined;
    if (!host || !element) return;
    const id = host.closest<HTMLElement>('.node')!.dataset.id!, path = tagPath(host.shadowRoot!, element); if (!path) return;
    event.preventDefault(); event.stopImmediatePropagation();
    (document.activeElement as HTMLElement)?.blur(); editor.onSelectTag(id, path);
    const node = editor.store.doc.nodes.find(node => node.id === id)!, css = getComputedStyle(host), surface = node.surface ?? { baseWidth: parseFloat(css.width), baseHeight: parseFloat(css.height) }, rect = host.getBoundingClientRect();
    const edit = node.elements?.find(item => pathKey(item.path) === pathKey(path)) ?? { path, tag: element.localName };
    drag = { pointer: event.pointerId, id, path, x: event.clientX, y: event.clientY, sx: rect.width / surface.baseWidth, sy: rect.height / surface.baseHeight, edit, host };
    host.setPointerCapture(event.pointerId);
  }, true);
  document.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (!drag.candidate && Math.hypot(dx, dy) < 4) return;
    const edit = { ...drag.edit, style: { ...drag.edit.style, x: (drag.edit.style?.x ?? 0) + Math.round(dx / drag.sx / GRID.cell) * GRID.cell, y: (drag.edit.style?.y ?? 0) + Math.round(dy / drag.sy / GRID.cell) * GRID.cell } };
    drag.candidate = edit;
    try { editor.renderer.previewElements(drag.id, editsFor(drag.id, edit)); render(); } catch { /* 松开时报告范围错误并回滚。 */ }
  });
  function cancel(commit = false) {
    const state = drag; drag = null;
    if (!state) return;
    if (state.host.hasPointerCapture(state.pointer)) state.host.releasePointerCapture(state.pointer);
    if (commit && state.candidate) editor.onChangeTag(state.id, state.candidate); else if (state.candidate) editor.render();
  }
  document.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) cancel(true); });
  document.addEventListener('pointercancel', () => cancel()); window.addEventListener('blur', () => cancel());
  document.addEventListener('click', event => { if (editor.scopeRootId && event.composedPath().some(item => item instanceof HTMLElement && item.classList.contains('tag-editable'))) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  const removeSelected = () => {
    const selected = editor.selectedTag; if (!selected) return; const host = editor.renderer.tagHost(selected.id); if (!host) return;
    const node = editor.store.doc.nodes.find(node => node.id === selected.id), element = tagAt(host.shadowRoot!, selected.path);
    if (element) editor.onChangeTag(selected.id, { ...(node?.elements?.find(item => pathKey(item.path) === pathKey(selected.path)) ?? { path: selected.path, tag: element.localName }), hidden: true });
  };
  function moveSelected(dx: number, dy: number) {
    const selected = editor.selectedTag; if (!selected) return; const host = editor.renderer.tagHost(selected.id); if (!host) return;
    const node = editor.store.doc.nodes.find(node => node.id === selected.id), element = tagAt(host.shadowRoot!, selected.path);
    if (!element) return;
    const edit = node?.elements?.find(item => pathKey(item.path) === pathKey(selected.path)) ?? { path: selected.path, tag: element.localName };
    editor.onChangeTag(selected.id, { ...edit, style: { ...edit.style, x: (edit.style?.x ?? 0) + dx * GRID.cell, y: (edit.style?.y ?? 0) + dy * GRID.cell } });
  }
  $('viewport')?.addEventListener('scroll', render);
  return { render, cancel, removeSelected, moveSelected };
}
function $(id: string) { return document.getElementById(id); }
