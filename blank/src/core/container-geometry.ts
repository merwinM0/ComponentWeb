import { skinDefinition } from '../components/container/skins';
import { designSize } from './design-space';
import type { Placement } from './types';

export interface ContentRect { x: number; y: number; width: number; height: number }
/** Shared design-coordinate geometry for DOM, free-layout validation, assembly and drop regions. */
export function containerGeometry(node: Placement) {
  const size = designSize(node);
  const skin = skinDefinition(node.skin);
  const insets = skin?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const border = node.props.borderStyle === 'none' ? 0 : node.props.borderWidth ?? 1;
  const padding = node.layout?.padding ?? 12;
  const safe: ContentRect = { x: insets.left + border, y: insets.top + border,
    width: size.width - insets.left - insets.right - border * 2, height: size.height - insets.top - insets.bottom - border * 2 };
  const content: ContentRect = { x: safe.x + padding, y: safe.y + padding, width: safe.width - padding * 2, height: safe.height - padding * 2 };
  return { size, safe, content, border, skin };
}
export function containerGeometryError(node: Placement): string | null {
  const { size, skin, content } = containerGeometry(node);
  if (skin && (size.width < skin.min[0] || size.height < skin.min[1])) return `${skin.title}内部设计尺寸至少为 ${skin.min[0]}×${skin.min[1]}px`;
  return content.width < 1 || content.height < 1 ? '容器尺寸不足以容纳背景安全区、边框和内边距' : null;
}
