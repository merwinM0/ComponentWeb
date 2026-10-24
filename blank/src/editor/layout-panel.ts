import { components } from '../components/registry';
import { descendants } from '../core/tree';
import { isContainer, type ContainerLayout } from '../core/types';
import type { Editor } from './editor';
import { designSize } from '../core/design-space';
import { EDIT_SPACE } from '../core/grid';

export function layoutPanel(editor: Editor) {
  const container = document.createElement('div');
  const node = editor.node; if (!node) return container;
  const excluded = descendants(editor.store.doc.nodes, [node.id]);
  const label = document.createElement('label'); label.className = 'field full'; label.textContent = '父容器';
  const parent = document.createElement('select'); parent.id = 'prop-parent'; parent.disabled = editor.preview || node.id === editor.scopeRootId;
  parent.append(new Option(node.id === editor.scopeRootId ? '当前被编辑组件' : editor.scopeRootId ? '当前编辑框内（待组装）' : '工作区（根级）', ''));
  for (const other of editor.store.doc.nodes) if (isContainer(other) && !excluded.has(other.id)) parent.append(new Option(`${other.props.title || '容器'} · ${other.id.slice(0, 5)}`, other.id));
  parent.value = node.parentId ?? ''; parent.addEventListener('change', () => { editor.reparent(parent.value || null); editor.onSelection(); }); label.append(parent); container.append(label);
  if (!isContainer(node)) return container;
  const sizeForm = document.createElement('form'); sizeForm.className = 'layout-form';
  sizeForm.innerHTML = `<div class="section-title">内部设计尺寸 <span>DESIGN SPACE</span></div><div class="field-grid">
    <label class="field">基准宽（px）<input id="layout-design-width" name="width" type="number" min="24" max="${EDIT_SPACE.width}" step="any" required></label>
    <label class="field">基准高（px）<input id="layout-design-height" name="height" type="number" min="24" max="${EDIT_SPACE.height}" step="any" required></label></div>
    <p class="inspector-help">子项坐标、字号、间距以此为基准。外部显示宽高按比例缩放整体，不改写内部布局。</p>`;
  const size = designSize(node);
  for (const key of ['width', 'height'] as const) { const input = sizeForm.elements.namedItem(key) as HTMLInputElement; input.value = String(size[key]); input.disabled = editor.preview; }
  sizeForm.addEventListener('submit', event => event.preventDefault());
  sizeForm.addEventListener('change', event => {
    if (!sizeForm.reportValidity()) return;
    const input = event.target as HTMLInputElement;
    if (!editor.update({ ...node, design: { ...size, [input.name]: Number(input.value) } })) editor.onSelection();
  });
  container.append(sizeForm);
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
    <label class="check-field"><input name="overlap" id="layout-overlap" type="checkbox"> 允许内部标签叠放</label>
    <p class="inspector-help">自动布局由真实 CSS Flex / Grid 排版，超出内容可滚动；拖动子项可调整顺序。组件内部可开启叠放；工作区根组件仍禁止重叠。</p>`;
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
      align: data.get('align') as ContainerLayout['align'], justify: data.get('justify') as ContainerLayout['justify'], wrap: data.has('wrap'), overlap: data.has('overlap') };
    editor.changeLayout(layout);
  });
  container.append(form);
  const add = document.createElement('div'); add.className = 'container-add';
  const select = document.createElement('select'); select.setAttribute('aria-label', '要放入容器的组件');
  for (const item of components.filter(item => ['basic.button', 'content.card', 'basic.input', 'layout.container'].includes(item.type))) select.append(new Option(item.title, item.type));
  const button = document.createElement('button'); button.type = 'button'; button.textContent = '添加到此容器'; button.disabled = editor.preview;
  button.addEventListener('click', () => editor.add(select.value, undefined, node.id)); add.append(select, button); container.append(add);
  return container;
}
