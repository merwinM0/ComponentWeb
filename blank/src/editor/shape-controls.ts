import { BORDER_STYLES, DEFAULT_SHAPE, isValidShape, SHAPE_LIMITS, type BorderStyle, type ShapeSettings } from '../components/shape';

const styleLabels: Record<BorderStyle, string> = { solid: '实线', dashed: '虚线', dotted: '点线', none: '无边框' };

export function shapeControls(values: ShapeSettings, disabled: boolean, commit: (shape: ShapeSettings) => void) {
  const form = document.createElement('form');
  form.className = 'shape-controls';
  form.innerHTML = `
    <div class="field-grid shape-fields">
      <label class="field">圆角半径（px）<input id="prop-radius" name="radius" type="number" min="0" max="${SHAPE_LIMITS.radius}" step="1" required></label>
      <label class="field">边框粗细（px）<input id="prop-borderWidth" name="borderWidth" type="number" min="0" max="${SHAPE_LIMITS.borderWidth}" step="1" required></label>
    </div>
    <label class="field full">边框样式<select id="prop-borderStyle" name="borderStyle"></select></label>
    <div class="radius-presets" role="group" aria-label="圆角预设"></div>
    <p class="inspector-help">0 px 为直角；边框设为 0 px 或「无边框」即可隐藏。设置不改变网格占位。</p>
    <button type="button" class="reset-colors" id="reset-shape">↶ 恢复直角与默认边框</button>`;
  const radius = form.querySelector<HTMLInputElement>('#prop-radius')!;
  const width = form.querySelector<HTMLInputElement>('#prop-borderWidth')!;
  const style = form.querySelector<HTMLSelectElement>('#prop-borderStyle')!;
  radius.value = String(values.radius);
  width.value = String(values.borderWidth);
  for (const value of BORDER_STYLES) style.append(new Option(styleLabels[value], value));
  style.value = values.borderStyle;
  for (const value of [0, 4, 8, 16, 24]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value === 0 ? '直角' : `${value}`;
    button.setAttribute('aria-label', `圆角预设 ${value} px`);
    button.setAttribute('aria-pressed', String(values.radius === value));
    button.addEventListener('click', () => {
      radius.value = String(value);
      if (form.reportValidity()) commit({ radius: value, borderWidth: Number(width.value), borderStyle: style.value as BorderStyle });
    });
    form.querySelector('.radius-presets')!.append(button);
  }
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(control => { control.disabled = disabled; });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', () => {
    if (!form.reportValidity()) return;
    const next = { radius: Number(radius.value), borderWidth: Number(width.value), borderStyle: style.value as BorderStyle };
    if (isValidShape(next)) commit(next);
  });
  form.querySelector('#reset-shape')!.addEventListener('click', () => commit({ ...DEFAULT_SHAPE }));
  return form;
}
