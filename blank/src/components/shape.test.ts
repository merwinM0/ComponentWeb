import { describe, expect, test } from 'bun:test';
import { components } from './registry';
import { DEFAULT_SHAPE, isValidShape, shapeOf } from './shape';
import { createNode, initialDocument, parseDocument } from '../core/model';
import { Store } from '../core/store';

describe('圆角与边框', () => {
  test('所有组件默认直角，边框默认 1px 实线', () => {
    for (const definition of components) expect(shapeOf(createNode(definition.type).props)).toEqual(DEFAULT_SHAPE);
  });
  test('旧记录缺少形状字段时补齐为直角，不修改布局和颜色', () => {
    const doc = initialDocument();
    const legacy = structuredClone(doc);
    for (const node of legacy.nodes) {
      delete node.props.radius;
      delete node.props.borderWidth;
      delete node.props.borderStyle;
    }
    expect(parseDocument(JSON.stringify(legacy))).toEqual(doc);
  });
  test('边界值与无边框均合法，拒绝非法数据和 CSS 注入', () => {
    expect(isValidShape({})).toBe(true);
    expect(isValidShape({ radius: 0, borderWidth: 0, borderStyle: 'none' })).toBe(true);
    expect(isValidShape({ radius: 120, borderWidth: 12, borderStyle: 'dashed' })).toBe(true);
    for (const radius of [-1, 121, 1.5, '8', null, NaN, Infinity]) expect(isValidShape({ radius })).toBe(false);
    for (const borderWidth of [-1, 13, 0.5, '1', null]) expect(isValidShape({ borderWidth })).toBe(false);
    for (const borderStyle of ['double', '', null, 'solid;display:none']) expect(isValidShape({ borderStyle })).toBe(false);
    expect(isValidShape(null)).toBe(false);
  });
  test('自定义形状无损还原，非法保存数据被拒绝', () => {
    const doc = initialDocument();
    Object.assign(doc.nodes[0].props, { radius: 16, borderWidth: 3, borderStyle: 'dotted' });
    expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
    for (const invalid of [{ radius: -1 }, { radius: '8' }, { radius: null }, { borderWidth: 13 }, { borderStyle: 'url(x)' }]) {
      const corrupt = structuredClone(doc);
      Object.assign(corrupt.nodes[0].props, invalid);
      expect(() => parseDocument(JSON.stringify(corrupt))).toThrow();
    }
  });
  test('圆角与边框参与撤销重做，复制数据相互独立', () => {
    const original = initialDocument();
    const store = new Store(original);
    const edited = structuredClone(original);
    Object.assign(edited.nodes[0].props, { radius: 24, borderWidth: 2, borderStyle: 'dashed' });
    store.commit(edited);
    store.undo(); expect(store.doc).toEqual(original);
    store.redo(); expect(store.doc).toEqual(edited);
    const copy = structuredClone(store.doc.nodes[0]);
    copy.props.radius = 0;
    expect(store.doc.nodes[0].props.radius).toBe(24);
  });
});
