import { InlineEdit, type EditView } from '../core/inline-edit';
import { GRID } from '../core/grid';
import { registry } from '../components/registry';
import type { Combinations } from '../core/combinations';
import type { setupCombinationDialogs } from './combination-dialogs';
import { createNode, findSpace as findNew } from '../core/model';
import { $, Editor, toast } from './editor';

export function setupInlineEditing(editor: Editor, session: InlineEdit, combinations: Combinations, dialogs: ReturnType<typeof setupCombinationDialogs>, cancel: () => void, refreshLibrary: () => void) {
  const view = (): EditView => ({ selection: [...editor.selectedIds], zoom: editor.zoom, left: $('viewport').scrollLeft, top: $('viewport').scrollTop });
  const perform = (action: () => void) => { cancel(); try { action(); $('toast').hidden = true; } catch (error) { toast((error as Error).message); } };
  let restore = 0;
  session.onNavigate = next => {
    $('toast').hidden = true;
    editor.selectedTag = null; editor.selectedIds = new Set(next.selection); editor.setZoom(next.zoom); $<HTMLSelectElement>('zoom').value = String(next.zoom);
    editor.render(); refreshLibrary(); cancelAnimationFrame(restore);
    restore = requestAnimationFrame(() => { $('viewport').scrollLeft = next.left; $('viewport').scrollTop = next.top; (editor.selected ? editor.renderer.element(editor.selected) : $('workspace-heading'))?.focus({ preventScroll: true }); });
  };
  function validInputs() {
    for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('#inline-size input,#inspector-content input,#inspector-content textarea,#inspector-content select')) {
      if (!control.disabled && !control.checkValidity()) { control.reportValidity(); toast('请先修正属性中的无效输入'); return false; }
    }
    return true;
  }
  function finish(depth = session.frames.length - 1) {
    if (!validInputs()) return;
    perform(() => {
      while (session.frames.length > depth) {
        const frame = session.current!;
        if (frame.templateId) {
          const snapshot = session.snapshot();
          if (!snapshot.nodes.length) { combinations.remove(frame.templateId); session.finishTemplate(); refreshLibrary(); continue; }
          dialogs.saveDocument(snapshot, combinations.items.find(item => item.id === frame.templateId)?.name ?? frame.name,
            { id: frame.templateId, onSaved: () => { session.finishTemplate(); finish(depth); } }); return;
        }
        session.finish();
      }
    });
  }
  editor.onEditComponent = id => perform(() => {
    const node = editor.store.doc.nodes.find(node => node.id === id); if (!node) throw new Error('组件不存在');
    const rect = editor.logicalRect(id), space = editor.origin(node.parentId);
    session.open(id, view(), rect, { colSpan: rect.colSpan / space.scaleX, rowSpan: rect.rowSpan / space.scaleY });
  });
  editor.onNewComponent = parentId => {
    const node = createNode('layout.container'); node.colSpan = 24; node.rowSpan = 16; node.design = { width: 288, height: 192 }; node.layout!.padding = 0; node.props.borderWidth = 0;
    if (parentId) editor.add(node.type, undefined, parentId);
    else if (editor.scopeRootId) editor.add(node.type, { ...node, ...editor.stagingPosition(node) });
    else { const existing = editor.store.doc.nodes; perform(() => { const placed = findNew(node, existing); if (!placed) throw new Error('没有可用空间，请先腾出位置或进入组件编辑后添加'); editor.add(node.type, placed); }); }
  };
  editor.onAssemble = () => { if (validInputs()) perform(() => { session.assemble(); editor.select(session.rootId); }); };
  editor.onEditSavedCombination = id => perform(() => { const item = combinations.items.find(item => item.id === id); if (!item) throw new Error('组合不存在'); session.openTemplate(item.document, item.id, item.name, view()); });
  $('new-container').addEventListener('click', () => editor.onNewComponent());
  $('edit-component').addEventListener('click', () => { if (editor.node && editor.node.id !== editor.scopeRootId) editor.onEditComponent(editor.node.id); });
  $('assemble-layer').addEventListener('click', () => editor.onAssemble()); $('finish-edit').addEventListener('click', () => finish());
  $('create-combination').addEventListener('click', () => {
    const before = editor.store.doc.nodes.length; editor.onNewComponent();
    if (editor.store.doc.nodes.length > before && editor.selected) editor.onEditComponent(editor.selected);
  });
  editor.canvas.addEventListener('dblclick', event => { if (!editor.preview) { const node = editor.hitNode(event.target as HTMLElement, event.altKey); if (node && node.id !== session.rootId) editor.onEditComponent(node.id); } });
  $('inline-size').addEventListener('submit', event => event.preventDefault());
  $('inline-size').addEventListener('change', event => {
    if (!validInputs() || !session.root) return; const input = event.target as HTMLInputElement, root = session.root;
    const changed = input.name === 'title' ? { ...root, props: { ...root.props, title: input.value.trim() || '组合组件' } } : { ...root, [input.name]: Number(input.value) / GRID.cell };
    if (!editor.update(changed)) { input.blur(); render(); }
  });
  window.addEventListener('beforeunload', event => { if (session.current) { event.preventDefault(); event.returnValue = ''; } });
  function render() {
    const active = !!session.current; document.body.classList.toggle('editing-component', active); $('inline-editor').hidden = !active;
    $<HTMLButtonElement>('preview').disabled = active;
    $<HTMLButtonElement>('edit-component').disabled = editor.preview || !editor.node || editor.node.id === session.rootId;
    $('group-selection').textContent = active ? '组装本层' : '组合';
    $('save').textContent = active ? '完成本层' : '保存布局 ↗';
    $('mode-label').textContent = active ? `原位编辑 · 第 ${session.frames.length} 层` : editor.preview ? '预览模式' : '编辑模式';
    if (!active) { document.title = 'ComponentWeb · 网格组件工作台'; return; }
    const root = session.root;
    $('save-state').textContent = `原位编辑 · 第 ${session.frames.length} 层`;
    $('edit-pending').textContent = !editor.store.doc.nodes.length ? '已清空 · 完成后删除原组件' : session.loose.length ? `${session.loose.length} 个散件待组装` : '已组装 · 可完成';
    $('edit-pending').classList.toggle('pending', !!session.loose.length);
    const crumbs = $('edit-breadcrumbs'); crumbs.replaceChildren();
    const home = document.createElement('button'); home.type = 'button'; home.textContent = '工作区'; home.addEventListener('click', () => finish(0)); crumbs.append(home);
    session.frames.forEach((frame, index) => { const separator = document.createElement('span'); separator.textContent = '/'; const button = document.createElement('button'); button.type = 'button';
      button.textContent = frame.store.doc.nodes.find(node => node.id === frame.rootId)?.props.title ?? frame.name;
      if (index === session.frames.length - 1) { button.setAttribute('aria-current', 'page'); button.disabled = true; }
      else button.addEventListener('click', () => finish(index + 1)); crumbs.append(separator, button);
    });
    for (const [id, value] of [['inline-title', root?.props.title ?? session.current!.name], ['inline-width', (root?.colSpan ?? session.current!.source.colSpan) * GRID.cell], ['inline-height', (root?.rowSpan ?? session.current!.source.rowSpan) * GRID.cell]] as const) {
      const input = $<HTMLInputElement>(id); if (document.activeElement !== input) input.value = String(value); input.disabled = !root;
    }
    if (root) { const min = registry.get(root.type)!.min; $<HTMLInputElement>('inline-width').min = String(min[0] * GRID.cell); $<HTMLInputElement>('inline-height').min = String(min[1] * GRID.cell); }
    document.title = `正在编辑 ${root?.props.title ?? session.current!.name} · ComponentWeb`;
  }
  render(); return { render, finish };
}
