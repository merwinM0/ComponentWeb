import { homePointer } from '../core/home-pointer';
import { $ } from './dom';

// 沿用旧偏好，扩大交互范围不会重新开启用户已关闭的增强。
export const HOME_INTERACTION_KEY = 'componentweb.home-motion.v1';
/** 首页全视口响应；背景与行高亮共享一帧，不接管点击、滚动或布局数据。 */
export function setupHomeInteraction() {
  const home = $('layout-home'), hero = $('home-hero'), backdrop = $('home-backdrop'), toggle = $<HTMLButtonElement>('toggle-home-interaction');
  const pulse = $('hero-pulse'), readout = $('hero-pointer-readout'), list = $('layout-list');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false, inView = true, tracking = false, frame: number | null = null, activeRow: HTMLElement | null = null;
  let pointer: { x: number; y: number; row: HTMLElement | null } | null = null, pulseAnimation: Animation | null = null;
  try { paused = localStorage.getItem(HOME_INTERACTION_KEY) === 'paused'; } catch { /* 本次仍可手动关闭。 */ }
  const enabled = () => !paused && !reduced.matches;
  const available = () => enabled() && !document.hidden && !home.hidden && !backdrop.hidden && !document.querySelector('dialog[open]');
  const hint = () => reduced.matches ? '保持静态，操作依然完整' : paused ? '交互效果已关闭' : fine.matches ? '移动鼠标，点亮整屏网格' : '轻触空白，感受整屏网格';
  function state() {
    backdrop.dataset.motion = available() ? tracking ? 'interacting' : 'idle' : 'paused';
    hero.dataset.motion = available() && inView ? tracking ? 'interacting' : 'idle' : 'paused';
  }
  function clearPreview() { for (const name of ['--shift-x', '--shift-y', '--tilt-x', '--tilt-y']) hero.style.removeProperty(name); }
  function clearRow() { activeRow?.removeAttribute('data-pointer'); activeRow = null; }
  function clearScene() {
    if (frame !== null) cancelAnimationFrame(frame); frame = null; pointer = null; tracking = false;
    pulseAnimation?.cancel(); pulseAnimation = null; clearPreview(); clearRow(); readout.textContent = hint(); state();
  }
  function paint(x: number, y: number, parallax: boolean) {
    const box = backdrop.getBoundingClientRect(), point = homePointer(x - box.left, y - box.top, backdrop.clientWidth, backdrop.clientHeight); if (!point) return null;
    const values = { '--pointer-x': `${point.x}px`, '--pointer-y': `${point.y}px`, '--cell-x': `${point.cellX}px`, '--cell-y': `${point.cellY}px`, '--cell-width': `${point.cellWidth}px`, '--cell-height': `${point.cellHeight}px` };
    for (const [name, value] of Object.entries(values)) backdrop.style.setProperty(name, value);
    if (inView) {
      const preview = { '--shift-x': `${parallax ? point.shiftX : 0}px`, '--shift-y': `${parallax ? point.shiftY : 0}px`, '--tilt-x': `${parallax ? point.tiltX : 0}deg`, '--tilt-y': `${parallax ? point.tiltY : 0}deg` };
      for (const [name, value] of Object.entries(preview)) hero.style.setProperty(name, value);
      readout.textContent = `视口坐标  ${Math.round(point.x).toString().padStart(3, '0')} / ${Math.round(point.y).toString().padStart(3, '0')}`;
    }
    tracking = true; state(); return point;
  }
  function paintRow(point: NonNullable<typeof pointer>) {
    const row = point.row; if (!row?.isConnected) { clearRow(); return; }
    const box = row.getBoundingClientRect();
    if (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) { clearRow(); return; }
    if (activeRow !== row) { clearRow(); activeRow = row; }
    row.style.setProperty('--row-x', `${point.x - box.left}px`); row.style.setProperty('--row-y', `${point.y - box.top}px`); row.dataset.pointer = 'true';
  }
  document.addEventListener('pointermove', event => {
    if (!available() || !fine.matches || event.pointerType === 'touch') return;
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>('.layout-item') : null;
    pointer = { x: event.clientX, y: event.clientY, row: row && list.contains(row) ? row : null };
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; if (pointer && available()) { paint(pointer.x, pointer.y, true); paintRow(pointer); } });
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !available() || !(event.target instanceof Element) || event.target.closest('button,a,input,select,textarea,label,form,dialog,[contenteditable],[role="button"]')) return;
    if (frame !== null) cancelAnimationFrame(frame); frame = null; pointer = null; clearRow();
    const point = paint(event.clientX, event.clientY, event.pointerType !== 'touch' && fine.matches); if (!point) return;
    pulseAnimation?.cancel(); pulse.style.setProperty('--pulse-x', `${point.x}px`); pulse.style.setProperty('--pulse-y', `${point.y}px`);
    const animation = pulse.animate([{ opacity: .65, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }], { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)' });
    pulseAnimation = animation;
    animation.onfinish = () => { if (pulseAnimation === animation) { pulseAnimation = null; if (event.pointerType === 'touch') clearScene(); } };
  }, { passive: true });
  document.addEventListener('pointerout', event => { if (!event.relatedTarget && event.pointerType !== 'touch') clearScene(); });
  document.addEventListener('pointercancel', clearScene);
  function render() {
    if (!available()) clearScene();
    if (!inView) clearPreview();
    home.dataset.interaction = available() ? 'enabled' : 'disabled'; state();
    if (!enabled() || !tracking) readout.textContent = hint();
    toggle.disabled = reduced.matches; toggle.setAttribute('aria-pressed', String(enabled()));
    toggle.textContent = reduced.matches ? '已减少动态' : paused ? '开启交互效果' : '整屏交互已开启';
    toggle.title = reduced.matches ? '遵循系统的减少动态效果设置' : paused ? '开启整屏鼠标跟随与点击反馈' : '关闭整屏鼠标跟随与点击反馈';
  }
  toggle.addEventListener('click', () => { paused = !paused; try { localStorage.setItem(HOME_INTERACTION_KEY, paused ? 'paused' : 'running'); } catch { /* 不影响布局保存。 */ } render(); });
  reduced.addEventListener('change', render); fine.addEventListener('change', () => { clearScene(); render(); });
  document.addEventListener('visibilitychange', render); window.addEventListener('blur', clearScene);
  // 视口坐标不随文档滚动改变，只清理可能已离开指针的布局行。
  window.addEventListener('scroll', clearRow, { passive: true }); window.addEventListener('resize', clearScene);
  if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? false; render(); }).observe(hero);
  render(); return { render };
}
