import { registry } from '../components/registry';
import { childrenOf } from '../core/tree';
import { isContainer } from '../core/types';
import type { Editor } from './editor';
export function layerPanel(editor: Editor) {
  const details = document.createElement('details'); details.className = 'layers-panel'; details.open = true;
  const summary = document.createElement('summary'); summary.textContent = '组件层级';
  const nav = document.createElement('nav'); nav.setAttribute('aria-label', '组件层级'); nav.className = 'layers-list';
  const visit = (parent: string | null, depth: number) => {
    for (const node of childrenOf(editor.store.doc.nodes, parent)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'layer-item'; button.dataset.id = node.id; button.style.paddingLeft = `${8 + depth * 12}px`;
      button.textContent = `${isContainer(node) ? '⊞' : '◇'} ${node.props.title || registry.get(node.type)!.title}`;
      button.title = `${registry.get(node.type)!.title} · ${node.id.slice(0, 6)}`; button.setAttribute('aria-pressed', String(editor.selectedIds.has(node.id))); button.disabled = editor.preview;
      button.addEventListener('click', event => {
        editor.select(node.id, event.shiftKey); const element = editor.renderer.element(node.id);
        element?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (editor.selectedIds.has(node.id)) element?.focus({ preventScroll: true });
      }); nav.append(button); visit(node.id, depth + 1);
    }
  };
  visit(null, 0); details.append(summary, nav); return details;
}
