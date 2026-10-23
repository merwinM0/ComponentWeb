import { describe, expect, test } from 'bun:test';
import { components, registry } from './registry';
import { colorsOf, contrastRatio, isColor, palettes } from './colors';
import { safeSource } from './native/factory';
import { canPlace, createNode, DEFAULT_APPEARANCE, initialDocument, parseDocument } from '../core/model';
import { Store } from '../core/store';
import { LEGACY_GRID } from '../core/grid';

describe('组件目录', () => {
  test('类型唯一，每项都能在网格中放置并无损保存', () => {
    expect(registry.size).toBe(components.length);
    for (const definition of components) {
      const node = createNode(definition.type);
      expect(canPlace(node, [])).toBe(true);
      expect(node.colSpan).toBeGreaterThanOrEqual(definition.min[0]);
      expect(node.rowSpan).toBeGreaterThanOrEqual(definition.min[1]);
      const doc = { ...initialDocument(), nodes: [node] };
      expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
    }
  });
  test('包含常用 HTML 标签与交互组件', () => {
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'a', 'img', 'form', 'input', 'textarea', 'select', 'table', 'details', 'dialog', 'video', 'audio', 'svg', 'canvas']) expect(registry.has(`html.${tag}`)).toBe(true);
    for (const type of ['tabs', 'switch', 'navbar', 'table', 'dialog', 'accordion', 'pagination']) expect(registry.has(`ui.${type}`)).toBe(true);
  });
});

describe('配色与兼容', () => {
  test('只接受六位十六进制值，提供完整默认配色', () => {
    expect(isColor('#aAbB12')).toBe(true);
    for (const invalid of ['#fff', 'red', '#12345678', 'url(x)', undefined, null]) expect(isColor(invalid)).toBe(false);
    expect(Object.keys(colorsOf({}))).toHaveLength(4);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    for (const palette of palettes) expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5);
  });
  test('旧记录补齐颜色和画布设置，并保留按钮强调色', () => {
    const doc = initialDocument();
    const old = {
      schemaVersion: 1, grid: LEGACY_GRID,
      nodes: doc.nodes.map(node => ({ ...node, col: node.col / 3, row: node.row / 3,
        colSpan: node.colSpan / 3, rowSpan: node.rowSpan / 3,
        props: { title: node.props.title, description: node.props.description, accent: '#ffcc88' } })),
    };
    const restored = parseDocument(JSON.stringify(old));
    expect(restored.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(restored.nodes.find(node => node.type === 'basic.button')!.props.background).toBe('#ffcc88');
    expect(restored.nodes.every(node => isColor(node.props.text))).toBe(true);
  });
  test('非法组件颜色或画布颜色被拒绝', () => {
    const doc = initialDocument();
    for (const key of ['background', 'text', 'border']) {
      const invalid = structuredClone(doc);
      Object.assign(invalid.nodes[0].props, { [key]: 'red' });
      expect(() => parseDocument(JSON.stringify(invalid))).toThrow();
    }
    expect(() => parseDocument(JSON.stringify({ ...doc, appearance: { background: '#000000', grid: 'red' } }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...doc, appearance: null }))).toThrow();
  });
  test('组件与画布颜色参与撤销重做', () => {
    const store = new Store(initialDocument());
    const before = structuredClone(store.doc);
    const next = structuredClone(before);
    next.nodes[0].props.background = '#123456';
    next.appearance.background = '#ffffff';
    store.commit(next); store.undo(); expect(store.doc).toEqual(before);
    store.redo(); expect(store.doc).toEqual(next);
  });
  test('媒体和链接拒绝脚本协议', () => {
    expect(safeSource('javascript:alert(1)')).toBe('');
    expect(safeSource('data:text/html,test')).toBe('');
    expect(safeSource('file:///etc/passwd')).toBe('');
    expect(safeSource('mailto:hello@example.com', true)).toBe('');
    expect(safeSource('https://example.com/image.png', true)).toBe('https://example.com/image.png');
    expect(safeSource('mailto:hello@example.com')).toBe('mailto:hello@example.com');
  });
});
