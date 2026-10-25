import { homePointer } from '../core/home-pointer';
import { $ } from './dom';

// 沿用旧的偏好键，已关闭自动动效的用户不会被重新开启交互增强。
export const HOME_INTERACTION_KEY = 'componentweb.home-motion.v1';
/** 只响应输入事件；每次移动最多安排一帧，没有空闲循环，不写布局数据。 */
export function setupHomeInteraction() {
  const home = $('layout-home'), hero = $('home-hero'), toggle = $<HTMLButtonElement>('toggle-home-interaction');
  const pulse = $('hero-pulse'), readout = $('hero-pointer-readout'), list = $('layout-list');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false, inView = true, tracking = false, heroFrame: number | null = null, rowFrame: number | null = null;
  let pointer: { x: number; y: number } | null = null, rowPointer: { row: HTMLElement; x: number; y: number } | null = null, activeRow: HTMLElement | null = null;
  let pulseAnimation: Animation | null = null;
  try { paused = localStorage.getItem(HOME_INTERACTION_KEY) === 'paused'; } catch { /* 偏好不可读时仍可在本次使用开关。 */ }
  const enabled = () => !paused && !reduced.matches;
  const available = () => enabled() && !document.hidden && !home.hidden && !document.querySelector('dialog[open]');
  const heroAvailable = () => available() && inView;
  function clearHero() {
    if (heroFrame !== null) cancelAnimationFrame(heroFrame); heroFrame = null; pointer = null; tracking = false;
    pulseAnimation?.cancel(); pulseAnimation = null;
    for (const name of ['--shift-x', '--shift-y', '--tilt-x', '--tilt-y']) hero.style.removeProperty(name);
    readout.textContent = fine.matches ? '移动鼠标，点亮网格' : '轻触空白，感受网格'; hero.dataset.motion = heroAvailable() ? 'idle' : 'paused';
  }
  function clearRow() {
    if (rowFrame !== null) cancelAnimationFrame(rowFrame); rowFrame = null; rowPointer = null;
    activeRow?.removeAttribute('data-pointer'); activeRow = null;
  }
  function paint(x: number, y: number, parallax: boolean) {
    const box = hero.getBoundingClientRect(), point = homePointer(x - box.left - hero.clientLeft, y - box.top - hero.clientTop, hero.clientWidth, hero.clientHeight); if (!point) return;
    const values = { '--pointer-x': `${point.x}px`, '--pointer-y': `${point.y}px`, '--cell-x': `${point.cellX}px`, '--cell-y': `${point.cellY}px`, '--cell-width': `${point.cellWidth}px`, '--cell-height': `${point.cellHeight}px`,
      '--shift-x': `${parallax ? point.shiftX : 0}px`, '--shift-y': `${parallax ? point.shiftY : 0}px`, '--tilt-x': `${parallax ? point.tiltX : 0}deg`, '--tilt-y': `${parallax ? point.tiltY : 0}deg` };
    for (const [name, value] of Object.entries(values)) hero.style.setProperty(name, value);
    readout.textContent = `网格坐标  ${Math.round(point.x).toString().padStart(3, '0')} / ${Math.round(point.y).toString().padStart(3, '0')}`;
    tracking = true; hero.dataset.motion = 'interacting';
  }
  hero.addEventListener('pointermove', event => {
    if (!heroAvailable() || !fine.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (heroFrame !== null) return;
    heroFrame = requestAnimationFrame(() => { heroFrame = null; if (pointer && heroAvailable()) paint(pointer.x, pointer.y, true); });
  }, { passive: true });
  hero.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !heroAvailable() || (event.target as Element).closest('button,a,input,select,textarea,[contenteditable]')) return;
    paint(event.clientX, event.clientY, event.pointerType !== 'touch' && fine.matches);
    pulseAnimation?.cancel();
    const animation = pulse.animate([{ opacity: .65, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }], { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)' });
    pulseAnimation = animation;
    animation.onfinish = () => { if (pulseAnimation === animation) { pulseAnimation = null; if (event.pointerType === 'touch') clearHero(); } };
  }, { passive: true });
  hero.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') clearHero(); });
  hero.addEventListener('pointercancel', clearHero);
  list.addEventListener('pointermove', event => {
    if (!available() || !fine.matches || event.pointerType === 'touch') return;
    const row = (event.target as Element).closest<HTMLElement>('.layout-item'); if (!row || !list.contains(row)) return;
    rowPointer = { row, x: event.clientX, y: event.clientY };
    if (rowFrame !== null) return;
    rowFrame = requestAnimationFrame(() => {
      rowFrame = null; const point = rowPointer; if (!point || !available() || !point.row.isConnected) { clearRow(); return; }
      if (activeRow !== point.row) { activeRow?.removeAttribute('data-pointer'); activeRow = point.row; }
      const box = point.row.getBoundingClientRect(); activeRow.style.setProperty('--row-x', `${point.x - box.left}px`); activeRow.style.setProperty('--row-y', `${point.y - box.top}px`); activeRow.dataset.pointer = 'true';
    });
  }, { passive: true });
  list.addEventListener('pointerleave', clearRow); list.addEventListener('pointercancel', clearRow);
  function render() {
    if (!heroAvailable()) clearHero();
    if (!available()) clearRow();
    home.dataset.interaction = available() ? 'enabled' : 'disabled';
    hero.dataset.motion = heroAvailable() ? tracking ? 'interacting' : 'idle' : 'paused';
    if (!enabled()) readout.textContent = reduced.matches ? '保持静态，操作依然完整' : '交互效果已关闭';
    else if (!tracking) readout.textContent = fine.matches ? '移动鼠标，点亮网格' : '轻触空白，感受网格';
    toggle.disabled = reduced.matches; toggle.setAttribute('aria-pressed', String(enabled()));
    toggle.textContent = reduced.matches ? '已减少动态' : paused ? '开启交互效果' : '交互效果已开启';
    toggle.title = reduced.matches ? '遵循系统的减少动态效果设置' : paused ? '开启鼠标跟随与点击反馈' : '关闭鼠标跟随与点击反馈';
  }
  toggle.addEventListener('click', () => { paused = !paused; try { localStorage.setItem(HOME_INTERACTION_KEY, paused ? 'paused' : 'running'); } catch { /* 只影响偏好记忆，不影响布局保存。 */ } render(); });
  reduced.addEventListener('change', render); fine.addEventListener('change', () => { clearHero(); clearRow(); render(); });
  document.addEventListener('visibilitychange', render); window.addEventListener('blur', () => { clearHero(); clearRow(); });
  window.addEventListener('scroll', () => { clearHero(); clearRow(); }, { passive: true });
  window.addEventListener('resize', () => { clearHero(); clearRow(); });
  if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? false; render(); }).observe(hero);
  render(); return { render };
}
