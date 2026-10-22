export const DEFAULT_COLORS = {
  accent: '#8bd5ff', background: '#121e2b', text: '#edf6ff', border: '#34495c',
};
export type ColorKey = keyof typeof DEFAULT_COLORS;
export const COLOR_FIELDS: [ColorKey, string][] = [
  ['background', '背景色'], ['text', '文字色'], ['border', '边框色'], ['accent', '强调色'],
];
export const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function colorsOf(props: Partial<Record<ColorKey, string>>) {
  return { ...DEFAULT_COLORS, ...Object.fromEntries(COLOR_FIELDS.map(([key]) => [key, props[key] ?? DEFAULT_COLORS[key]])) } as typeof DEFAULT_COLORS;
}
export const palettes = [
  { name: '冰川蓝', background: '#121e2b', text: '#edf6ff', border: '#34495c', accent: '#8bd5ff' },
  { name: '薄荷绿', background: '#102822', text: '#e4fff5', border: '#3c6558', accent: '#8be0bd' },
  { name: '暖砂橙', background: '#2b2019', text: '#fff2e5', border: '#70513a', accent: '#ffc38b' },
  { name: '浅色纸', background: '#f4f7fb', text: '#172b42', border: '#a7bbcf', accent: '#176da6' },
];
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(offset => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
