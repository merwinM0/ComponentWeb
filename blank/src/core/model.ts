import { registry } from '../components/registry';
import { colorsOf, COLOR_FIELDS, isColor } from '../components/colors';
import { isValidShape, shapeOf } from '../components/shape';
import { GRID, LEGACY_GRID, FINE_GRID, matchesGrid } from './grid';
import { DEFAULT_APPEARANCE, DEFAULT_LAYOUT, isContainer, type ContainerLayout, type Document, type Placement } from './types';
import { contentSize, placementError, validateTree } from './tree';
import { validDesign } from './design-space';
import { parseElementEdits, parseSurface } from './element-edits';
export { GRID } from './grid';
export { DEFAULT_APPEARANCE, DEFAULT_LAYOUT, isContainer } from './types';
export type { ContainerLayout, Document, Placement } from './types';
export { overlaps } from './tree';
export const snap = (pixels: number) => Math.round(pixels / GRID.cell);
export const canPlace = (node: Placement, nodes: Placement[]) => !placementError(node, nodes);

export function createNode(type: string): Placement {
  const definition = registry.get(type);
  if (!definition) throw new Error('未知组件');
  return {
    id: crypto.randomUUID(), type, parentId: null, col: 0, row: 0,
    colSpan: definition.size[0], rowSpan: definition.size[1],
    props: { source: '', ...definition.defaults, ...colorsOf(definition.defaults), ...shapeOf(definition.defaults) },
    ...(type === 'layout.container' ? { layout: { ...DEFAULT_LAYOUT }, design: { width: definition.size[0] * GRID.cell, height: definition.size[1] * GRID.cell } } : {}),
  };
}
export function findSpace(node: Placement, nodes: Placement[]): Placement | undefined {
  const parent = nodes.find(other => other.id === node.parentId);
  if (parent?.layout?.mode && parent.layout.mode !== 'free') return { ...node, col: 0, row: 0 };
  const size = contentSize(parent);
  // 保留亚网格的组件尺寸，空位仍按当前 12px 步长搜索。
  for (let row = 0; row <= size.rows - node.rowSpan + 1e-6; row++) for (let col = 0; col <= size.cols - node.colSpan + 1e-6; col++) {
    const candidate = { ...node, col, row };
    if (canPlace(candidate, nodes)) return candidate;
  }
}
export function validLayout(value: unknown): value is ContainerLayout {
  if (!value || typeof value !== 'object') return false;
  const v = value as ContainerLayout;
  return ['free', 'flex', 'grid'].includes(v.mode) && ['row', 'column'].includes(v.direction) &&
    [v.gap, v.padding].every(number => Number.isInteger(number) && number >= 0 && number <= 96) &&
    Number.isInteger(v.columns) && v.columns >= 1 && v.columns <= 12 &&
    ['start', 'center', 'end', 'stretch'].includes(v.align) && ['start', 'center', 'end', 'space-between'].includes(v.justify) && typeof v.wrap === 'boolean' && typeof v.overlap === 'boolean';
}
export function parseDocument(raw: string, draft = false): Document {
  const doc = JSON.parse(raw);
  const v1 = doc?.schemaVersion === 1 && matchesGrid(doc.grid, LEGACY_GRID);
  const v2 = doc?.schemaVersion === 2 && matchesGrid(doc.grid, FINE_GRID);
  const current = doc?.schemaVersion === 3 && matchesGrid(doc.grid, GRID);
  if ((!v1 && !v2 && !current) || !Array.isArray(doc.nodes) || doc.nodes.length > 300) throw new Error('存档格式不兼容');
  const scale = (v1 ? LEGACY_GRID.cell : v2 ? FINE_GRID.cell : GRID.cell) / GRID.cell;
  const appearance = { ...DEFAULT_APPEARANCE, ...doc.appearance };
  if ((doc.appearance !== undefined && (!doc.appearance || typeof doc.appearance !== 'object' || Array.isArray(doc.appearance))) || !isColor(appearance.background) || !isColor(appearance.grid)) throw new Error('画布颜色无效');
  const nodes: Placement[] = [];
  for (const source of doc.nodes) {
    if (!source || ![source.col, source.row, source.colSpan, source.rowSpan].every(value => Number.isFinite(value) && Math.abs(value) < 10000 && (current || Number.isInteger(value)))) throw new Error('存档中的网格坐标无效');
    const definition = registry.get(source.type);
    if (!definition || typeof source.id !== 'string' || !source.id || source.id.length > 100 || !source.props ||
      !['title', 'description', 'accent'].every(key => typeof source.props[key] === 'string' && source.props[key].length <= 2000) ||
      !isValidShape(source.props) || COLOR_FIELDS.some(([key]) => source.props[key] !== undefined && !isColor(source.props[key])) ||
      (source.props.source !== undefined && (typeof source.props.source !== 'string' || source.props.source.length > 2000))) throw new Error('存档中的组件数据无效');
    const colors = colorsOf({ ...definition.defaults, ...source.props });
    if (source.type === 'basic.button' && source.props.background === undefined) colors.background = source.props.accent;
    if (source.type === 'basic.button' && source.props.border === undefined) colors.border = source.props.accent;
    const node: Placement = { id: source.id, type: source.type, parentId: current ? source.parentId ?? null : null,
      col: source.col * scale, row: source.row * scale, colSpan: source.colSpan * scale, rowSpan: source.rowSpan * scale,
      props: { title: source.props.title, description: source.props.description, ...colors, ...shapeOf(source.props), source: source.props.source ?? '' } };
    if (node.parentId !== null && (typeof node.parentId !== 'string' || !node.parentId)) throw new Error('父容器 ID 无效');
    if (isContainer(node)) {
      const size = source.design === undefined ? { width: node.colSpan * GRID.cell, height: node.rowSpan * GRID.cell } : source.design;
      if (!validDesign(size)) throw new Error('组件内部设计尺寸无效');
      node.design = { width: size.width, height: size.height };
      if (source.layout !== undefined && (!source.layout || typeof source.layout !== 'object' || Array.isArray(source.layout))) throw new Error('容器布局设置无效');
      const layout = { ...DEFAULT_LAYOUT, ...source.layout };
      if (!validLayout(layout)) throw new Error('容器布局设置无效');
      node.layout = Object.fromEntries(Object.keys(DEFAULT_LAYOUT).map(key => [key, layout[key as keyof ContainerLayout]])) as unknown as ContainerLayout;
    }
    if (!isContainer(node)) {
      if (source.elements !== undefined) node.elements = parseElementEdits(source.elements);
      if (source.surface !== undefined) node.surface = parseSurface(source.surface);
    }
    nodes.push(node);
  }
  const error = validateTree(nodes, draft);
  if (error) throw new Error(error);
  return { schemaVersion: 3, grid: { ...GRID }, appearance: { background: appearance.background, grid: appearance.grid }, nodes };
}
export function initialDocument(): Document {
  const card = { ...createNode('content.card'), col: 72 / GRID.cell, row: 72 / GRID.cell };
  const metric = { ...createNode('data.metric'), col: 384 / GRID.cell, row: 72 / GRID.cell };
  const button = { ...createNode('basic.button'), col: 384 / GRID.cell, row: 216 / GRID.cell };
  const input = { ...createNode('basic.input'), col: 72 / GRID.cell, row: 288 / GRID.cell };
  return { schemaVersion: 3, grid: { ...GRID }, appearance: { ...DEFAULT_APPEARANCE }, nodes: [card, metric, button, input] };
}
