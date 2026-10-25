import { Layouts, type SavedLayout } from '../core/layouts';
import { Store } from '../core/store';
import type { StoreRouter } from '../core/store-router';
import type { Editor } from './editor';
import { setupLayoutLibrary } from './layout-library';
import { $, toast } from './dom';

/** 各布局独立历史；组件草稿的提交只会更新其所属的当前布局。 */
export function setupLayoutWorkspace(editor: Editor, router: StoreRouter, layouts: Layouts, finish: () => void, cancel: () => void, refresh: () => void) {
  const stores = new Map<string, Store>([[layouts.currentId, router.active]]);
  let workspace = router.active, timer: ReturnType<typeof setTimeout> | undefined, dirty = false, saveError = layouts.warning;
  let unsubscribe = () => {};
  const busy = () => !!editor.session?.current;
  function status() {
    if (!busy()) $('save-state').textContent = saveError ? '⚠ 保存未完成' : dirty ? '正在保存…' : '✓ 已保存到本地';
  }
  function save(manual = false): boolean {
    if (manual && busy()) { finish(); return false; }
    clearTimeout(timer);
    const changed = JSON.stringify(workspace.doc) !== JSON.stringify(layouts.current.document);
    if (!manual && !changed && !saveError) { dirty = false; status(); return true; }
    try {
      layouts.save(layouts.currentId, workspace.doc); dirty = false; saveError = ''; status();
      if (manual) toast(`已保存布局“${layouts.current.name}”`); return true;
    } catch (cause) {
      dirty = true; saveError = (cause as Error).message; status(); toast(saveError); return false;
    }
  }
  function bind() {
    unsubscribe();
    unsubscribe = workspace.subscribe(() => { dirty = true; saveError = ''; status(); clearTimeout(timer); timer = setTimeout(() => save(), 350); });
  }
  function prepare() {
    if (busy()) throw new Error('请先完成当前组件编辑，再切换或新建布局');
    cancel();
    if (!save()) throw new Error('当前布局保存失败，未切换布局；请检查存储权限或剩余空间后重试');
  }
  function activate(item: SavedLayout) {
    clearTimeout(timer); unsubscribe();
    if (editor.preview) editor.setPreview();
    workspace = stores.get(item.id) ?? new Store(item.document); stores.set(item.id, workspace);
    dirty = false; saveError = ''; editor.selectedIds.clear(); editor.selectedTag = null;
    bind(); router.activate(workspace); refresh();
    $('viewport').scrollLeft = 0; $('viewport').scrollTop = 0; render();
    $('layout-list').querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
  }
  const library = setupLayoutLibrary(layouts, {
    busy,
    select(id) {
      if (id === layouts.currentId) return;
      if (!layouts.items.some(item => item.id === id)) throw new Error('布局不存在');
      prepare(); layouts.select(id); activate(layouts.current);
    },
    create(name) { prepare(); const item = layouts.create(name); activate(item); },
  });
  function render() {
    $('project-name').textContent = layouts.current.name;
    $('workspace-heading').textContent = layouts.current.name; $('workspace-heading').title = `当前布局：${layouts.current.name}`;
    if (!busy()) document.title = `${layouts.current.name} · ComponentWeb`;
    library.render(); status();
  }
  $('save').addEventListener('click', () => save(true));
  window.addEventListener('pagehide', () => { clearTimeout(timer); if (dirty) save(); });
  window.addEventListener('beforeunload', event => { if (dirty && !save()) { event.preventDefault(); event.returnValue = ''; } });
  bind(); render(); return { save, render };
}
