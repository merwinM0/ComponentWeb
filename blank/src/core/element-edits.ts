import { isColor } from '../components/colors';
import { EDIT_SPACE, GRID } from './grid';
import type { Placement } from './types';

export interface ElementStyle { x?: number; y?: number; width?: number; height?: number; fontSize?: number; color?: string; background?: string }
export interface ElementEdit { path: number[]; tag: string; text?: string; hidden?: boolean; style?: ElementStyle }
export interface NativeSurface { baseWidth: number; baseHeight: number; x: number; y: number; width: number; height: number }
export const pathKey = (path: number[]) => path.join('.');
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function parseElementEdits(value: unknown): ElementEdit[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('标签编辑数据无效');
  const seen = new Set<string>();
  return value.map(item => {
    if (!object(item) || !Array.isArray(item.path) || !item.path.length || item.path.length > 16 || !item.path.every(index => Number.isInteger(index) && index >= 0 && index < 300) || typeof item.tag !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(item.tag) || ['script', 'style', 'link', 'iframe'].includes(item.tag)) throw new Error('标签路径无效');
    const key = pathKey(item.path); if (seen.has(key)) throw new Error('标签路径重复'); seen.add(key);
    const result: ElementEdit = { path: [...item.path], tag: item.tag };
    if (item.text !== undefined) { if (typeof item.text !== 'string' || item.text.length > 2000) throw new Error('标签文本无效'); result.text = item.text; }
    if (item.hidden !== undefined) { if (typeof item.hidden !== 'boolean') throw new Error('标签显示设置无效'); result.hidden = item.hidden; }
    if (item.style !== undefined) {
      if (!object(item.style)) throw new Error('标签样式无效'); const style: ElementStyle = {};
      for (const key of ['x', 'y', 'width', 'height', 'fontSize'] as const) if (item.style[key] !== undefined) {
        const limit = key === 'height' || key === 'y' ? EDIT_SPACE.height : EDIT_SPACE.width;
        const min = key === 'x' || key === 'y' ? -limit : key === 'fontSize' ? 8 : 1;
        const max = key === 'fontSize' ? 200 : limit;
        if (!number(item.style[key], min, max)) throw new Error('标签尺寸或位置无效'); style[key] = item.style[key];
      }
      for (const key of ['color', 'background'] as const) if (item.style[key] !== undefined) { if (!isColor(item.style[key])) throw new Error('标签颜色无效'); style[key] = item.style[key]; }
      result.style = style;
    }
    return result;
  });
}
export function parseSurface(value: unknown): NativeSurface {
  if (!object(value) || !['baseWidth', 'baseHeight', 'width', 'height'].every(key => number(value[key], 1, key.toLowerCase().includes('height') ? EDIT_SPACE.height : EDIT_SPACE.width)) || !number(value.x, -EDIT_SPACE.width, EDIT_SPACE.width) || !number(value.y, -EDIT_SPACE.height, EDIT_SPACE.height)) throw new Error('标签缩放基准无效');
  return { baseWidth: value.baseWidth, baseHeight: value.baseHeight, x: value.x, y: value.y, width: value.width, height: value.height };
}
export const nativeSurface = (node: Placement): NativeSurface => node.surface ?? { baseWidth: node.colSpan * GRID.cell, baseHeight: node.rowSpan * GRID.cell, x: 0, y: 0, width: node.colSpan * GRID.cell, height: node.rowSpan * GRID.cell };
