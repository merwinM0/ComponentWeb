import { Store } from './core/store';
import { Layouts } from './core/layouts';
import { setupLayoutWorkspace } from './editor/layout-workspace';
import { Combinations } from './core/combinations';
import { StoreRouter } from './core/store-router';
import { InlineEdit } from './core/inline-edit';
import { setupInlineEditing } from './editor/inline-editing';
import { setupElementEditing } from './editor/element-editing';
import { $, Editor, toast } from './editor/editor';
import { setupGestures } from './editor/gestures';
import { setupPanels } from './editor/panels';
import { setupCombinationDialogs } from './editor/combination-dialogs';
import { setupContextMenu } from './editor/context-menu';
import { actionButton, selectionActions } from './editor/selection-actions';

const layouts = new Layouts();
const store = new StoreRouter(new Store(layouts.current.document));
const session = new InlineEdit(store);
const combinations = new Combinations();
const editor = new Editor(store, session, false);
const elements = setupElementEditing(editor);
const dialogs = setupCombinationDialogs(editor, combinations);
const gestures = setupGestures(editor, combinations);
const cancelInteractions = () => { elements.cancel(); gestures.cancel(); };
const panels = setupPanels(editor, combinations, dialogs);
const contextMenu = setupContextMenu(editor, combinations, dialogs, cancelInteractions);
const inlineEditor = setupInlineEditing(editor, session, combinations, dialogs, () => { cancelInteractions(); contextMenu.close(); }, panels.refresh);
const layoutWorkspace = setupLayoutWorkspace(editor, store, layouts, () => inlineEditor.finish(), () => { cancelInteractions(); contextMenu.close(); }, panels.refresh);
const updateInspector = editor.onSelection;
function updateCommands() {
  const target = $('arrange-actions'); target.replaceChildren();
  for (const action of selectionActions(editor).slice(0, 8)) target.append(actionButton({ ...action, run: () => { cancelInteractions(); action.run(); document.querySelector<HTMLDetailsElement>('.arrange-dropdown')!.open = false; } }));
  $<HTMLButtonElement>('group-selection').disabled = editor.preview || (session.current ? !store.doc.nodes.length || (!session.loose.length && !!session.root) : !!selectionActions(editor).find(action => action.label === '组合为自由容器')?.disabled);
  $<HTMLButtonElement>('save-combination').disabled = !!selectionActions(editor).find(action => action.label === '保存到我的组合')?.disabled;
  $<HTMLButtonElement>('new-container').disabled = editor.preview;
  $<HTMLButtonElement>('select-all').disabled = editor.preview;
}
editor.onSelection = () => { updateInspector(); updateCommands(); inlineEditor.render(); elements.render(); layoutWorkspace.render(); };
updateCommands();
$('select-all').addEventListener('click', () => editor.selectAll(editor.selection[0]?.parentId ?? null));
$('group-selection').addEventListener('click', () => editor.group());
$('save-combination').addEventListener('click', () => editor.onSaveCombination());
document.addEventListener('pointerdown', event => { if (!(event.target as HTMLElement).closest('.arrange-dropdown')) document.querySelector<HTMLDetailsElement>('.arrange-dropdown')!.open = false; });

$('undo').addEventListener('click', () => { cancelInteractions(); store.undo(); });
$('redo').addEventListener('click', () => { cancelInteractions(); store.redo(); });
$('preview').addEventListener('click', () => { if (session.current) return; cancelInteractions(); contextMenu.close(); editor.setPreview(); panels.refresh(); });
$('zoom').addEventListener('change', event => { cancelInteractions(); editor.setZoom(Number((event.target as HTMLSelectElement).value)); });

document.addEventListener('keydown', event => {
  if (layoutWorkspace.isHome || event.defaultPrevented || document.querySelector('dialog[open]')) return;
  const typing = event.composedPath().some(target => target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable));
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.shiftKey && session.current && !editor.preview) {
    event.preventDefault(); (document.activeElement as HTMLElement)?.blur(); layoutWorkspace.save(true); return;
  }
  if (typing || editor.preview) return;
  if (event.key === 'Escape') { cancelInteractions(); editor.select(null); return; }
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && key === 's') { event.preventDefault(); event.shiftKey ? editor.onSaveCombination() : layoutWorkspace.save(true); return; }
  if (modifier && key === 'z') { event.preventDefault(); cancelInteractions(); event.shiftKey ? store.redo() : store.undo(); return; }
  if (modifier && key === 'y') { event.preventDefault(); cancelInteractions(); store.redo(); return; }
  if (modifier && key === 'd') { event.preventDefault(); cancelInteractions(); editor.duplicate(); return; }
  const target = event.target as HTMLElement;
  if (target.closest('.panel,.topbar,.workspace-toolbar,.commandbar,.context-menu')) return;
  if (modifier && key === 'a') { event.preventDefault(); editor.selectAll(editor.selection[0]?.parentId ?? null); return; }
  if (modifier && key === 'g') { event.preventDefault(); cancelInteractions(); event.shiftKey ? editor.ungroup() : editor.group(); return; }
  if (!editor.selectedIds.size) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); cancelInteractions(); editor.selectedTag ? elements.removeSelected() : editor.remove(); return; }
  const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
  if (delta) {
    event.preventDefault(); cancelInteractions();
    if (editor.selectedTag) { const step = event.shiftKey ? 5 : 1; elements.moveSelected(delta[0] * step, delta[1] * step); return; }
    const parent = store.doc.nodes.find(node => node.id === editor.selection[0]?.parentId);
    if (parent?.layout?.mode && parent.layout.mode !== 'free') editor.reorder(delta[0] + delta[1]);
    else { const step = event.shiftKey ? 5 : 1; editor.move(delta[0] * step, delta[1] * step); }
  }
});
if (layouts.warning || combinations.warning) toast(layouts.warning || combinations.warning);
if (window.matchMedia('(max-width: 800px)').matches) document.querySelector<HTMLDetailsElement>('.inspector details')!.open = false;
