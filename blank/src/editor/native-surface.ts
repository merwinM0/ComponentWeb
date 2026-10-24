import { EDIT_SPACE } from '../core/grid';
import { nativeSurface, type NativeSurface } from '../core/element-edits';
import type { Placement } from '../core/types';

export function scaleNative(host: HTMLElement, node: Placement, scope = false) {
  if (!node.surface && !node.elements?.length) { for (const key of ['width', 'height', 'position', 'left', 'top', 'transform', 'transformOrigin'] as const) host.style[key] = ''; return; }
  const surface = nativeSurface(node), parent = host.parentElement!;
  const style = getComputedStyle(parent);
  const sx = scope ? 1 : parseFloat(style.width) / surface.width, sy = scope ? 1 : parseFloat(style.height) / surface.height;
  Object.assign(host.style, { position: 'absolute', left: '0', top: '0', width: `${surface.baseWidth}px`, height: `${surface.baseHeight}px`,
    transformOrigin: '0 0', transform: `matrix(${sx},0,0,${sy},${-surface.x * sx},${-surface.y * sy})` });
}
export function measureNative(host: HTMLElement, node: Placement): NativeSurface {
  const surface = nativeSurface(node), rect = host.getBoundingClientRect();
  const sx = rect.width / surface.baseWidth, sy = rect.height / surface.baseHeight;
  let left = 0, top = 0, right = surface.baseWidth, bottom = surface.baseHeight;
  // 修改字号 / 宽高也会让未直接选中的相邻标签重排，必须一起计入范围。
  for (const element of host.shadowRoot!.querySelectorAll('*')) {
    const box = element.getBoundingClientRect(); if (!box.width || !box.height) continue;
    let x1 = box.left, y1 = box.top, x2 = box.right, y2 = box.bottom, visible = true;
    let current: Element | null = element;
    while (current) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) { visible = false; break; }
      if (current !== element) {
        const clip = current.getBoundingClientRect();
        if (style.overflowX !== 'visible') { x1 = Math.max(x1, clip.left); x2 = Math.min(x2, clip.right); }
        if (style.overflowY !== 'visible') { y1 = Math.max(y1, clip.top); y2 = Math.min(y2, clip.bottom); }
      }
      current = current.parentElement;
    }
    if (!visible || x2 <= x1 || y2 <= y1) continue;
    left = Math.min(left, (x1 - rect.left) / sx); top = Math.min(top, (y1 - rect.top) / sy);
    right = Math.max(right, (x2 - rect.left) / sx); bottom = Math.max(bottom, (y2 - rect.top) / sy);
  }
  const precise = (value: number) => Math.round(value * 1e6) / 1e6;
  const result = { ...surface, x: precise(left), y: precise(top), width: precise(right - left), height: precise(bottom - top) };
  if (![result.x, result.y, result.width, result.height].every(Number.isFinite) || result.width > EDIT_SPACE.width || result.height > EDIT_SPACE.height) throw new Error('标签范围过大，请缩小字号或将标签靠近后再试');
  return result;
}
