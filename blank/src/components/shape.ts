export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'none'] as const;
export type BorderStyle = typeof BORDER_STYLES[number];
export interface ShapeSettings {
  radius: number;
  borderWidth: number;
  borderStyle: BorderStyle;
}
export const DEFAULT_SHAPE: ShapeSettings = { radius: 0, borderWidth: 1, borderStyle: 'solid' };
export const SHAPE_LIMITS = { radius: 120, borderWidth: 12 };

export function shapeOf(props: Partial<ShapeSettings>): ShapeSettings {
  return {
    radius: props.radius ?? DEFAULT_SHAPE.radius,
    borderWidth: props.borderWidth ?? DEFAULT_SHAPE.borderWidth,
    borderStyle: props.borderStyle ?? DEFAULT_SHAPE.borderStyle,
  };
}

/** 允许旧存档缺省字段，但不把 null、字符串或越界数据当作默认值。 */
export function isValidShape(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const props = value as Record<string, unknown>;
  for (const key of ['radius', 'borderWidth'] as const) {
    const current = props[key];
    if (current !== undefined && (typeof current !== 'number' || !Number.isInteger(current) || current < 0 || current > SHAPE_LIMITS[key])) return false;
  }
  return props.borderStyle === undefined || BORDER_STYLES.includes(props.borderStyle as BorderStyle);
}
