import type { Layouts } from '../core/layouts';
import { $, toast } from './dom';

export interface LayoutActions { busy(): boolean; select(id: string): void; create(name: string): void; home(): void }
/** 首页只展示完整布局库，不改变当前布局，也不更新修改时间。 */
export function setupLayoutLibrary(layouts: Layouts, actions: LayoutActions) {
  const list = $('layout-list'), search = $<HTMLInputElement>('layout-search');
  const dialog = document.createElement('dialog'); dialog.className = 'editor-dialog'; dialog.setAttribute('aria-labelledby', 'layout-dialog-title');
  dialog.innerHTML = '<form id="layout-form"><h2 id="layout-dialog-title">新建布局</h2><p>创建一个空白布局，保存后进入编辑器。</p><label class="field">布局名称<input id="layout-name" type="text" maxlength="60" required autocomplete="off" autofocus></label><p id="layout-error" role="alert"></p><div class="dialog-actions"><button type="button" data-cancel>取消</button><button type="submit" class="primary">创建并进入</button></div></form>';
  document.body.append(dialog);
  const input = $<HTMLInputElement>('layout-name'), error = $('layout-error');
  $('new-layout').addEventListener('click', () => {
    if (actions.busy()) { toast('请先完成当前组件编辑，再新建布局'); return; }
    input.value = `新布局 ${layouts.items.length + 1}`; error.textContent = ''; dialog.showModal(); input.select();
  });
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault(); if (!dialog.querySelector('form')!.reportValidity()) return;
    try { actions.create(input.value); dialog.close(); $('workspace-heading').focus({ preventScroll: true }); toast(`已新建布局“${layouts.current.name}”`); }
    catch (cause) { error.textContent = (cause as Error).message; }
  });

  const format = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  let signature = '';
  function render() {
    $<HTMLButtonElement>('new-layout').disabled = actions.busy(); $('layout-count').textContent = String(layouts.items.length);
    $('layout-home-warning').textContent = layouts.warning; $('layout-home-warning').hidden = !layouts.warning;
    const query = search.value.trim().toLowerCase(), filtered = layouts.sorted.filter(item => item.name.toLowerCase().includes(query));
    $('layout-results').textContent = query ? `${filtered.length} 个匹配布局 · 最近修改优先` : `${layouts.items.length} 个布局 · 最近修改优先`;
    $('layout-empty').hidden = !!filtered.length;
    const next = JSON.stringify([query, layouts.items.map(item => [item.id, item.name, item.updatedAt, item.document.nodes.length])]);
    if (signature === next) return; signature = next;
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.layoutId : undefined;
    list.replaceChildren();
    for (const item of filtered) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'layout-item'; button.dataset.layoutId = item.id;
      const heading = document.createElement('span'); heading.className = 'layout-item-heading';
      const icon = document.createElement('span'); icon.className = 'layout-icon'; icon.textContent = '▦'; icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('strong'); name.textContent = item.name; heading.append(icon, name);
      if (item.id === layouts.sorted[0]?.id) { const latest = document.createElement('span'); latest.className = 'layout-latest'; latest.textContent = '最近修改'; heading.append(latest); }
      const detail = document.createElement('small'); detail.textContent = `${item.document.nodes.length} 个组件`;
      const time = document.createElement('time'); time.dateTime = item.updatedAt; time.textContent = format.format(new Date(item.updatedAt));
      const open = document.createElement('span'); open.className = 'layout-open'; open.textContent = '↗'; open.setAttribute('aria-hidden', 'true');
      button.title = `打开 ${item.name}`; button.append(heading, detail, time, open);
      button.addEventListener('click', () => { try { actions.select(item.id); } catch (cause) { toast((cause as Error).message); } }); list.append(button);
    }
    if (focused) [...list.querySelectorAll<HTMLButtonElement>('.layout-item')].find(button => button.dataset.layoutId === focused)?.focus({ preventScroll: true });
  }
  search.addEventListener('input', render); layouts.subscribe(render); render(); return { render };
}
