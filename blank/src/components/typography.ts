export interface Typography {
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}
export const TYPOGRAPHY_FIELDS = ['fontSize', 'fontWeight', 'lineHeight', 'textAlign'] as const;
export function parseTypography(value: unknown): Typography {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('排版设置无效');
  const source = value as Typography, result: Typography = {};
  for (const key of ['fontSize', 'fontWeight', 'lineHeight'] as const) {
    const v = source[key];
    if (v === undefined) continue;
    const [min, max] = key === 'fontSize' ? [8, 200] : key === 'fontWeight' ? [100, 900] : [0.8, 3];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (key === 'fontWeight' && v % 100 !== 0)) throw new Error('字号、字重或行高超出范围');
    result[key] = v;
  }
  if (source.textAlign !== undefined) {
    if (!['left', 'center', 'right', 'justify'].includes(source.textAlign)) throw new Error('文字对齐无效');
    result.textAlign = source.textAlign;
  }
  return result;
}
/** No rules for unset fields: preserve each catalogue component's original hierarchy. Inline tag edits win. */
export function typographyCSS(value: Typography = {}) {
  const t = parseTypography(value);
  const rules = [t.fontSize === undefined ? '' : `font-size:${t.fontSize}px`, t.fontWeight === undefined ? '' : `font-weight:${t.fontWeight}`,
    t.lineHeight === undefined ? '' : `line-height:${t.lineHeight}`, t.textAlign === undefined ? '' : `text-align:${t.textAlign}`].filter(Boolean).join(';');
  return rules ? `:host,:host *{${rules}}` : '';
}
export function applyTypography(host: HTMLElement, value?: Typography) {
  const root = host.shadowRoot!;
  let style = root.querySelector<HTMLStyleElement>('style[data-typography]');
  if (!style) { style = document.createElement('style'); style.dataset.typography = ''; root.append(style); }
  style.textContent = typographyCSS(value);
}
