import { isColor, contrastRatio } from '../components/colors';

interface ColorControlOptions {
  prefix: string;
  fields: [string, string][];
  values: Record<string, string>;
  disabled: boolean;
  preview(values: Record<string, string>): void;
  commit(values: Record<string, string>): void;
}

/** 拾色过程中只预览，change 时记录一次历史，避免每个色值都成为一次撤销。 */
export function colorControls(options: ColorControlOptions) {
  const container = document.createElement('div');
  container.className = 'color-controls';
  const values = { ...options.values };
  const hint = document.createElement('p');
  hint.className = 'contrast-hint';
  const updateHint = () => {
    if (!values.text || !values.background) return;
    const ratio = contrastRatio(values.text, values.background);
    hint.textContent = `文字对比度 ${ratio.toFixed(2)}:1 · ${ratio >= 4.5 ? '达到普通文本 AA 标准' : '偏低，建议调整文字或背景色'}`;
    hint.classList.toggle('low-contrast', ratio < 4.5);
  };
  for (const [key, title] of options.fields) {
    const row = document.createElement('div');
    row.className = 'color-row';
    const label = document.createElement('label');
    label.textContent = title;
    label.htmlFor = `${options.prefix}-${key}`;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = label.htmlFor;
    picker.value = values[key];
    picker.disabled = options.disabled;
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.id = `${options.prefix}-hex-${key}`;
    hex.className = 'hex-input';
    hex.setAttribute('aria-label', `${title}十六进制值`);
    hex.value = values[key].toUpperCase();
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.disabled = options.disabled;
    picker.addEventListener('input', () => {
      values[key] = picker.value;
      hex.value = picker.value.toUpperCase();
      hex.setCustomValidity('');
      updateHint();
      options.preview({ ...values });
    });
    picker.addEventListener('change', () => { values[key] = picker.value; options.commit({ ...values }); });
    hex.addEventListener('input', () => hex.setCustomValidity(''));
    hex.addEventListener('change', () => {
      if (!isColor(hex.value)) {
        hex.setCustomValidity('请输入 # 开头的六位十六进制颜色，如 #8BD5FF');
        hex.reportValidity();
        return;
      }
      values[key] = hex.value.toLowerCase();
      picker.value = values[key];
      updateHint();
      options.commit({ ...values });
    });
    row.append(label, picker, hex);
    container.append(row);
  }
  updateHint();
  if (values.text) container.append(hint);
  return container;
}
