import type { Props } from '../components/contract';
import { GRID } from './grid';
export interface ContainerLayout {
  mode: 'free' | 'flex' | 'grid';
  direction: 'row' | 'column';
  gap: number;
  padding: number;
  columns: number;
  align: 'start' | 'center' | 'end' | 'stretch';
  justify: 'start' | 'center' | 'end' | 'space-between';
  wrap: boolean;
}
export const DEFAULT_LAYOUT: ContainerLayout = { mode: 'free', direction: 'row', gap: 12, padding: 12, columns: 2, align: 'start', justify: 'start', wrap: true };
export interface Placement {
  id: string;
  type: string;
  parentId: string | null;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  props: Props;
  layout?: ContainerLayout;
}
export const DEFAULT_APPEARANCE = { background: '#0c1520', grid: '#82c4ed' };
export interface Document {
  schemaVersion: 3;
  grid: typeof GRID;
  appearance: typeof DEFAULT_APPEARANCE;
  nodes: Placement[];
}
export const isContainer = (node: Placement) => node.type === 'layout.container';
