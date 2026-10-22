import { Store, loadDocument, saveDocument } from './core/store';
import { $, Editor, toast } from './editor/editor';
import { setupGestures } from './editor/gestures';
import { setupPanels } from './editor/panels';

const loaded = loadDocument();
const store = new Store(loaded.doc);
const editor = new Editor(store);
const gestures = setupGestures(editor);
const panels = setupPanels(editor);
let saveTimer: ReturnType<typeof setTimeout>;

function save(manual = false) {
  clearTimeout(saveTimer);
  const ok = saveDocument(store.doc);
  $('save-state').textContent = ok ? '✓ 已保存到本地' : '⚠ 保存失败';
  if (manual || !ok) toast(ok ? '布局已保存到当前浏览器' : '本地保存失败：请检查浏览器存储权限或可用空间');
}
store.subscribe(() => {
  $('save-state').textContent = '正在保存…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 350);
});
$('save').addEventListener('click', () => save(true));
$('undo').addEventListener('click', () => { gestures.cancel(); store.undo(); });
$('redo').addEventListener('click', () => { gestures.cancel(); store.redo(); });
$('preview').addEventListener('click', () => { gestures.cancel(); editor.setPreview(); panels.refresh(); });
$('zoom').addEventListener('change', event => {
  gestures.cancel();
  editor.setZoom(Number((event.target as HTMLSelectElement).value));
});

document.addEventListener('keydown', event => {
  // composedPath 可识别 Shadow DOM 内部的输入框。
  const path = event.composedPath();
  const typing = path.some(target => target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable));
  if (event.key === 'Escape') { editor.select(null); return; }
  if (typing || editor.preview) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); save(true); return; }
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault(); gestures.cancel(); event.shiftKey ? store.redo() : store.undo(); return;
  }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); gestures.cancel(); store.redo(); return; }
  if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); editor.duplicate(); return; }
  const node = editor.node;
  if (!node) return;
  // 面板按钮保留自身键盘行为，移动仅在画布或页面主体中触发。
  const target = event.target as HTMLElement;
  if (target.closest('.panel, .topbar, .workspace-toolbar')) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); editor.remove(); return; }
  const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const delta = directions[event.key];
  if (delta) {
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    editor.update({ ...node, col: node.col + delta[0] * step, row: node.row + delta[1] * step });
  }
});
window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  // 未改动时不覆盖损坏的原始存档。
  if (store.canUndo || store.canRedo) saveDocument(store.doc);
});
if (loaded.warning) toast(loaded.warning);
else $('save-state').textContent = '✓ 本地工作区已就绪';

// 窄屏默认收起属性面板，用户可通过原生 details 展开。
if (window.matchMedia('(max-width: 800px)').matches) {
  document.querySelector<HTMLDetailsElement>('.inspector details')!.open = false;
}
