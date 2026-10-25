import { DEFAULT_CONSTRAINTS, type ItemConstraints } from '../core/item-constraints';
import { isContainer } from '../core/types';
import type { Editor } from './editor';

export function constraintsPanel(editor: Editor) {
  const panel = document.createElement('form'); panel.className = 'constraints-panel';
  const node = editor.node!;
  const parent = editor.store.doc.nodes.find(n => n.id === node.parentId);
  const mode = parent?.layout?.mode ?? 'free';
  const c = node.constraints ?? DEFAULT_CONSTRAINTS;
  const canContent = !isContainer(node) && !node.type.startsWith('imported.') && node.id !== editor.scopeRootId;
  panel.innerHTML = `<div class="section-title">子项尺寸约束 <span>CONSTRAINTS</span></div>
    <div class="field-grid"><label class="field">Flex grow<input id="item-flexGrow" name="flexGrow" type="number" min="0" max="100" step="any" required></label>
    <label class="field">Flex shrink<input id="item-flexShrink" name="flexShrink" type="number" min="0" max="100" step="any" required></label>
    <label class="field">Grid 跨列<input id="item-columnSpan" name="columnSpan" type="number" min="1" max="12" step="1" required></label>
    <label class="field">Grid 跨行<input id="item-rowSpan" name="rowSpan" type="number" min="1" max="12" step="1" required></label></div>
    <label class="field full">高度模式<select id="item-heightMode" name="heightMode"><option value="fixed">固定 / 请求高度</option><option value="content">内容自适应高度</option></select></label>
    <p class="inspector-help">${mode === 'free' ? '当前为自由布局；伸缩和跨格设置仅在相应自动布局父级中生效。' : 'W / H 是请求尺寸；实际尺寸由父级分配，但不小于目录最小尺寸。'}跨列超过父级列数时按当前列数显示，原设置保留。自适应按当前可用宽度测量，更新实际占位；越界或同级碰撞会取消整次修改。容器、导入组件及当前编辑框保持固定高度。</p>`;
  for (const [key, value] of Object.entries(c)) {
    const input = panel.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
    input.value = String(value);
    input.disabled = editor.preview || (key.startsWith('flex') ? mode !== 'flex' : key === 'columnSpan' || key === 'rowSpan' ? mode !== 'grid' : !canContent);
  }
  panel.addEventListener('submit', event => event.preventDefault());
  panel.addEventListener('change', event => {
    if (!panel.reportValidity()) return;
    const input = event.target as HTMLInputElement;
    const constraints: ItemConstraints = { ...c, [input.name]: input.name === 'heightMode' ? input.value : Number(input.value) };
    if (!editor.update({ ...node, constraints })) editor.onSelection();
  });
  return panel;
}
