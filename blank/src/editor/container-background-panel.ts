import { CONTAINER_SKINS, skinSvg } from '../components/container/skins';
import { containerGeometry } from '../core/container-geometry';
import type { Editor } from './editor';

export function containerBackgroundPanel(editor: Editor) {
  const node = editor.node!;
  const panel = document.createElement('div'); panel.className = 'container-background-panel';
  const title = document.createElement('div'); title.className = 'section-title'; title.innerHTML = '容器背景 <span>SVG BACKGROUND</span>';
  const choices = document.createElement('div'); choices.className = 'background-choices';
  const plain = document.createElement('button'); plain.type = 'button'; plain.className = 'background-choice plain-background';
  plain.innerHTML = '<span class="background-thumbnail" aria-hidden="true"><i></i></span><span>普通矩形</span>';
  plain.setAttribute('aria-pressed', String(!node.skin)); plain.disabled = editor.preview;
  plain.addEventListener('click', () => { if (!editor.update({ ...node, skin: undefined })) editor.onSelection(); });
  choices.append(plain);
  for (const skin of CONTAINER_SKINS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'background-choice';
    button.setAttribute('aria-pressed', String(node.skin === skin.id)); button.disabled = editor.preview;
    button.title = skin.description; button.dataset.skin = skin.id;
    const preview = document.createElement('span'); preview.className = 'background-thumbnail'; preview.setAttribute('aria-hidden', 'true');
    for (const [key, value] of Object.entries(skin.palette)) preview.style.setProperty(key === 'background' ? '--surface' : `--${key}`, value);
    preview.innerHTML = skinSvg(skin.id, 360, 240);
    const label = document.createElement('span'); label.textContent = skin.title;
    button.append(preview, label);
    button.addEventListener('click', () => { if (!editor.update({ ...node, skin: skin.id, props: { ...node.props, ...skin.palette } })) editor.onSelection(); });
    choices.append(button);
  }
  const help = document.createElement('p'); help.className = 'inspector-help';
  const { content, skin } = containerGeometry(node);
  help.textContent = `${skin ? `${skin.title} · 最小内部设计 ${skin.min[0]}×${skin.min[1]}px。` : ''}当前可布局区域 ${Math.round(content.width)}×${Math.round(content.height)}px。选择 SVG 款式会应用示例配色，可继续自定义；切回矩形保留配色。虚线为内容安全区，内边距在其内再应用一次。圆角仅用于普通矩形；外部占位仍是矩形，不支持缺角互嵌。`;
  panel.append(title, choices, help);
  return panel;
}
