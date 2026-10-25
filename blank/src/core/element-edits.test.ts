import { describe, expect, test } from 'bun:test';
import { parseElementEdits, parseSurface } from './element-edits';
import { createNode, initialDocument, parseDocument, GRID } from './model';
import { Store } from './store';
import { cloneForest } from './operations';
import { EDIT_SPACE } from './grid';

describe('原生标签修改与自动缩放数据', () => {
  test('白名单标签样式往返，不保存任意 HTML、事件或 CSS', () => {
    const elements = [{ path: [0, 1], tag: 'h3', text: '<img src=x onerror=alert(1)>', hidden: false, style: { x: -24, y: 12, fontSize: 28, color: '#FFFFFF', background: '#102030', injected: 'url(x)' }, onclick: 'alert(1)' }];
    const parsed = parseElementEdits(elements);
    expect(parsed[0].text).toBe(elements[0].text); expect(parsed[0].style).toEqual({ x: -24, y: 12, fontSize: 28, color: '#FFFFFF', background: '#102030' });
    expect(parsed[0]).not.toHaveProperty('onclick');
    const node = { ...createNode('content.card'), elements: parsed, surface: { baseWidth: 288, baseHeight: 192, x: -24, y: 0, width: 600, height: 360 } };
    const doc = { ...initialDocument(), nodes: [node] };
    expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });
  test('拒绝危险或无效路径、样式注入、重复标签和无效尺寸', () => {
    for (const edit of [
      { path: [], tag: 'h3' }, { path: [-1], tag: 'h3' }, { path: [0], tag: 'script' }, { path: [0], tag: 'h3 onclick=x' },
      { path: [0], tag: 'span', style: { color: 'url(x)' } }, { path: [0], tag: 'span', style: { x: Infinity } },
      { path: [0], tag: 'span', style: { width: 0 } }, { path: [0], tag: 'span', style: { fontSize: 400 } }, { path: [0], tag: 'span', text: 3 },
    ]) expect(() => parseElementEdits([edit])).toThrow();
    expect(() => parseElementEdits([{ path: [0], tag: 'span' }, { path: [0], tag: 'span' }])).toThrow('重复');
    expect(() => parseSurface({ baseWidth: 100, baseHeight: 48, x: 0, y: 0, width: 9000, height: 48 })).toThrow();
    expect(() => parseSurface({ baseWidth: 100, baseHeight: 48, x: NaN, y: 0, width: 100, height: 48 })).toThrow();
  });
  test('标签修改参与历史、子树复制和本地记录，不共享可变数据', () => {
    const doc = { ...initialDocument(), nodes: [createNode('basic.button')] }; const store = new Store(doc), node = doc.nodes[0];
    const changed = { ...node, elements: [{ path: [0, 0], tag: 'span', text: '改文案' }] };
    store.commit({ ...doc, nodes: [changed] }); store.undo(); expect(store.doc).toEqual(doc); store.redo();
    const clone = cloneForest(store.doc.nodes, [node.id]); expect(clone.nodes[0].elements).toEqual(changed.elements);
    clone.nodes[0].elements![0].text = '副本'; expect(store.doc.nodes[0].elements![0].text).toBe('改文案');
    expect(parseDocument(JSON.stringify(store.doc))).toEqual(store.doc);
  });
  test('新区域可用，主画布仍拒绝重叠，临时草稿也不能超出最终编辑空间', () => {
    const root = createNode('basic.button'), loose = { ...createNode('html.p'), col: 0, row: 0 };
    const doc = { ...initialDocument(), nodes: [root, loose] };
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('重叠'); expect(parseDocument(JSON.stringify(doc), true).nodes).toHaveLength(2);
    loose.col = 82; expect(parseDocument(JSON.stringify(doc)).nodes).toHaveLength(2); expect(parseDocument(JSON.stringify(doc), true).nodes).toHaveLength(2);
    loose.col = GRID.cols; expect(() => parseDocument(JSON.stringify(doc))).toThrow('超出'); expect(parseDocument(JSON.stringify(doc), true).nodes).toHaveLength(2);
    loose.col = EDIT_SPACE.width / GRID.cell; expect(() => parseDocument(JSON.stringify(doc), true)).toThrow('超出');
  });
});
