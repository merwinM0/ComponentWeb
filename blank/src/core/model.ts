import { parseTypography } from '../components/typography';
import { parseConstraints } from './item-constraints';
import { registry } from '../components/registry';
import { colorsOf, COLOR_FIELDS, isColor } from '../components/colors';
import { isValidShape, shapeOf } from '../components/shape';
import { GRID, LEGACY_GRID, FINE_GRID, CLASSIC_GRID, LARGE_GRID, matchesGrid, type CanvasGrid } from './grid';
import { DOCUMENT_VERSION, DEFAULT_APPEARANCE, DEFAULT_LAYOUT, isContainer, type ContainerLayout, type Document, type Placement } from './types';
import { contentSize, placementError, validateTree } from './tree';
import { validDesign } from './design-space';
import { parseElementEdits, parseSurface } from './element-edits';
export { GRID } from './grid';
export { DEFAULT_APPEARANCE, DEFAULT_LAYOUT, isContainer } from './types';
export type { ContainerLayout, Document, Placement } from './types';
export { overlaps } from './tree';
export const snap = (pixels: number) => Math.round(pixels / GRID.cell);
export const canPlace = (node: Placement, nodes: Placement[], grid: CanvasGrid = GRID) => !placementError(node, nodes, false, grid);

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
export function findSpace(node: Placement, nodes: Placement[], grid: CanvasGrid = GRID): Placement | undefined {
  const parent = nodes.find(other => other.id === node.parentId);
  if (parent?.layout?.mode && parent.layout.mode !== 'free') return { ...node, col: 0, row: 0 };
  const size = contentSize(parent, grid);
  // 保留亚网格的组件尺寸，空位仍按当前 12px 步长搜索。
  for (let row = 0; row <= size.rows - node.rowSpan + 1e-6; row++) for (let col = 0; col <= size.cols - node.colSpan + 1e-6; col++) {
    const candidate = { ...node, col, row };
    if (canPlace(candidate, nodes, grid)) return candidate;
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
  const v3 = doc?.schemaVersion === 3 && matchesGrid(doc.grid, CLASSIC_GRID);
  const v4 = doc?.schemaVersion === 4 && matchesGrid(doc.grid, LARGE_GRID);
  const current = doc?.schemaVersion === DOCUMENT_VERSION && (matchesGrid(doc.grid, GRID) || matchesGrid(doc.grid, LARGE_GRID)), structured = v3 || v4 || current;
  if ((!v1 && !v2 && !v3 && !v4 && !current) || !Array.isArray(doc.nodes) || doc.nodes.length > 300) throw new Error('存档格式不兼容');
  const scale = (v1 ? LEGACY_GRID.cell : v2 ? FINE_GRID.cell : GRID.cell) / GRID.cell;
  const appearance = { ...DEFAULT_APPEARANCE, ...doc.appearance };
  if ((doc.appearance !== undefined && (!doc.appearance || typeof doc.appearance !== 'object' || Array.isArray(doc.appearance))) || !isColor(appearance.background) || !isColor(appearance.grid)) throw new Error('画布颜色无效');
  const nodes: Placement[] = [];
  for (const source of doc.nodes) {
    if (!source || ![source.col, source.row, source.colSpan, source.rowSpan].every(value => Number.isFinite(value) && Math.abs(value) < 10000 && (structured || Number.isInteger(value)))) throw new Error('存档中的网格坐标无效');
    const definition = registry.get(source.type);
    if (!definition || typeof source.id !== 'string' || !source.id || source.id.length > 100 || !source.props ||
      !['title', 'description', 'accent'].every(key => typeof source.props[key] === 'string' && source.props[key].length <= 2000) ||
      !isValidShape(source.props) || COLOR_FIELDS.some(([key]) => source.props[key] !== undefined && !isColor(source.props[key])) ||
      (source.props.source !== undefined && (typeof source.props.source !== 'string' || source.props.source.length > (source.type.startsWith('imported.') ? 50000 : 2000)))) throw new Error('存档中的组件数据无效');
    const colors = colorsOf({ ...definition.defaults, ...source.props });
    if (source.type === 'basic.button' && source.props.background === undefined) colors.background = source.props.accent;
    if (source.type === 'basic.button' && source.props.border === undefined) colors.border = source.props.accent;
    const node: Placement = { id: source.id, type: source.type, parentId: structured ? source.parentId ?? null : null,
      col: source.col * scale, row: source.row * scale, colSpan: source.colSpan * scale, rowSpan: source.rowSpan * scale,
      props: { title: source.props.title, description: source.props.description, ...colors, ...shapeOf(source.props), source: source.props.source ?? '' } };
    if (source.props.typography !== undefined) node.props.typography = parseTypography(source.props.typography);
    if (source.constraints !== undefined) node.constraints = parseConstraints(source.constraints);
    if (node.constraints?.heightMode === 'content' && (isContainer(node) || node.type.startsWith('imported.'))) throw new Error('内容自适应高度仅适用于原生非容器组件');
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
  const sourceGrid: CanvasGrid = current ? doc.grid : v4 ? LARGE_GRID : CLASSIC_GRID;
  const error = validateTree(nodes, draft, sourceGrid);
  if (error) throw new Error(error);
  // 普通旧布局直接恢复 16:9；已有远处内容的 v4 布局保留原范围，绝不裁剪或缩放节点。
  const needsLarge = nodes.some(node => !node.parentId && (node.col + node.colSpan > GRID.cols + 1e-6 || node.row + node.rowSpan > GRID.rows + 1e-6));
  const grid: CanvasGrid = current ? doc.grid : v4 && needsLarge ? LARGE_GRID : GRID;
  return { schemaVersion: DOCUMENT_VERSION, grid: { ...grid }, appearance: { background: appearance.background, grid: appearance.grid }, nodes };
}
export function initialDocument(): Document {
  const card = { ...createNode('content.card'), col: 72 / GRID.cell, row: 72 / GRID.cell };
  const metric = { ...createNode('data.metric'), col: 384 / GRID.cell, row: 72 / GRID.cell };
  const button = { ...createNode('basic.button'), col: 384 / GRID.cell, row: 216 / GRID.cell };
  const input = { ...createNode('basic.input'), col: 72 / GRID.cell, row: 288 / GRID.cell };
  return { schemaVersion: DOCUMENT_VERSION, grid: { ...GRID }, appearance: { ...DEFAULT_APPEARANCE }, nodes: [card, metric, button, input] };
}
