import { freeSiblings } from '../core/operations';
import { isContainer } from '../core/types';
import type { Editor } from './editor';

export interface Action { label: string; run(): void; disabled?: boolean; danger?: boolean }
export function selectionActions(editor: Editor): Action[] {
  const count = editor.selection.length;
  const free = freeSiblings(editor.store.doc.nodes, editor.selection);
  const disabled = editor.preview;
  const protectedRoot = !!editor.scopeRootId && editor.selectedIds.has(editor.scopeRootId);
  const parent = editor.store.doc.nodes.find(node => node.id === editor.node?.parentId);
  const canOrder = count === 1 && !!parent?.layout && parent.layout.mode !== 'free';
  return [
    ...([['左对齐', 'left'], ['水平居中', 'center-x'], ['右对齐', 'right'], ['顶对齐', 'top'], ['垂直居中', 'center-y'], ['底对齐', 'bottom']] as const).map(([label, value]) => ({ label, run: () => editor.align(value), disabled: disabled || count < 2 || !free })),
    { label: '水平等间距', run: () => editor.distribute('x'), disabled: disabled || count < 3 || !free },
    { label: '垂直等间距', run: () => editor.distribute('y'), disabled: disabled || count < 3 || !free },
    { label: '编辑组件', run: () => { if (editor.node) editor.onEditComponent(editor.node.id); }, disabled: disabled || !editor.node || protectedRoot },
    { label: editor.scopeRootId ? '组装本层' : '组合为自由容器', run: () => editor.group('free'), disabled: disabled || (editor.scopeRootId ? !editor.store.doc.nodes.length : !count || !free) },
    { label: '组合为 Flex 容器', run: () => editor.group('flex'), disabled: disabled || !count || !free || !!editor.scopeRootId },
    { label: '组合为 Grid 容器', run: () => editor.group('grid'), disabled: disabled || !count || !free || !!editor.scopeRootId },
    { label: '解散容器', run: () => editor.ungroup(), disabled: disabled || !editor.node || !isContainer(editor.node) },
    { label: '保存到我的组合', run: () => editor.onSaveCombination(), disabled: disabled || !count || (count > 1 && !free) },
    { label: '前移一位', run: () => editor.reorder(-1), disabled: disabled || !canOrder },
    { label: '后移一位', run: () => editor.reorder(1), disabled: disabled || !canOrder },
    { label: '复制所选', run: () => editor.duplicate(), disabled: disabled || !count },
    { label: '删除所选', run: () => editor.remove(), disabled: disabled || !count, danger: true },
  ];
}
export function actionButton(action: Action, menu = false) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label; button.disabled = !!action.disabled;
  if (menu) { button.setAttribute('role', 'menuitem'); button.tabIndex = -1; }
  if (action.danger) button.classList.add('danger');
  button.addEventListener('click', action.run); return button;
}
export function renderMulti(container: HTMLElement, editor: Editor) {
  const heading = document.createElement('h2'); heading.className = 'multi-title'; heading.textContent = `已选择 ${editor.selectedIds.size} 个组件`;
  const help = document.createElement('p'); help.className = 'inspector-help'; help.textContent = '拖动任一所选项即可整体移动。对齐和分布仅作用于同一自由布局区域；一次操作可整体撤销。';
  const actions = document.createElement('div'); actions.className = 'batch-actions';
  selectionActions(editor).forEach(action => actions.append(actionButton(action)));
  container.replaceChildren(heading, help, actions);
}
