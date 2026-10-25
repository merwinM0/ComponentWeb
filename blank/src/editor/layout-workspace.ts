import { Layouts, type SavedLayout } from '../core/layouts';
import { layoutHash, layoutIdFromHash } from '../core/layout-route';
import { Store } from '../core/store';
import type { StoreRouter } from '../core/store-router';
import type { Editor } from './editor';
import { setupLayoutLibrary, type LayoutActions } from './layout-library';
import { setupLayoutNavigation } from './layout-navigation';
import { $, toast } from './dom';

type HistoryMode = 'push' | 'replace' | 'none';
/** 首页与编辑器共享布局数据，各布局拥有独立历史；离开前只保存所属工作区。 */
export function setupLayoutWorkspace(editor: Editor, router: StoreRouter, layouts: Layouts, finish: () => void, cancel: () => void, refresh: () => void) {
  const stores = new Map<string, Store>([[layouts.currentId, router.active]]);
  let workspace = router.active, timer: ReturnType<typeof setTimeout> | undefined, dirty = false, saveError = layouts.warning, isHome = true;
  let unsubscribe = () => {};
  editor.active = false;
  const busy = () => !!editor.session?.current;
  function status() { if (!busy()) $('save-state').textContent = saveError ? '⚠ 保存未完成' : dirty ? '正在保存…' : '✓ 已保存到本地'; }
  function save(manual = false): boolean {
    if (isHome) return false;
    if (manual && busy()) { finish(); return false; }
    clearTimeout(timer);
    const changed = JSON.stringify(workspace.doc) !== JSON.stringify(layouts.current.document);
    if (!manual && !changed) { dirty = false; status(); return true; }
    try {
      layouts.save(layouts.currentId, workspace.doc); dirty = false; saveError = ''; status();
      if (manual) toast(`已保存布局“${layouts.current.name}”`); return true;
    } catch (cause) { dirty = true; saveError = (cause as Error).message; status(); toast(saveError); return false; }
  }
  function bind() {
    unsubscribe();
    unsubscribe = workspace.subscribe(() => { dirty = true; saveError = ''; status(); clearTimeout(timer); timer = setTimeout(() => save(), 350); });
  }
  function prepare() {
    if (busy()) throw new Error('请先完成当前组件编辑，再切换布局或返回首页');
    cancel();
    if (!isHome && !save()) throw new Error('当前布局保存失败，未离开当前布局；请检查存储权限或剩余空间后重试');
  }
  function writeRoute(id: string | null, mode: HistoryMode) {
    if (mode === 'none') return;
    const url = location.pathname + location.search + (id ? layoutHash(id) : '');
    if (location.pathname + location.search + location.hash !== url) history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url);
  }
  function screen(home: boolean) {
    isHome = home; editor.active = !home;
    if (home) { editor.renderer.clear(); editor.contextRenderer.clear(); }
    $('layout-home').hidden = !home; $('editor-page').hidden = home; $('editor-page').inert = home;
    $('layout-navigation').hidden = home; $('editor-actions').hidden = home; $('editor-status').hidden = home; $('home-location').hidden = !home;
    document.body.classList.toggle('home-view', home); document.body.dataset.view = home ? 'home' : 'editor'; $('toast').hidden = true;
  }
  function enter(item: SavedLayout, mode: HistoryMode) {
    clearTimeout(timer); unsubscribe();
    if (editor.preview) editor.setPreview();
    workspace = stores.get(item.id) ?? new Store(item.document); stores.set(item.id, workspace);
    dirty = false; saveError = layouts.warning; editor.selectedIds.clear(); editor.selectedTag = null;
    screen(false); bind(); router.activate(workspace); refresh();
    writeRoute(item.id, mode); navigation.close(); render();
    $('viewport').scrollLeft = 0; $('viewport').scrollTop = 0; window.scrollTo(0, 0); $('workspace-heading').focus({ preventScroll: true });
  }
  function open(id: string, mode: HistoryMode = 'push') {
    const item = layouts.items.find(item => item.id === id); if (!item) throw new Error('布局不存在');
    if (!isHome && id === layouts.currentId) { writeRoute(id, mode); return; }
    prepare(); layouts.select(id); enter(item, mode);
  }
  function home(mode: HistoryMode = 'push') {
    if (!isHome) { prepare(); if (editor.preview) editor.setPreview(); editor.setSelection([]); }
    screen(true); navigation.close(); writeRoute(null, mode); render(); window.scrollTo(0, 0); $('home-heading').focus({ preventScroll: true });
  }
  const actions: LayoutActions = {
    busy, select: id => open(id), home: () => home(),
    create(name) { prepare(); const item = layouts.create(name); enter(item, 'push'); },
  };
  const library = setupLayoutLibrary(layouts, actions), navigation = setupLayoutNavigation(layouts, actions);
  function render() {
    $('workspace-heading').textContent = layouts.current.name; $('workspace-heading').title = `当前布局：${layouts.current.name}`;
    if (isHome) document.title = '布局库 · ComponentWeb'; else if (!busy()) document.title = `${layouts.current.name} · ComponentWeb`;
    library.render(); navigation.render(); status();
  }
  function route() {
    try {
      if (document.querySelector('dialog[open]')) throw new Error('请先关闭当前对话框，再切换页面');
      const id = layoutIdFromHash(location.hash);
      if (id && layouts.items.some(item => item.id === id)) open(id, 'none');
      else { const invalid = !!location.hash; home('none'); if (invalid) { writeRoute(null, 'replace'); toast('找不到该布局，已返回布局库首页'); } }
    } catch (cause) {
      const target = location.pathname + location.search + (isHome ? '' : layoutHash(layouts.currentId));
      history.pushState({}, '', target); toast((cause as Error).message);
    }
  }
  $('home-link').addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); try { home(); } catch (cause) { toast((cause as Error).message); }
  });
  $('save').addEventListener('click', () => save(true));
  window.addEventListener('popstate', route); window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', () => { clearTimeout(timer); if (dirty) save(); });
  window.addEventListener('beforeunload', event => { if (dirty && !save()) { event.preventDefault(); event.returnValue = ''; } });
  bind(); route(); render(); return { save, render, get isHome() { return isHome; } };
}
