import { describe, expect, test } from 'bun:test';
import { canPlace, createNode, findSpace, GRID, initialDocument, overlaps, parseDocument, snap } from './model';
import { Store } from './store';

function empty() { return { ...initialDocument(), nodes: [] }; }

describe('网格布局', () => {
  test('像素吸附到最近的网格', () => {
    expect(snap(11)).toBe(1);
    expect(snap(12)).toBe(2);
    expect(snap(-9)).toBe(-1);
    expect(snap(35)).toBe(4);
  });
  test('边缘相接允许放置，交叉则冲突', () => {
    const a = createNode('basic.button');
    const b = { ...createNode('basic.button'), col: a.colSpan };
    expect(overlaps(a, b)).toBe(false);
    expect(canPlace(b, [a])).toBe(true);
    expect(canPlace({ ...b, col: b.col - 1 }, [a])).toBe(false);
  });
  test('禁止越界、小于最小尺寸和非整数坐标', () => {
    const node = createNode('basic.button');
    expect(canPlace({ ...node, col: -1 }, [])).toBe(false);
    expect(canPlace({ ...node, col: GRID.cols - node.colSpan + 1 }, [])).toBe(false);
    expect(canPlace({ ...node, row: GRID.rows - node.rowSpan + 1 }, [])).toBe(false);
    expect(canPlace({ ...node, colSpan: 1 }, [])).toBe(false);
    expect(canPlace({ ...node, col: 1.5 }, [])).toBe(false);
    expect(canPlace({ ...node, row: NaN }, [])).toBe(false);
  });
  test('移动时忽略自身', () => {
    const node = createNode('content.card');
    expect(canPlace(node, [node])).toBe(true);
  });
  test('自动寻找空位，画布满时返回 undefined', () => {
    const node = createNode('basic.button');
    const occupied = { ...createNode('content.card'), colSpan: GRID.cols, rowSpan: GRID.rows };
    expect(findSpace(node, [])?.col).toBe(0);
    expect(findSpace(node, [occupied])).toBeUndefined();
    expect(findSpace(node, [node])?.col).toBe(0);
    const copy = { ...node, id: 'copy' };
    expect(findSpace(copy, [node])?.col).toBe(node.colSpan);
  });
});

describe('保存文档校验', () => {
  test('初始文档可以无损还原', () => {
    const doc = initialDocument();
    expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });
  test('拒绝损坏、未知类型和重复 ID', () => {
    expect(() => parseDocument('{')).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...empty(), schemaVersion: 99 }))).toThrow();
    const node = createNode('basic.button');
    expect(() => parseDocument(JSON.stringify({ ...empty(), nodes: [{ ...node, type: 'unknown' }] }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...empty(), nodes: [node, node] }))).toThrow();
  });
  test('拒绝重叠与非法属性', () => {
    const a = createNode('basic.button');
    const b = createNode('basic.button');
    expect(() => parseDocument(JSON.stringify({ ...empty(), nodes: [a, b] }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...empty(), nodes: [{ ...a, props: { ...a.props, accent: 'url(x)' } }] }))).toThrow();
  });
});

describe('历史记录', () => {
  test('撤销重做恢复完整文档，新操作清除重做栈', () => {
    const doc = empty();
    const store = new Store(doc);
    const next = { ...doc, nodes: [createNode('basic.button')] };
    store.commit(next);
    expect(store.canUndo).toBe(true);
    store.undo();
    expect(store.doc).toEqual(doc);
    expect(store.canRedo).toBe(true);
    store.redo();
    expect(store.doc).toEqual(next);
    store.undo();
    store.commit({ ...doc, nodes: [createNode('content.card')] });
    expect(store.canRedo).toBe(false);
  });
  test('不记录无变化操作，不引用外部可变数据', () => {
    const doc = empty();
    const store = new Store(doc);
    store.commit(doc);
    expect(store.canUndo).toBe(false);
    const node = createNode('basic.button');
    store.commit({ ...doc, nodes: [node] });
    node.props.title = '外部修改';
    expect(store.doc.nodes[0].props.title).not.toBe('外部修改');
  });
});
