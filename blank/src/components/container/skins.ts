export const CONTAINER_SKINS = [
  { id: 'paper', title: '折页纸张', description: '奶油纸面与杏色折页，适合笔记、说明和内容卡片。', min: [192, 144],
    insets: { top: 36, right: 36, bottom: 18, left: 18 },
    palette: { background: '#fff8e9', text: '#493626', border: '#c99d67', accent: '#b45d31' } },
  { id: 'ticket', title: '镂空票券', description: '珊瑚票面、双侧镂空和右侧票根，适合活动、优惠和摘要。', min: [216, 120],
    insets: { top: 20, right: 52, bottom: 20, left: 28 },
    palette: { background: '#fff0e9', text: '#5e2b27', border: '#d88a74', accent: '#c44730' } },
  { id: 'bubble', title: '对话气泡', description: '鼠尾草绿圆润面板与底部尾角，适合提示、问答和留言。', min: [192, 144],
    insets: { top: 20, right: 20, bottom: 44, left: 20 },
    palette: { background: '#e9f5ef', text: '#214c3c', border: '#79aa91', accent: '#2a7a59' } },
] as const;
export type ContainerSkinId = typeof CONTAINER_SKINS[number]['id'];
export function skinDefinition(id?: string) { return CONTAINER_SKINS.find(skin => skin.id === id); }

/** Only trusted parameterized paths. No uploaded SVG or user markup is interpolated. */
export function skinSvg(id: ContainerSkinId, width: number, height: number, borderWidth = 1): string {
  if (![width, height].every(v => Number.isFinite(v) && v >= 24 && v <= 3840)) throw new Error('SVG 背景尺寸无效');
  const s = skinDefinition(id);
  if (!s || width < s.min[0] || height < s.min[1]) throw new Error('SVG 背景小于款式最小设计尺寸');
  if (!Number.isFinite(borderWidth) || borderWidth < 0 || borderWidth > 12) throw new Error('SVG 边框粗细无效');
  const inset = Math.max(0, (borderWidth - 1) / 2);
  const w = width - inset * 2, h = height - inset * 2;
  let path: string, detail: string;
  if (id === 'paper') {
    path = `M1 1H${w - 33}L${w - 1} 33V${h - 1}H1Z`;
    detail = `<path d="M${w - 33} 1V33H${w - 1}" fill="var(--accent,${s.palette.accent})" fill-opacity=".12" stroke="var(--border,${s.palette.border})"/><path d="M18 18H54" stroke="var(--accent,${s.palette.accent})" stroke-width="3"/>`;
  } else if (id === 'ticket') {
    const y = h / 2, r = 14;
    path = `M12 1H${w - 12}Q${w - 1} 1 ${w - 1} 12V${y - r}C${w - 20} ${y - r} ${w - 20} ${y + r} ${w - 1} ${y + r}V${h - 12}Q${w - 1} ${h - 1} ${w - 12} ${h - 1}H12Q1 ${h - 1} 1 ${h - 12}V${y + r}C20 ${y + r} 20 ${y - r} 1 ${y - r}V12Q1 1 12 1Z`;
    detail = `<path d="M${w - 36} 16V${h - 16}" stroke="var(--border,${s.palette.border})" stroke-dasharray="3 5"/><path d="M${w - 24} 28V52M${w - 20} 28V52M${w - 16} 28V52" stroke="var(--accent,${s.palette.accent})"/>`;
  } else {
    const b = h - 25;
    path = `M25 1H${w - 25}Q${w - 1} 1 ${w - 1} 25V${b - 24}Q${w - 1} ${b} ${w - 25} ${b}H76L43 ${h - 1}L49 ${b}H25Q1 ${b} 1 ${b - 24}V25Q1 1 25 1Z`;
    detail = `<path d="M25 13H49" stroke="var(--accent,${s.palette.accent})" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="skin-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g transform="translate(${inset} ${inset})"><path class="skin-silhouette" d="${path}" fill="var(--surface,${s.palette.background})" stroke="var(--border,${s.palette.border})" stroke-width="var(--skin-stroke,${borderWidth})" stroke-dasharray="var(--skin-dash,none)"/>${detail}</g></svg>`;
}
