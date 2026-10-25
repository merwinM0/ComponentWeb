import { GRID } from '../core/grid';
import { DEFAULT_CONSTRAINTS } from '../core/item-constraints';
import type { Placement } from '../core/types';

export function itemStyles(node: Placement, parent: Placement | undefined, min: [number, number]) {
  const layout = parent?.layout;
  const auto = !!layout && layout.mode !== 'free';
  const c = node.constraints ?? DEFAULT_CONSTRAINTS;
  const stretchX = auto && layout.align === 'stretch' && layout.mode === 'flex' && layout.direction === 'column';
  const stretchY = auto && layout.align === 'stretch' && (layout.mode === 'grid' || layout.direction === 'row') && c.heightMode !== 'content';
  return {
    position: auto ? 'relative' : 'absolute', left: auto ? 'auto' : `${node.col * GRID.cell}px`, top: auto ? 'auto' : `${node.row * GRID.cell}px`,
    width: layout?.mode === 'grid' ? '100%' : stretchX ? 'auto' : `${node.colSpan * GRID.cell}px`,
    height: stretchY ? 'auto' : `${node.rowSpan * GRID.cell}px`,
    minWidth: auto ? `${min[0] * GRID.cell}px` : '0',
    minHeight: auto ? `${(stretchY ? Math.max(min[1], node.rowSpan) : min[1]) * GRID.cell}px` : '0',
    flex: `${c.flexGrow} ${c.flexShrink} auto`,
    gridColumn: layout?.mode === 'grid' ? `span ${Math.min(c.columnSpan, layout.columns)}` : 'auto',
    gridRow: layout?.mode === 'grid' ? `span ${c.rowSpan}` : 'auto',
    alignSelf: c.heightMode === 'content' ? 'start' : 'auto',
  };
}
