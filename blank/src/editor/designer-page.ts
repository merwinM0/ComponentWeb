import { Designer, type DesignerView } from '../core/designer';
import { GRID, CANVAS } from '../core/grid';
import { isContainer } from '../core/types';
import type { Combinations } from '../core/combinations';
import type { setupCombinationDialogs } from './combination-dialogs';
import { $, Editor, toast } from './editor';

export function setupDesignerPage(editor: Editor, designer: Designer, combinations: Combinations, dialogs: ReturnType<typeof setupCombinationDialogs>, cancelInteraction: () => void, refreshLibrary: () => void) {
  let restoreFrame = 0;
  const view = (): DesignerView => ({ selection: [...editor.selectedIds], zoom: editor.zoom, left: $('viewport').scrollLeft, top: $('viewport').scrollTop });
  const perform = (action: () => void) => { cancelInteraction(); try { action(); } catch (error) { toast((error as Error).message); } };
  designer.onNavigate = next => {
    $('toast').hidden = true;
    cancelInteraction(); if (editor.preview) editor.setPreview();
    editor.selectedIds = new Set(next.selection); editor.setZoom(next.zoom); $<HTMLSelectElement>('zoom').value = String(next.zoom); editor.render(); refreshLibrary();
    cancelAnimationFrame(restoreFrame);
    restoreFrame = requestAnimationFrame(() => {
      $('viewport').scrollLeft = next.left; $('viewport').scrollTop = next.top;
      const selected = editor.selected && editor.renderer.element(editor.selected);
      if (!document.querySelector('dialog[open]') && !(document.activeElement as HTMLElement)?.matches('input,textarea,select')) (selected || $('workspace-heading')).focus({ preventScroll: true });
    });
  };
  const confirm = document.createElement('dialog'); confirm.className = 'editor-dialog'; confirm.setAttribute('aria-labelledby', 'leave-design-title');
  confirm.innerHTML = '<h2 id="leave-design-title">离开组件设计页？</h2><p>当前设计尚未应用到父页。可以逐级应用并返回，也可以放弃这些草稿。</p><div class="dialog-actions"><button type="button" data-stay>继续设计</button><button type="button" data-discard class="danger">放弃并返回</button><button type="button" data-apply class="primary">应用并返回</button></div>';
  document.body.append(confirm);
  let destination = 0;
  confirm.querySelector('[data-stay]')!.addEventListener('click', () => confirm.close());
  confirm.querySelector('[data-discard]')!.addEventListener('click', () => { confirm.close(); designer.discardTo(destination); });
  confirm.querySelector('[data-apply]')!.addEventListener('click', () => { confirm.close(); applyTo(destination); });
  function validInputs() {
    const controls = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('#designer-size input,#inspector-content input,#inspector-content textarea,#inspector-content select');
    for (const control of controls) if (!control.disabled && !control.checkValidity()) { control.reportValidity(); toast('请先修正属性中的无效输入'); return false; }
    return true;
  }
  function applyTo(depth: number) {
    if (!validInputs()) return;
    perform(() => {
      while (designer.frames.length > depth) {
        const current = designer.current!;
        if (current.kind === 'library' || current.kind === 'template') {
          const name = combinations.items.find(item => item.id === current.templateId)?.name ?? designer.root!.props.title;
          dialogs.saveDocument(designer.snapshot(), name, { id: current.templateId, onSaved: () => { designer.close(); applyTo(depth); } }); return;
        }
        designer.apply();
      }
    });
  }
  function leave(depth: number) {
    if (depth >= designer.frames.length) return;
    cancelInteraction(); destination = depth;
    if (designer.frames.slice(depth).some(frame => JSON.stringify(frame.store.doc) !== frame.baseline)) confirm.showModal();
    else designer.discardTo(depth);
  }
  editor.onEditComponent = id => perform(() => designer.openNode(id, view(), editor.renderer.element(id) ? editor.logicalRect(id) : undefined));
  editor.onNewComponent = (parentId?: string | null) => perform(() => designer.create(view(), 'insert', parentId ?? (editor.node && isContainer(editor.node) ? editor.node.id : editor.scopeRootId)));
  editor.onEditSavedCombination = id => perform(() => { const item = combinations.items.find(item => item.id === id); if (!item) throw new Error('组合不存在'); designer.openTemplate(item.document, item.id, item.name, view()); });
  $('new-container').addEventListener('click', () => editor.onNewComponent());
  $('edit-component').addEventListener('click', () => { if (editor.node) editor.onEditComponent(editor.node.id); });
  $('create-combination').addEventListener('click', () => perform(() => designer.create(view(), 'library')));
  $('designer-back').addEventListener('click', () => leave(designer.frames.length - 1));
  $('designer-save').addEventListener('click', () => applyTo(designer.frames.length - 1));
  $('designer-properties').addEventListener('click', () => editor.select(designer.rootId));
  $('designer-save-as').addEventListener('click', () => { if (validInputs()) perform(() => dialogs.saveDocument(designer.snapshot(), designer.root!.props.title)); });
  editor.canvas.addEventListener('dblclick', event => {
    if (editor.preview) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>('.node')?.dataset.id;
    if (id && id !== editor.scopeRootId) editor.onEditComponent(id);
  });
  const sizeForm = $<HTMLFormElement>('designer-size');
  $<HTMLInputElement>('designer-width').max = String(CANVAS.width); $<HTMLInputElement>('designer-height').max = String(CANVAS.height);
  sizeForm.addEventListener('submit', event => event.preventDefault());
  sizeForm.addEventListener('change', event => {
    if (!sizeForm.reportValidity() || !designer.root) return;
    const input = event.target as HTMLInputElement; const root = designer.root;
    const changed = input.name === 'title' ? { ...root, props: { ...root.props, title: input.value.trim() || '未命名组件' } } : { ...root, [input.name]: Number(input.value) / GRID.cell };
    if (!editor.update(changed)) { input.value = input.name === 'title' ? root.props.title : String(root[input.name as 'colSpan' | 'rowSpan'] * GRID.cell); }
  });
  window.addEventListener('beforeunload', event => { if (designer.current) { event.preventDefault(); event.returnValue = ''; } });
  function render() {
    const active = !!designer.current;
    document.body.classList.toggle('designing', active); $('designer-panel').hidden = !active;
    $('workspace-heading').textContent = active ? '组件设计页' : '工作区';
    $('page-eyebrow').textContent = active ? 'COMPONENT / ISOLATED WORKSPACE' : 'YOUR IDEAS, IN PLACE';
    $('page-subtitle').textContent = active ? '进入组件内部，继续搭建。' : '把灵感，放进网格。';
    $<HTMLButtonElement>('edit-component').disabled = editor.preview || !editor.node || editor.node.id === editor.scopeRootId;
    const root = designer.root;
    if (!root) { $<HTMLButtonElement>('save').disabled = false; $('save').textContent = '保存布局 ↗'; document.title = 'ComponentWeb · 网格组件工作台'; return; }
    const template = designer.current!.kind === 'library' || designer.current!.kind === 'template';
    const label = template ? '保存组合并返回' : '应用到父页并返回';
    $('designer-note').textContent = designer.current!.source && !isContainer(designer.current!.source!) ? '原组件作为组合内容保留。选中内部组件编辑文案，扩展尺寸继续嵌套；应用后成为组合容器。' : '双击子组件可进入下一层。尺寸可扩展；应用时才会修改父页。';
    $('designer-save').textContent = label; $('save').textContent = template ? '保存组合' : '应用并返回';
    $<HTMLButtonElement>('save').disabled = editor.preview;
    $('save-state').textContent = designer.dirty ? '● 设计草稿 · 尚未应用' : '独立设计页';
    const crumbs = $('designer-breadcrumbs'); crumbs.replaceChildren();
    const home = document.createElement('button'); home.type = 'button'; home.textContent = '工作区'; home.addEventListener('click', () => leave(0)); crumbs.append(home);
    designer.frames.forEach((frame, index) => {
      const separator = document.createElement('span'); separator.textContent = '/'; separator.setAttribute('aria-hidden', 'true');
      const button = document.createElement('button'); button.type = 'button'; button.textContent = frame.store.doc.nodes.find(node => node.id === frame.rootId)!.props.title || '未命名组件';
      if (index === designer.frames.length - 1) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => leave(index + 1)); crumbs.append(separator, button);
    });
    for (const [id, value] of [['designer-title', root.props.title], ['designer-width', Math.round(root.colSpan * GRID.cell * 1e6) / 1e6], ['designer-height', Math.round(root.rowSpan * GRID.cell * 1e6) / 1e6]] as const) {
      const input = $<HTMLInputElement>(id); if (document.activeElement !== input) input.value = String(value); input.disabled = editor.preview;
    }
    $('designer-properties').toggleAttribute('disabled', editor.preview); $('designer-save-as').toggleAttribute('disabled', editor.preview); $('designer-save').toggleAttribute('disabled', editor.preview);
    document.title = `${root.props.title || '未命名组件'} · 组件设计页`;
  }
  render();
  return { render, save: () => applyTo(designer.frames.length - 1), leave };
}
