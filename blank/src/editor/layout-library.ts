import type { Layouts } from '../core/layouts';
import { $, toast } from './dom';

interface LayoutActions { busy(): boolean; select(id: string): void; create(name: string): void }
/** 只由用户切换库视图；保存、创建和加载布局不会自动切换回组件库。 */
export function setupLayoutLibrary(layouts: Layouts, actions: LayoutActions) {
  const components = $<HTMLDetailsElement>('component-library'), library = $<HTMLDetailsElement>('layout-library'), list = $('layout-list');
  function toggle(showLayouts: boolean, event: Event) {
    event.preventDefault(); event.stopPropagation();
    components.hidden = showLayouts; library.hidden = !showLayouts;
    $('show-layouts').hidden = showLayouts; $('show-components').hidden = !showLayouts;
    (showLayouts ? library : components).open = true;
    document.querySelector('.library')!.setAttribute('aria-label', showLayouts ? '布局库' : '组件库');
    $(showLayouts ? 'show-components' : 'show-layouts').focus({ preventScroll: true });
  }
  $('show-layouts').addEventListener('click', event => toggle(true, event));
  $('show-components').addEventListener('click', event => toggle(false, event));

  const dialog = document.createElement('dialog'); dialog.className = 'editor-dialog'; dialog.setAttribute('aria-labelledby', 'layout-dialog-title');
  dialog.innerHTML = '<form id="layout-form"><h2 id="layout-dialog-title">新建布局</h2><p>创建一个空白布局，当前布局会先保存。</p><label class="field">布局名称<input id="layout-name" type="text" maxlength="60" required autocomplete="off" autofocus></label><p id="layout-error" role="alert"></p><div class="dialog-actions"><button type="button" data-cancel>取消</button><button type="submit" class="primary">创建布局</button></div></form>';
  document.body.append(dialog);
  const input = $<HTMLInputElement>('layout-name'), error = $('layout-error');
  $('new-layout').addEventListener('click', () => {
    if (actions.busy()) { toast('请先完成当前组件编辑，再新建布局'); return; }
    input.value = `新布局 ${layouts.items.length + 1}`; error.textContent = ''; dialog.showModal(); input.select();
  });
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault(); if (!dialog.querySelector('form')!.reportValidity()) return;
    try { actions.create(input.value); dialog.close(); list.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true }); toast(`已新建布局“${layouts.current.name}”`); }
    catch (cause) { error.textContent = (cause as Error).message; }
  });

  const format = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  let signature = '';
  function render() {
    const busy = actions.busy();
    $<HTMLButtonElement>('new-layout').disabled = busy;
    $('layout-count').textContent = String(layouts.items.length);
    $('layout-library-note').textContent = busy ? '正在编辑组件，请完成编辑后再切换或新建布局。' : '按最近修改排列，打开工作台时恢复最近修改的布局。';
    const next = JSON.stringify([layouts.currentId, busy, layouts.items.map(item => [item.id, item.name, item.updatedAt, item.document.nodes.length])]);
    if (signature === next) return; signature = next;
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.layoutId : undefined, scroll = list.scrollTop;
    list.replaceChildren();
    for (const item of layouts.sorted) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'layout-item'; button.dataset.layoutId = item.id; button.disabled = busy;
      const heading = document.createElement('span'); heading.className = 'layout-item-heading';
      const name = document.createElement('strong'); name.textContent = item.name; heading.append(name);
      if (item.id === layouts.currentId) { button.setAttribute('aria-current', 'true'); const badge = document.createElement('span'); badge.className = 'layout-current'; badge.textContent = '当前'; heading.append(badge); }
      const detail = document.createElement('small'); detail.textContent = `${item.document.nodes.length} 个组件 · 修改于 ${format.format(new Date(item.updatedAt))}`;
      button.title = `${item.name} · ${new Date(item.updatedAt).toLocaleString('zh-CN')}`;
      button.append(heading, detail); button.addEventListener('click', () => { try { actions.select(item.id); } catch (cause) { toast((cause as Error).message); } }); list.append(button);
    }
    if (focused) [...list.querySelectorAll<HTMLButtonElement>('.layout-item')].find(button => button.dataset.layoutId === focused)?.focus({ preventScroll: true });
    list.scrollTop = scroll;
  }
  layouts.subscribe(render); render(); return { render };
}
