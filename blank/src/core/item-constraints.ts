export interface ItemConstraints {
  flexGrow: number;
  flexShrink: number;
  columnSpan: number;
  rowSpan: number;
  heightMode: 'fixed' | 'content';
}
export const DEFAULT_CONSTRAINTS: ItemConstraints = { flexGrow: 0, flexShrink: 0, columnSpan: 1, rowSpan: 1, heightMode: 'fixed' };
export function parseConstraints(value: unknown): ItemConstraints {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('子项布局约束无效');
  const c = { ...DEFAULT_CONSTRAINTS, ...value } as ItemConstraints;
  if (![c.flexGrow, c.flexShrink].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) ||
      ![c.columnSpan, c.rowSpan].every(v => Number.isInteger(v) && v >= 1 && v <= 12) || !['fixed', 'content'].includes(c.heightMode)) throw new Error('子项伸缩、跨格或高度模式无效');
  return { flexGrow: c.flexGrow, flexShrink: c.flexShrink, columnSpan: c.columnSpan, rowSpan: c.rowSpan, heightMode: c.heightMode };
}
