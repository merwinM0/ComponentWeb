import { pathKey, type ElementEdit, type ElementStyle } from '../core/element-edits';
import { EDIT_SPACE } from '../core/grid';
import type { Placement } from '../core/types';
import type { Editor } from './editor';
import { ownText, tagAt, tagChildren } from './element-dom';
const hex = (value: string) => { const parts = value.match(/[\d.]+/g), factor = value.startsWith('color(srgb') ? 255 : 1; return parts?.length ? `#${parts.slice(0, 3).map(value => Math.max(0, Math.min(255, Math.round(Number(value) * factor))).toString(16).padStart(2, '0')).join('')}` : '#dbe8f0'; };

export function elementPanel(editor: Editor, node: Placement) {
  const panel = document.createElement('section'); panel.className = 'element-panel'; panel.setAttribute('aria-label', '内部标签编辑');
  const host = editor.renderer.tagHost(node.id); if (!host?.shadowRoot || !editor.scopeRootId) return panel;
  panel.innerHTML = '<div class="section-title">内部标签元素 <span>HTML ELEMENTS</span></div><p class="inspector-help">点击标签或下方列表选择。拖动标签可定位；Alt + 拖动组件或拖动蓝色标题条，可移动整个组件。删除标签可随时恢复。</p>';
  const label = document.createElement('label'); label.className = 'field full'; label.textContent = '选择内部标签';
  const select = document.createElement('select'); select.id = 'element-select'; select.append(new Option('选择标签…', ''));
  const visit = (parent: ParentNode, path: number[] = []) => tagChildren(parent).forEach((element, index) => {
    const next = [...path, index]; if (next.length > 16 || select.options.length >= 201) return;
    const edit = node.elements?.find(item => pathKey(item.path) === pathKey(next));
    select.append(new Option(`${'　'.repeat(next.length - 1)}<${element.localName}> ${edit?.hidden ? '（已删除）' : ''}${ownText(element).slice(0, 28)}`, pathKey(next)));
    visit(element, next);
  }); visit(host.shadowRoot);
  const selection = editor.selectedTag?.id === node.id ? editor.selectedTag : null;
  select.value = selection ? pathKey(selection.path) : '';
  select.addEventListener('change', () => { if (select.value) editor.onSelectTag(node.id, select.value.split('.').map(Number)); }); label.append(select); panel.append(label);
  if (!selection) return panel;
  const element = tagAt(host.shadowRoot, selection.path); if (!element) return panel;
  const edit: ElementEdit = node.elements?.find(item => pathKey(item.path) === pathKey(selection.path)) ?? { path: selection.path, tag: element.localName };
  const computed = getComputedStyle(element), style = edit.style ?? {};
  const form = document.createElement('form'); form.className = 'element-form';
  form.innerHTML = `<label class="field full">直接文本 / 输入值<textarea id="element-text" name="text" maxlength="2000"></textarea></label>
    <div class="field-grid"><label class="field">偏移 X（px）<input id="element-x" name="x" type="number" min="-${EDIT_SPACE.width}" max="${EDIT_SPACE.width}" step="any"></label>
    <label class="field">偏移 Y（px）<input id="element-y" name="y" type="number" min="-${EDIT_SPACE.height}" max="${EDIT_SPACE.height}" step="any"></label>
    <label class="field">标签宽（px）<input id="element-width" name="width" type="number" min="1" max="${EDIT_SPACE.width}" step="any" placeholder="自动"></label>
    <label class="field">标签高（px）<input id="element-height" name="height" type="number" min="1" max="${EDIT_SPACE.height}" step="any" placeholder="自动"></label>
    <label class="field">字号（px）<input id="element-font-size" name="fontSize" type="number" min="8" max="200" step="any"></label>
    <label class="field">文字 HEX<input id="element-color" name="color" type="text" pattern="#[0-9a-fA-F]{6}" maxlength="7"></label>
    <label class="field">背景 HEX<input id="element-background" name="background" type="text" placeholder="透明 / 继承" pattern="#[0-9a-fA-F]{6}" maxlength="7"></label></div>`;
  const text = form.elements.namedItem('text') as HTMLTextAreaElement;
  text.value = edit.text ?? ownText(element); text.disabled = element.children.length > 0 && !ownText(element);
  const values = { x: style.x ?? 0, y: style.y ?? 0, width: style.width ?? '', height: style.height ?? '', fontSize: style.fontSize ?? '', color: style.color ?? hex(computed.color), background: style.background ?? (computed.backgroundColor === 'rgba(0, 0, 0, 0)' ? '' : hex(computed.backgroundColor)) };
  for (const [name, value] of Object.entries(values)) (form.elements.namedItem(name) as HTMLInputElement).value = String(value);
  (form.elements.namedItem('fontSize') as HTMLInputElement).placeholder = `${parseFloat(computed.fontSize)}（继承）`;
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', event => {
    if (!form.reportValidity()) return; const input = event.target as HTMLInputElement;
    if (input.name === 'text') editor.onChangeTag(node.id, { ...edit, text: input.value });
    else { const next: ElementStyle = { ...style }; if (input.value === '') delete next[input.name as keyof ElementStyle];
      else Object.assign(next, { [input.name]: ['color', 'background'].includes(input.name) ? input.value : Number(input.value) });
      editor.onChangeTag(node.id, { ...edit, style: next }); }
  }); panel.append(form);
  const actions = document.createElement('div'); actions.className = 'element-actions';
  for (const [text, run] of [[edit.hidden ? '恢复标签' : '删除标签', () => editor.onChangeTag(node.id, { ...edit, hidden: !edit.hidden })], ['重置此标签', () => editor.onChangeTag(node.id, null)]] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', run); actions.append(button);
  }
  const help = document.createElement('p'); help.className = 'inspector-help'; help.textContent = '标签外扩后自动缩放回显示框；自定义标签文案优先于组件文案，重置后恢复。';
  panel.append(actions, help); return panel;
}
