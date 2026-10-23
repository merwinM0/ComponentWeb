import { canPlace, createNode, GRID, snap, type Placement } from '../core/model';
import { registry } from '../components/registry';
import { Editor, toast } from './editor';

interface Gesture {
  pointer: number;
  kind: 'add' | 'move' | 'resize';
  initial: Placement;
  candidate: Placement;
  x: number;
  y: number;
  active: boolean;
  inside: boolean;
  valid: boolean;
  element: HTMLElement;
}

export function setupGestures(editor: Editor) {
  let gesture: Gesture | undefined;
  const point = (event: PointerEvent) => {
    const rect = editor.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / editor.zoom, y: (event.clientY - rect.top) / editor.zoom };
  };
  document.addEventListener('pointerdown', event => {
    if (editor.preview || event.button !== 0 || gesture) return;
    const target = event.target as HTMLElement;
    if (target.closest('.component-tile button')) return;
    const tile = target.closest<HTMLElement>('.component-tile');
    const element = target.closest<HTMLElement>('.node');
    if (!tile && !element) return;
    const node = tile ? createNode(tile.dataset.type!) : editor.store.doc.nodes.find(node => node.id === element!.dataset.id)!;
    const position = point(event);
    if (!tile) editor.select(node.id);
    gesture = {
      pointer: event.pointerId,
      kind: tile ? 'add' : target.closest('.resize-handle') ? 'resize' : 'move',
      initial: structuredClone(node), candidate: structuredClone(node),
      x: position.x, y: position.y, active: false, inside: false, valid: false,
      element: tile ?? element!,
    };
    gesture.element.setPointerCapture(event.pointerId);
    if (!target.closest('button')) event.preventDefault();
  });

  document.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const p = point(event);
    const dx = p.x - gesture.x;
    const dy = p.y - gesture.y;
    if (!gesture.active && Math.hypot(dx, dy) * editor.zoom < 4) return;
    gesture.active = true;
    document.body.classList.add('gesture-active');
    if (gesture.kind !== 'add') gesture.element.classList.add('dragging');
    const node = { ...gesture.initial };
    const viewport = document.getElementById('viewport')!.getBoundingClientRect();
    gesture.inside = event.clientX >= viewport.left && event.clientX <= viewport.right && event.clientY >= viewport.top && event.clientY <= viewport.bottom;
    if (gesture.kind === 'add') {
      node.col = snap(p.x - GRID.cell * node.colSpan / 2);
      node.row = snap(p.y - GRID.cell * node.rowSpan / 2);
    } else if (gesture.kind === 'move') {
      node.col += snap(dx);
      node.row += snap(dy);
    } else {
      const min = registry.get(node.type)!.min;
      node.colSpan = Math.max(min[0], node.colSpan + snap(dx));
      node.rowSpan = Math.max(min[1], node.rowSpan + snap(dy));
    }
    gesture.candidate = node;
    gesture.valid = gesture.inside && canPlace(node, editor.store.doc.nodes);
    const ghost = editor.ghost;
    ghost.hidden = !gesture.inside;
    ghost.classList.toggle('invalid', !gesture.valid);
    Object.assign(ghost.style, {
      left: `${node.col * GRID.cell}px`, top: `${node.row * GRID.cell}px`,
      width: `${node.colSpan * GRID.cell}px`, height: `${node.rowSpan * GRID.cell}px`,
    });
    ghost.querySelector('span')!.textContent = gesture.valid
      ? `${node.colSpan * GRID.cell} × ${node.rowSpan * GRID.cell} px · ${node.col * GRID.cell}, ${node.row * GRID.cell}`
      : '无法放置 · 重叠或超出边界';
  });

  function finish(commit: boolean) {
    if (!gesture) return;
    const current = gesture;
    gesture = undefined;
    editor.ghost.hidden = true;
    current.element.classList.remove('dragging');
    document.body.classList.remove('gesture-active');
    if (current.element.hasPointerCapture(current.pointer)) current.element.releasePointerCapture(current.pointer);
    if (!commit || !current.active) return;
    if (current.valid) {
      if (current.kind === 'add') editor.add(current.candidate.type, current.candidate);
      else editor.update(current.candidate);
    } else toast('放置已取消：组件不能重叠或超出画布');
  }
  document.addEventListener('pointerup', event => { if (event.pointerId === gesture?.pointer) finish(true); });
  document.addEventListener('pointercancel', event => { if (event.pointerId === gesture?.pointer) finish(false); });
  document.addEventListener('lostpointercapture', event => { if (event.pointerId === gesture?.pointer) finish(false); });
  window.addEventListener('blur', () => finish(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finish(false); });
  return { cancel: () => finish(false) };
}
