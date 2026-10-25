import { registry } from '../components/registry';
import { applyTypography } from '../components/typography';
import { EDIT_SPACE, GRID } from '../core/grid';
import { nativeSurface } from '../core/element-edits';
import type { Document, Placement } from '../core/types';
import { applyTags } from './element-dom';
import { CanvasRenderer } from './canvas-renderer';

/** Measure intrinsic content in logical pixels, never from a zoomed screen rectangle. */
function intrinsicHeight(node: Placement, width: number) {
  const host = document.createElement('div');
  host.className = 'content-height-probe';
  host.style.width = `${width}px`;
  document.body.append(host);
  const instance = registry.get(node.type)!.mount(host, node.props);
  try {
    applyTypography(host, node.props.typography);
    const style = document.createElement('style');
    style.textContent = ':host{display:flow-root!important;position:static!important;height:auto!important;transform:none!important}:host>:not(style){height:auto;min-height:0}';
    host.shadowRoot!.append(style);
    applyTags(host, node.elements);
    const top = host.getBoundingClientRect().top;
    let bottom = top + host.getBoundingClientRect().height;
    for (const el of host.shadowRoot!.querySelectorAll<HTMLElement>('*')) {
      const box = el.getBoundingClientRect();
      if (box.width && box.height && getComputedStyle(el).visibility !== 'hidden') bottom = Math.max(bottom, box.bottom);
    }
    const height = Math.max(registry.get(node.type)!.min[1] * GRID.cell, Math.ceil(bottom - top));
    if (!Number.isFinite(height) || height > EDIT_SPACE.height) throw new Error('内容高度超过编辑范围，请减少内容或字号');
    return height;
  } finally { instance.destroy(); host.remove(); }
}

/** Resolve at transaction time. Height changes are saved in the same undo entry; collisions reject the whole edit. */
export function resolveContentHeights(doc: Document, scopeRootId: string | null): Placement[] {
  if (!doc.nodes.some(n => n.id !== scopeRootId && n.constraints?.heightMode === 'content')) return doc.nodes;
  const canvas = document.createElement('div');
  canvas.className = 'content-height-canvas';
  document.body.append(canvas);
  const renderer = new CanvasRenderer(canvas, () => {});
  let nodes = doc.nodes;
  try {
    for (let pass = 0; pass < 4; pass++) {
      renderer.render({ ...doc, nodes }, new Set(), false, scopeRootId);
      let changed = false;
      nodes = nodes.map(node => {
        if (node.id === scopeRootId || node.constraints?.heightMode !== 'content') return node;
        const width = parseFloat(getComputedStyle(renderer.element(node.id)!).width);
        const height = intrinsicHeight(node, width);
        if (Math.abs(node.rowSpan * GRID.cell - height) < 0.01) return node;
        changed = true;
        return { ...node, rowSpan: height / GRID.cell, ...(node.surface ? { surface: { ...nativeSurface(node), baseHeight: height, height } } : {}) };
      });
      if (!changed) return nodes;
    }
    throw new Error('内容高度无法稳定，请使用固定高度或调整父容器约束');
  } finally { renderer.clear(); canvas.remove(); }
}
