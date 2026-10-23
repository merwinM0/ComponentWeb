import { components } from '../components/registry';
import { descendants } from '../core/tree';
import { isContainer, type ContainerLayout } from '../core/types';
import type { Editor } from './editor';

export function layoutPanel(editor: Editor) {
  const container = document.createElement('div');
  const node = editor.node; if (!node) return container;
  const excluded = descendants(editor.store.doc.nodes, [node.id]);
  const label = document.createElement('label'); label.className = 'field full'; label.textContent = '父容器';
  const parent = document.createElement('select'); parent.id = 'prop-parent'; parent.disabled = editor.preview || node.id === editor.scopeRootId;
  parent.append(new Option(editor.scopeRootId ? '当前设计页（根级）' : '工作区（根级）', node.id === editor.scopeRootId ? '' : editor.scopeRootId ?? ''));
  for (const other of editor.store.doc.nodes) if (isContainer(other) && other.id !== editor.scopeRootId && !excluded.has(other.id)) parent.append(new Option(`${other.props.title || '容器'} · ${other.id.slice(0, 5)}`, other.id));
  parent.value = node.parentId ?? ''; parent.addEventListener('change', () => { editor.reparent(parent.value || null); editor.onSelection(); }); label.append(parent); container.append(label);
  if (!isContainer(node)) return container;
  const form = document.createElement('form'); form.className = 'layout-form';
  form.innerHTML = `<div class="section-title">容器布局 <span>LAYOUT ENGINE</span></div>
    <label class="field">布局方式<select id="layout-mode" name="mode"><option value="free">自由定位</option><option value="flex">Flex 弹性布局</option><option value="grid">Grid 网格布局</option></select></label>
    <div class="field-grid"><label class="field">排列方向<select name="direction" id="layout-direction"><option value="row">横向</option><option value="column">纵向</option></select></label>
    <label class="field">Grid 列数<input name="columns" id="layout-columns" type="number" min="1" max="12" step="1" required></label>
    <label class="field">间距 gap（px）<input name="gap" id="layout-gap" type="number" min="0" max="96" step="1" required></label>
    <label class="field">内边距（px）<input name="padding" id="layout-padding" type="number" min="0" max="96" step="1" required></label></div>
    <label class="field full">交叉轴对齐<select name="align" id="layout-align"><option value="start">起点</option><option value="center">居中</option><option value="end">终点</option><option value="stretch">拉伸</option></select></label>
    <label class="field full">主轴分布<select name="justify" id="layout-justify"><option value="start">起点</option><option value="center">居中</option><option value="end">终点</option><option value="space-between">两端分布</option></select></label>
    <label class="check-field"><input name="wrap" id="layout-wrap" type="checkbox"> Flex 自动换行</label>
    <p class="inspector-help">自动布局由真实 CSS Flex / Grid 排版，超出内容可滚动；拖动子项可调整顺序。自由布局仍禁止同级重叠。</p>`;
  for (const [key, value] of Object.entries(node.layout!)) {
    const control = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
    if (typeof value === 'boolean') (control as HTMLInputElement).checked = value; else control.value = String(value);
  }
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach(control => { control.disabled = editor.preview; });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', () => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const layout: ContainerLayout = { mode: data.get('mode') as ContainerLayout['mode'], direction: data.get('direction') as ContainerLayout['direction'],
      gap: Number(data.get('gap')), padding: Number(data.get('padding')), columns: Number(data.get('columns')),
      align: data.get('align') as ContainerLayout['align'], justify: data.get('justify') as ContainerLayout['justify'], wrap: data.has('wrap') };
    editor.changeLayout(layout);
  });
  container.append(form);
  const add = document.createElement('div'); add.className = 'container-add';
  const select = document.createElement('select'); select.setAttribute('aria-label', '要放入容器的组件');
  for (const item of components.filter(item => ['basic.button', 'content.card', 'basic.input', 'layout.container'].includes(item.type))) select.append(new Option(item.title, item.type));
  const button = document.createElement('button'); button.type = 'button'; button.textContent = '添加到此容器'; button.disabled = editor.preview;
  button.addEventListener('click', () => select.value === 'layout.container' ? editor.onNewComponent(node.id) : editor.add(select.value, undefined, node.id)); add.append(select, button); container.append(add);
  return container;
}
