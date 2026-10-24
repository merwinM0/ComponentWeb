import type { ElementEdit } from '../core/element-edits';

export const tagChildren = (parent: ParentNode) => [...parent.children].filter((element): element is HTMLElement => element instanceof HTMLElement && !['STYLE', 'SCRIPT', 'LINK', 'IFRAME'].includes(element.tagName));
export function tagAt(root: ShadowRoot, path: number[]) {
  let parent: ParentNode = root; let element: HTMLElement | undefined;
  for (const index of path) { element = tagChildren(parent)[index]; if (!element) return undefined; parent = element; }
  return element;
}
export function tagPath(root: ShadowRoot, element: HTMLElement): number[] | null {
  const path: number[] = []; let current: HTMLElement | null = element;
  while (current && current.parentNode) {
    const parent = current.parentNode as ParentNode, index = tagChildren(parent).indexOf(current);
    if (index < 0) return null; path.unshift(index); if (parent === root) return path;
    current = current.parentElement;
  }
  return null;
}
export function ownText(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
  if (element instanceof HTMLImageElement) return element.alt;
  return [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? '').join('').trim();
}
interface Original { element: HTMLElement; style: string | null; texts?: { node: Node; value: string | null }[]; value?: string; created?: Text }
const originals = new WeakMap<HTMLElement, Original[]>();
export function restoreTags(host: HTMLElement) {
  for (const item of originals.get(host) ?? []) {
    if (item.style === null) item.element.removeAttribute('style'); else item.element.setAttribute('style', item.style);
    item.texts?.forEach(text => { text.node.textContent = text.value; }); item.created?.remove();
    if (item.value !== undefined) { if (item.element instanceof HTMLImageElement) item.element.alt = item.value; else (item.element as HTMLInputElement).value = item.value; }
  }
  originals.delete(host);
}
export function applyTags(host: HTMLElement, edits: ElementEdit[] = []) {
  const records = new Map<HTMLElement, Original>();
  const remember = (element: HTMLElement) => { if (!records.has(element)) records.set(element, { element, style: element.getAttribute('style') }); return records.get(element)!; };
  for (const edit of edits) {
    const element = tagAt(host.shadowRoot!, edit.path); if (!element || element.localName !== edit.tag) continue;
    const record = remember(element);
    if (edit.text !== undefined) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLImageElement) {
        record.value = ownText(element); if (element instanceof HTMLImageElement) element.alt = edit.text; else element.value = edit.text;
      } else {
        const texts = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
        record.texts = texts.map(node => ({ node, value: node.textContent }));
        if (texts.length) texts.forEach((node, index) => { node.textContent = index ? '' : edit.text!; });
        else if (!element.children.length) { const text = document.createTextNode(edit.text); element.append(text); record.created = text; }
      }
    }
    if (edit.hidden) element.style.setProperty('display', 'none', 'important');
    const style = edit.style;
    if (style) {
      if (style.x !== undefined || style.y !== undefined) element.style.translate = `${style.x ?? 0}px ${style.y ?? 0}px`;
      for (const key of ['width', 'height', 'fontSize'] as const) if (style[key] !== undefined) element.style[key] = `${style[key]}px`;
      if (style.color) element.style.color = style.color; if (style.background) element.style.backgroundColor = style.background;
    }
    if (edit.text !== undefined || (style && ['x', 'y', 'width', 'height', 'fontSize'].some(key => key in style))) {
      element.style.overflow = 'visible';
      let parent = element.parentElement;
      while (parent) { remember(parent); parent.style.overflow = 'visible'; parent = parent.parentElement; }
    }
  }
  originals.set(host, [...records.values()]);
}
