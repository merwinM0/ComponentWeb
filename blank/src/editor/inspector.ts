import { registry } from '../components/registry';
import { colorsOf, COLOR_FIELDS, palettes } from '../components/colors';
import { DEFAULT_APPEARANCE, GRID } from '../core/model';
import { $, Editor } from './editor';
import { colorControls } from './color-controls';
import { shapeControls } from './shape-controls';
import { shapeOf } from '../components/shape';
import { contentSize } from '../core/tree';
import { layoutPanel } from './layout-panel';
import { layerPanel } from './layers';
import { renderMulti } from './selection-actions';
import { isContainer } from '../core/types';
import { CANVAS, EDIT_SPACE } from '../core/grid';
import { workingSize } from '../core/assembly';
import { elementPanel } from './element-panel';

function section(title: string, english: string) {
  const heading = document.createElement('div');
  heading.className = 'section-title';
  heading.innerHTML = `${title}<span>${english}</span>`;
  return heading;
}

export function setupInspector(editor: Editor) {
  function render() {
    const container = $('inspector-content');
    const node = editor.node;
    const focused = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const restoreId = focused && container.contains(focused) ? focused.id : '';
    const selection = focused instanceof HTMLTextAreaElement || (focused instanceof HTMLInputElement && focused.type === 'text')
      ? [focused.selectionStart, focused.selectionEnd] : null;
    if (editor.selectedIds.size > 1) {
      renderMulti(container, editor);
    } else if (!node) {
      container.innerHTML = '<div class="no-selection"><span aria-hidden="true">⌖</span><h2>每一格，都有可能</h2><p>选择组件调整内容与配色<br>也可以先为画布换个颜色</p></div>';
    } else {
      const definition = registry.get(node.type)!;
      const parent = editor.store.doc.nodes.find(other => other.id === node.parentId);
      const automatic = !!parent?.layout && parent.layout.mode !== 'free';
      const area = editor.scopeRootId && !parent ? { cols: EDIT_SPACE.width / GRID.cell, rows: EDIT_SPACE.height / GRID.cell } : contentSize(parent);
      const working = node.id === editor.scopeRootId ? workingSize(node) : { width: node.colSpan * GRID.cell, height: node.rowSpan * GRID.cell };
      container.innerHTML = `
        <div class="inspector-identity"><span class="identity-icon" aria-hidden="true">${definition.icon}</span><div><strong>${definition.title}</strong><small></small></div></div>
        <form id="properties">
          <div class="section-title">布局 <span>LAYOUT</span></div>
          <div class="field-grid">
            <label class="field">位置 X（px）<input id="prop-col" name="col" type="number" min="0" max="${area.cols * GRID.cell - working.width}" step="any" required></label>
            <label class="field">位置 Y（px）<input id="prop-row" name="row" type="number" min="0" max="${area.rows * GRID.cell - working.height}" step="any" required></label>
            <label class="field">${isContainer(node) ? '显示宽 W' : '宽度 W'}（px）<input id="prop-colSpan" name="colSpan" type="number" min="${definition.min[0] * GRID.cell}" max="${node.id === editor.scopeRootId ? CANVAS.width : (automatic ? GRID.cols : area.cols - node.col) * GRID.cell}" step="any" required></label>
            <label class="field">${isContainer(node) ? '显示高 H' : '高度 H'}（px）<input id="prop-rowSpan" name="rowSpan" type="number" min="${definition.min[1] * GRID.cell}" max="${node.id === editor.scopeRootId ? CANVAS.height : (automatic ? GRID.rows : area.rows - node.row) * GRID.cell}" step="any" required></label>
          </div>
          <p class="inspector-help">拖动按 ${GRID.cell}px 吸附；输入框单位为像素。${automatic ? `<br>位置由父容器自动排版；输入为请求尺寸，Grid 宽度由列控制。实际 ${Math.round(editor.logicalRect(node.id).colSpan * GRID.cell)} × ${Math.round(editor.logicalRect(node.id).rowSpan * GRID.cell)} px。` : ''}${isContainer(node) ? '<br>显示宽高仅缩放整体；内部设计尺寸可在下方设置。' : parent ? '<br>子项尺寸与坐标使用父容器的内部设计网格。' : ''}${node.id === editor.scopeRootId ? '<br>当前对象按内部尺寸原位编辑；移动仅用于编排，完成后回原位置并按显示宽高自动缩放。' : ''}<br>最小 ${definition.min[0] * GRID.cell} × ${definition.min[1] * GRID.cell} px</p>
          <div class="section-title">组件内容 <span>CONTENT</span></div>
          <label class="field full">标题 / 文本<input id="prop-title" name="title" type="text" maxlength="120"></label>
          <label class="field full">${definition.contentLabel ?? (node.type === 'data.metric' ? '指标数值' : '说明文字')}<textarea id="prop-description" name="description" maxlength="1000"></textarea></label>
          ${definition.sourceLabel ? `<label class="field full">${definition.sourceLabel}<input id="prop-source" name="source" type="text" maxlength="2000" placeholder="https://…"></label><p class="inspector-help">仅允许安全协议；外部媒体由浏览器请求，请使用可信地址。</p>` : ''}
        </form>`;
      container.querySelector('.inspector-identity small')!.textContent = `${definition.tags?.map(tag => `<${tag}>`).join(' ') ?? node.type} · ${node.id.slice(0, 6)}`;
      const form = $<HTMLFormElement>('properties');
      for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) $<HTMLInputElement>(`prop-${key}`).value = String(Math.round(node[key] * GRID.cell * 1000000) / 1000000);
      for (const key of ['title', 'description', 'source'] as const) {
        const input = document.getElementById(`prop-${key}`) as HTMLInputElement | null;
        if (input) input.value = node.props[key] ?? '';
      }
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(control => { control.disabled = editor.preview; });
      if (automatic) { $<HTMLInputElement>('prop-col').disabled = true; $<HTMLInputElement>('prop-row').disabled = true; }
      if (parent?.layout?.mode === 'grid') $<HTMLInputElement>('prop-colSpan').disabled = true;
      form.addEventListener('submit', event => event.preventDefault());
      form.addEventListener('change', event => {
        if (!form.reportValidity()) return;
        const control = event.target as HTMLInputElement;
        const updated = { ...node, props: { ...node.props } };
        if (['col', 'row', 'colSpan', 'rowSpan'].includes(control.name)) updated[control.name as 'col' | 'row' | 'colSpan' | 'rowSpan'] = Number(control.value) / GRID.cell;
        else updated.props[control.name as 'title' | 'description' | 'source'] = control.value;
        if (!editor.update(updated)) render();
      });
      if (node.id !== editor.scopeRootId) {
        const design = document.createElement('button'); design.type = 'button'; design.className = 'edit-design-button'; design.textContent = '编辑组件（原位）'; design.disabled = editor.preview;
        design.addEventListener('click', () => editor.onEditComponent(node.id)); container.append(design);
      }
      if (editor.scopeRootId && !isContainer(node)) container.append(elementPanel(editor, node));
      container.append(layoutPanel(editor));
      container.append(section('圆角与边框', 'SHAPE'));
      container.append(shapeControls(shapeOf(node.props), editor.preview,
        values => editor.update({ ...node, props: { ...node.props, ...values } })));
      container.append(section('组件配色', 'COLORS'));
      const applyColors = (values: Record<string, string>) => editor.update({ ...node, props: { ...node.props, ...values } });
      container.append(colorControls({ prefix: 'prop', fields: COLOR_FIELDS, values: colorsOf(node.props), disabled: editor.preview,
        preview: values => editor.previewColors(node.id, { ...node.props, ...values }), commit: applyColors }));
      const presets = document.createElement('div');
      presets.className = 'palette-presets';
      for (const palette of palettes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.title = palette.name;
        button.setAttribute('aria-label', `应用${palette.name}配色`);
        button.style.setProperty('--palette-bg', palette.background);
        button.style.setProperty('--palette-text', palette.text);
        button.style.setProperty('--palette-accent', palette.accent);
        button.innerHTML = '<span aria-hidden="true">Aa <i></i></span>';
        button.disabled = editor.preview;
        button.addEventListener('click', () => { const { name, ...colors } = palette; applyColors(colors); });
        presets.append(button);
      }
      container.append(presets);
      const reset = document.createElement('button');
      reset.type = 'button'; reset.className = 'reset-colors'; reset.textContent = '↶ 恢复组件默认配色'; reset.disabled = editor.preview;
      reset.addEventListener('click', () => applyColors(colorsOf(definition.defaults)));
      container.append(reset);
      const actions = document.createElement('div');
      actions.className = 'inspector-actions';
      actions.innerHTML = '<button id="duplicate" type="button">⧉ 复制</button><button id="delete" type="button" class="danger">⌫ 删除</button>';
      container.append(actions);
      actions.querySelectorAll('button').forEach(button => { button.disabled = editor.preview; });
      $('duplicate').addEventListener('click', () => editor.duplicate());
      $('delete').addEventListener('click', () => editor.remove());
    }
    container.append(layerPanel(editor));
    container.append(section(editor.scopeRootId ? '工作区网格' : '画布配色', 'CANVAS'));
    container.append(colorControls({ prefix: 'canvas', fields: editor.scopeRootId ? [['grid', '工作区网格线色']] : [['background', '画布背景'], ['grid', '网格线色']],
      values: editor.store.doc.appearance, disabled: editor.preview,
      preview: values => editor.applyAppearance(values as typeof DEFAULT_APPEARANCE),
      commit: values => editor.store.commit({ ...editor.store.doc, appearance: values as typeof DEFAULT_APPEARANCE }),
    }));
    const resetCanvas = document.createElement('button');
    resetCanvas.className = 'reset-colors'; resetCanvas.textContent = editor.scopeRootId ? '↶ 恢复工作区网格默认线色' : '↶ 恢复画布默认配色'; resetCanvas.disabled = editor.preview;
    resetCanvas.addEventListener('click', () => editor.store.commit({ ...editor.store.doc, appearance: editor.scopeRootId ? { ...editor.store.doc.appearance, grid: DEFAULT_APPEARANCE.grid } : { ...DEFAULT_APPEARANCE } }));
    container.append(resetCanvas);
    if (restoreId) {
      const control = document.getElementById(restoreId) as HTMLInputElement | HTMLTextAreaElement | null;
      control?.focus({ preventScroll: true });
      if (selection && selection[0] !== null) control?.setSelectionRange(selection[0], selection[1]);
    }
  }
  editor.onSelection = render;
  render();
  return render;
}
