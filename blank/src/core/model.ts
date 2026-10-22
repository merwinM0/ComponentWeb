import { registry } from '../components/registry';
import type { Props } from '../components/contract';

export const GRID = { cols: 40, rows: 30, cell: 24 } as const;
export interface Placement {
  id: string;
  type: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  props: Props;
}
export interface Document {
  schemaVersion: 1;
  grid: typeof GRID;
  nodes: Placement[];
}
export const snap = (pixels: number) => Math.round(pixels / GRID.cell);
export const overlaps = (a: Placement, b: Placement) =>
  a.col < b.col + b.colSpan && a.col + a.colSpan > b.col &&
  a.row < b.row + b.rowSpan && a.row + a.rowSpan > b.row;

export function canPlace(node: Placement, nodes: Placement[]): boolean {
  const definition = registry.get(node.type);
  if (!definition || ![node.col, node.row, node.colSpan, node.rowSpan].every(Number.isInteger)) return false;
  return node.col >= 0 && node.row >= 0 &&
    node.colSpan >= definition.min[0] && node.rowSpan >= definition.min[1] &&
    node.col + node.colSpan <= GRID.cols && node.row + node.rowSpan <= GRID.rows &&
    !nodes.some(other => other.id !== node.id && overlaps(node, other));
}

export function createNode(type: string): Placement {
  const definition = registry.get(type);
  if (!definition) throw new Error('未知组件');
  return {
    id: crypto.randomUUID(), type, col: 0, row: 0,
    colSpan: definition.size[0], rowSpan: definition.size[1],
    props: { ...definition.defaults },
  };
}

export function findSpace(node: Placement, nodes: Placement[]): Placement | undefined {
  for (let row = 0; row <= GRID.rows - node.rowSpan; row++) {
    for (let col = 0; col <= GRID.cols - node.colSpan; col++) {
      const candidate = { ...node, col, row };
      if (canPlace(candidate, nodes)) return candidate;
    }
  }
}

export function parseDocument(raw: string): Document {
  const doc = JSON.parse(raw);
  if (doc?.schemaVersion !== 1 || doc.grid?.cols !== GRID.cols || doc.grid?.rows !== GRID.rows || doc.grid?.cell !== GRID.cell || !Array.isArray(doc.nodes) || doc.nodes.length > 300) throw new Error('存档格式不兼容');
  const nodes: Placement[] = [];
  const ids = new Set<string>();
  for (const node of doc.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id) ||
      typeof node.type !== 'string' || !node.props ||
      !['title', 'description', 'accent'].every(key => typeof node.props[key] === 'string' && node.props[key].length <= 2000) ||
      !/^#[0-9a-f]{6}$/i.test(node.props.accent) || !canPlace(node, nodes)) throw new Error('存档中的组件数据无效');
    ids.add(node.id);
    nodes.push({ id: node.id, type: node.type, col: node.col, row: node.row, colSpan: node.colSpan, rowSpan: node.rowSpan,
      props: { title: node.props.title, description: node.props.description, accent: node.props.accent } });
  }
  return { schemaVersion: 1, grid: { ...GRID }, nodes };
}

export function initialDocument(): Document {
  const card = { ...createNode('content.card'), col: 3, row: 3 };
  const metric = { ...createNode('data.metric'), col: 16, row: 3 };
  const button = { ...createNode('basic.button'), col: 16, row: 9 };
  const input = { ...createNode('basic.input'), col: 3, row: 12 };
  return { schemaVersion: 1, grid: { ...GRID }, nodes: [card, metric, button, input] };
}
