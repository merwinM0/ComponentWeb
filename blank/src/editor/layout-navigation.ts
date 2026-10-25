import type { Layouts } from '../core/layouts';
import type { LayoutActions } from './layout-library';
import { $, toast } from './dom';

export function setupLayoutNavigation(layouts: Layouts, actions: LayoutActions) {
  const trigger = $<HTMLButtonElement>('layout-switcher'), menu = $('recent-layout-menu'), list = $('recent-layout-list'); menu.tabIndex = -1;
  const buttons = () => [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
  function close(restore = false) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (restore && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true }); }
  function focus(item: HTMLElement) { item.focus({ preventScroll: true }); item.scrollIntoView({ block: 'nearest' }); }
  function open(last = false) { render(); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); const items = buttons(); focus((last ? items.at(-1) : items[0]) ?? menu); }
  trigger.addEventListener('click', () => menu.hidden ? open() : close(true));
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); open(event.key === 'ArrowUp'); }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    const items = buttons(), index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); event.stopPropagation(); if (items[next]) focus(items[next]); }
  });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) close(); });
  document.addEventListener('focusin', event => { if (!menu.hidden && !menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) close(); });
  window.addEventListener('blur', () => close());
  $('all-layouts').addEventListener('click', () => { try { actions.home(); close(); } catch (cause) { toast((cause as Error).message); } });
  let signature = '';
  function render() {
    const busy = actions.busy(); trigger.title = `当前布局：${layouts.current.name}；切换最近修改的 5 个布局`;
    $('project-name').textContent = layouts.current.name;
    $<HTMLButtonElement>('all-layouts').disabled = busy;
    $('recent-layout-note').textContent = busy ? '请先完成组件编辑，再切换布局或返回首页' : '最近修改的 5 个布局';
    const next = JSON.stringify([layouts.currentId, busy, layouts.recent.map(item => [item.id, item.name, item.updatedAt])]);
    if (signature === next) return; signature = next;
    const focused = (document.activeElement as HTMLElement)?.dataset.layoutId; list.replaceChildren();
    for (const item of layouts.recent) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'recent-layout-item'; button.setAttribute('role', 'menuitem'); button.tabIndex = -1; button.dataset.layoutId = item.id; button.disabled = busy; button.title = item.name;
      const name = document.createElement('span'); name.textContent = item.name; button.append(name);
      if (item.id === layouts.currentId) { button.setAttribute('aria-current', 'true'); const current = document.createElement('span'); current.className = 'layout-current'; current.textContent = '当前'; button.append(current); }
      button.addEventListener('click', () => { try { actions.select(item.id); close(); } catch (cause) { toast((cause as Error).message); } }); list.append(button);
    }
    if (focused && !menu.hidden) [...list.querySelectorAll<HTMLButtonElement>('button')].find(button => button.dataset.layoutId === focused)?.focus({ preventScroll: true });
  }
  layouts.subscribe(render); render(); return { render, close };
}
