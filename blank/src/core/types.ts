import type { Props } from '../components/contract';
import { GRID } from './grid';
import type { ElementEdit, NativeSurface } from './element-edits';
export interface ContainerLayout {
  mode: 'free' | 'flex' | 'grid';
  direction: 'row' | 'column';
  gap: number;
  padding: number;
  columns: number;
  align: 'start' | 'center' | 'end' | 'stretch';
  justify: 'start' | 'center' | 'end' | 'space-between';
  wrap: boolean;
  overlap: boolean;
}
export const DEFAULT_LAYOUT: ContainerLayout = { mode: 'free', direction: 'row', gap: 12, padding: 12, columns: 2, align: 'start', justify: 'start', wrap: true, overlap: false };
export interface DesignSize { width: number; height: number }
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
  /** 容器内部坐标系（px），与 colSpan / rowSpan 表示的显示尺寸分离。 */
  design?: DesignSize;
  elements?: ElementEdit[];
  surface?: NativeSurface;
}
export const DEFAULT_APPEARANCE = { background: '#0c1520', grid: '#82c4ed' };
export const DOCUMENT_VERSION = 4 as const;
export interface Document {
  schemaVersion: typeof DOCUMENT_VERSION;
  grid: typeof GRID;
  appearance: typeof DEFAULT_APPEARANCE;
  nodes: Placement[];
}
export const isContainer = (node: Placement) => node.type === 'layout.container';
