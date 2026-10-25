import { TYPOGRAPHY_FIELDS, type Typography } from '../components/typography';
import type { Editor } from './editor';

export function typographyPanel(editor: Editor) {
  const panel = document.createElement('form'); panel.className = 'typography-panel';
  panel.innerHTML = `<div class="section-title">文字排版 <span>TYPOGRAPHY</span></div><div class="field-grid">
    <label class="field">字号（px）<input id="type-fontSize" name="fontSize" type="number" min="8" max="200" step="any" placeholder="组件默认"></label>
    <label class="field">字重<select id="type-fontWeight" name="fontWeight"><option value="">组件默认</option>${[100,200,300,400,500,600,700,800,900].map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
    <label class="field">行高（倍数）<input id="type-lineHeight" name="lineHeight" type="number" min="0.8" max="3" step="any" placeholder="组件默认"></label>
    <label class="field">文字对齐<select id="type-textAlign" name="textAlign"><option value="">组件默认</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option><option value="justify">两端对齐</option></select></label></div>
    <p class="inspector-help">${editor.selection.length > 1 ? '空白表示默认或多种值；只将修改的字段统一应用到所选组件，一次撤销。' : '留空使用组件默认。字号和间距使用内部设计像素，整体缩放不改写设置。'}原位标签单独设置的字号优先。</p><button type="button" class="reset-colors">↶ 恢复默认排版</button>`;
  const nodes = editor.selection;
  for (const key of TYPOGRAPHY_FIELDS) {
    const control = panel.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
    const values = nodes.map(node => node.props.typography?.[key]);
    const common = values.every(v => v === values[0]);
    control.value = common && values[0] !== undefined ? String(values[0]) : '';
    if (!common) {
      if (control instanceof HTMLInputElement) control.placeholder = '多种值';
      else control.options[0].text = '多种值';
    }
    control.disabled = editor.preview;
  }
  panel.addEventListener('submit', event => event.preventDefault());
  panel.addEventListener('change', event => {
    if (!panel.reportValidity()) return;
    const input = event.target as HTMLInputElement;
    const patch: Typography = { [input.name]: input.value === '' ? undefined : input.name === 'textAlign' ? input.value : Number(input.value) };
    if (!editor.changeTypography(patch)) editor.onSelection();
  });
  const reset = panel.querySelector('button')!; reset.disabled = editor.preview;
  reset.addEventListener('click', () => { if (!editor.changeTypography(null)) editor.onSelection(); });
  return panel;
}
