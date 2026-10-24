import type { Combinations } from '../core/combinations';
import { GRID } from '../core/grid';
import { isContainer } from '../core/types';
import type { Editor } from './editor';

export function combinationTiles(target: HTMLElement, editor: Editor, combinations: Combinations, query: string, dialogs: { rename(id: string): void; remove(id: string): void }) {
  let count = 0;
  for (const item of combinations.items) {
    if (!item.name.toLowerCase().includes(query)) continue;
    count++;
    const root = item.document.nodes.find(node => !node.parentId)!;
    const tile = document.createElement('article'); tile.className = 'component-tile combination-tile'; tile.dataset.combination = item.id;
    const preview = document.createElement('div'); preview.className = 'tile-preview';
    const glyph = document.createElement('span'); glyph.className = 'preview-icon'; glyph.textContent = '⊞';
    const caption = document.createElement('span'); caption.className = 'preview-caption'; caption.textContent = `${item.document.nodes.length} 个组件 · ${root.layout?.mode.toUpperCase() ?? '独立组件'}`; preview.append(glyph, caption);
    const info = document.createElement('div'); info.className = 'tile-info';
    const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.name;
    const hint = document.createElement('small'); hint.textContent = `${Math.round(root.colSpan * GRID.cell)} × ${Math.round(root.rowSpan * GRID.cell)} px · 本地组合`; text.append(title, hint);
    const add = document.createElement('button'); add.type = 'button'; add.textContent = '＋ 添加'; add.setAttribute('aria-label', `添加组合 ${item.name}`); add.disabled = editor.preview;
    add.addEventListener('click', () => editor.insertSnapshot(item.document, !editor.scopeRootId && editor.node && isContainer(editor.node) ? editor.node.id : null));
    info.append(text, add);
    const actions = document.createElement('div'); actions.className = 'combination-tile-actions';
    for (const [label, run] of [['重命名', () => dialogs.rename(item.id)], ['删除', () => dialogs.remove(item.id)]] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', `${label}组合 ${item.name}`); button.disabled = editor.preview || (label === '删除' && !!editor.session?.frames.some(frame => frame.templateId === item.id)); button.addEventListener('click', run); actions.append(button);
    }
    tile.append(preview, info, actions); target.append(tile);
  }
  if (!count) {
    const empty = document.createElement('div'); empty.className = 'empty-list'; empty.textContent = query ? '没有匹配的组合。' : '还没有组合。选择画布中的组件，点击「保存组合」或使用右键菜单。'; target.append(empty);
  }
  return count;
}
