import { $ } from './dom';

export const HOME_MOTION_KEY = 'componentweb.home-motion.v1';
/** 仅驱动首页装饰：不写布局，不启动逐帧 JS；离屏、后台与编辑器中自动暂停。 */
export function setupHomeMotion() {
  const hero = $('home-hero'), toggle = $<HTMLButtonElement>('toggle-home-motion'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false, inView = true;
  try { paused = localStorage.getItem(HOME_MOTION_KEY) === 'paused'; } catch { /* 存储不可用时仍允许本次手动开关。 */ }
  const enabled = () => !paused && !reduced.matches;
  function render() {
    hero.dataset.motion = enabled() && inView && !document.hidden && !$('layout-home').hidden && !document.querySelector('dialog[open]') ? 'running' : 'paused';
    toggle.disabled = reduced.matches; toggle.setAttribute('aria-pressed', String(enabled()));
    toggle.textContent = reduced.matches ? '已减少动态' : paused ? '▷ 开启动效' : 'Ⅱ 暂停动效';
    toggle.title = reduced.matches ? '遵循系统的减少动态效果设置' : paused ? '开启首页装饰动效' : '暂停首页装饰动效';
  }
  toggle.addEventListener('click', () => {
    paused = !paused; try { localStorage.setItem(HOME_MOTION_KEY, paused ? 'paused' : 'running'); } catch { /* 不影响开关和布局保存。 */ }
    render();
  });
  reduced.addEventListener('change', render); document.addEventListener('visibilitychange', render);
  if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? false; render(); }).observe(hero);
  render(); return { render };
}
