import { registry } from '../components/registry';
import { isContainer } from '../core/types';
import type { Combinations } from '../core/combinations';
import { $, Editor } from './editor';
import { actionButton, selectionActions, type Action } from './selection-actions';

export function setupContextMenu(editor: Editor, combinations: Combinations, dialogs: { rename(id: string): void; remove(id: string): void }, cancelGesture: () => void) {
  const menu = document.createElement('div'); menu.id = 'context-menu'; menu.className = 'context-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '工作台功能菜单'); document.body.append(menu);
  let returnFocus: HTMLElement | null = null;
  function close(restore = false) { menu.hidden = true; if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); }
  function show(x: number, y: number, target?: HTMLElement) {
    if (document.querySelector('dialog[open]')) return;
    cancelGesture(); returnFocus = document.activeElement as HTMLElement;
    const tile = target?.closest<HTMLElement>('.component-tile');
    const node = target ? editor.hitNode(target) : editor.node;
    if (!editor.preview && node && !editor.selectedIds.has(node.id)) editor.select(node.id);
    else if (!editor.preview && target && !node && target.closest('#viewport')) editor.select(null);
    let title = editor.preview ? '预览模式' : node ? (editor.selectedIds.size > 1 ? `${editor.selectedIds.size} 个组件` : node.props.title || '组件操作') : '工作台功能';
    const actions: Action[] = [];
    if (tile?.dataset.combination) {
      const item = combinations.items.find(item => item.id === tile.dataset.combination);
      if (item) { title = item.name; actions.push({ label: '添加此组合', disabled: editor.preview, run: () => editor.insertSnapshot(item.document) }, { label: '编辑组合', disabled: editor.preview, run: () => editor.onEditSavedCombination(item.id) }, { label: '重命名组合', disabled: editor.preview, run: () => dialogs.rename(item.id) }, { label: '删除组合', danger: true, disabled: editor.preview || !!editor.session?.frames.some(frame => frame.templateId === item.id), run: () => dialogs.remove(item.id) }); }
    } else if (tile?.dataset.type) {
      const type = tile.dataset.type; title = registry.get(type)!.title;
      actions.push({ label: `添加${title}`, disabled: editor.preview, run: () => editor.add(type) });
    } else if (!editor.preview && editor.selectedIds.size) actions.push(...selectionActions(editor).filter(action => !action.disabled));
    if (!editor.preview && !tile) {
      actions.push({ label: '全选当前同级组件', run: () => editor.selectAll(node?.parentId ?? null) },
        { label: editor.scopeRootId ? '添加容器散件' : '添加布局容器', run: () => editor.onNewComponent() });
      if (node && isContainer(node)) actions.push({ label: '添加子容器', run: () => editor.onNewComponent(node.id) });
    }
    actions.push({ label: '撤销', disabled: editor.preview || !editor.store.canUndo, run: () => editor.store.undo() }, { label: '重做', disabled: editor.preview || !editor.store.canRedo, run: () => editor.store.redo() },
      { label: editor.preview ? '返回编辑' : '进入预览', disabled: !!editor.scopeRootId, run: () => $('preview').click() }, { label: editor.scopeRootId ? '完成本层编辑' : '保存当前布局', run: () => $('save').click() });
    const heading = document.createElement('div'); heading.className = 'context-heading'; heading.textContent = title; heading.setAttribute('role', 'presentation'); menu.replaceChildren(heading);
    for (const action of actions) menu.append(actionButton({ ...action, run: () => { close(); action.run(); } }, true));
    menu.hidden = false; menu.style.left = '0px'; menu.style.top = '0px';
    const rect = menu.getBoundingClientRect(); menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  document.addEventListener('contextmenu', event => {
    if (event.composedPath().some(target => target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) || document.querySelector('dialog[open]')) return;
    event.preventDefault(); show(event.clientX, event.clientY, event.target as HTMLElement);
  });
  menu.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); event.stopPropagation(); buttons[next]?.focus({ preventScroll: true }); buttons[next]?.scrollIntoView({ block: 'nearest' }); }
  });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target as Node)) close(); });
  document.addEventListener('wheel', event => { if (!menu.contains(event.target as Node)) close(); }, { passive: true });
  window.addEventListener('resize', () => close()); window.addEventListener('blur', () => close());
  $('more-actions').addEventListener('click', () => { const rect = $('more-actions').getBoundingClientRect(); show(rect.left, rect.bottom + 4); });
  document.addEventListener('keydown', event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      if (event.composedPath().some(target => target instanceof HTMLElement && target.matches('input,textarea,select'))) return;
      event.preventDefault(); const target = editor.selected ? editor.renderer.element(editor.selected) : $('viewport'); const rect = target!.getBoundingClientRect(); show(rect.left + 20, rect.top + 20, target);
    }
  });
  return { close };
}
