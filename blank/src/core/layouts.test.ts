import { describe, expect, test } from 'bun:test';
import { Layouts, LAYOUTS_KEY, MAX_LAYOUTS, parseLayouts } from './layouts';
import { STORAGE_KEY } from './store';
import { createNode, initialDocument } from './model';

function memory() {
  const values = new Map<string, string>(); let fail = '';
  return { values, failOn(key: string) { fail = key; }, getItem(key: string) { return values.get(key) ?? null; }, setItem(key: string, value: string) { if (key === fail) throw new Error('quota'); values.set(key, value); } };
}
const blank = () => ({ ...initialDocument(), nodes: [] });

describe('独立布局库', () => {
  test('首次使用建立默认布局，保持原有示例并写入本地', () => {
    const storage = memory(), layouts = new Layouts(storage);
    expect(layouts.items).toHaveLength(1); expect(layouts.current.name).toBe('默认布局'); expect(layouts.current.document.nodes).toHaveLength(4);
    expect(parseLayouts(storage.getItem(LAYOUTS_KEY)!)).toEqual(layouts.items);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(layouts.current.document);
  });
  test('旧单布局自动迁入，保留组件 ID、子树、坐标、颜色和标签修改', () => {
    const storage = memory(), root = createNode('layout.container'); root.props.borderWidth = 0; root.layout!.padding = 0;
    const child = { ...createNode('basic.button'), parentId: root.id, col: 1.5, row: 2.25, elements: [{ path: [0, 0], tag: 'span', text: '保留文案' }] };
    const doc = { ...blank(), nodes: [root, child] }; storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    const layouts = new Layouts(storage); expect(layouts.current.document).toEqual(doc); expect(new Layouts(storage).current.id).toBe(layouts.currentId);
  });
  test('旧 24px 文档按实际像素迁移后进入布局库', () => {
    const storage = memory(), node = createNode('basic.button');
    const legacy = { ...initialDocument(), schemaVersion: 1, grid: { cols: 40, rows: 30, cell: 24 }, nodes: [{ ...node, col: 2, row: 3, colSpan: 7, rowSpan: 2 }] };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const layouts = new Layouts(storage); expect(layouts.current.document.schemaVersion).toBe(3);
    expect(layouts.current.document.nodes[0]).toMatchObject({ id: node.id, col: 4, row: 6, colSpan: 14, rowSpan: 4 });
  });
  test('新建为空白布局，名称去首尾空白，不覆盖原布局', () => {
    const storage = memory(), layouts = new Layouts(storage), first = structuredClone(layouts.current);
    const next = layouts.create('  第二个布局  ');
    expect(next.name).toBe('第二个布局'); expect(next.document.nodes).toHaveLength(0); expect(next.id).not.toBe(first.id);
    expect(layouts.items[0]).toEqual(first); expect(layouts.currentId).toBe(next.id); expect(layouts.items).toHaveLength(2);
  });
  test('保存只更新指定布局，不新增副本、修改其他布局或复用可变数据', () => {
    const layouts = new Layouts(memory()), first = structuredClone(layouts.current), next = layouts.create('第二份');
    const doc = { ...blank(), nodes: [createNode('basic.input')] }; layouts.save(next.id, doc);
    expect(layouts.items).toHaveLength(2); expect(layouts.items[0]).toEqual(first); expect(layouts.current.id).toBe(next.id);
    expect(layouts.current.createdAt).toBe(next.createdAt); expect(layouts.current.updatedAt > next.updatedAt).toBe(true);
    doc.nodes[0]!.props.title = '外部改动'; expect(layouts.current.document.nodes[0]!.props.title).not.toBe('外部改动');
  });
  test('启动选择最近修改的布局，而不是上次浏览的布局', () => {
    const storage = memory(), layouts = new Layouts(storage), first = layouts.current, next = layouts.create('最新');
    const updated = next.updatedAt; layouts.select(first.id);
    expect(layouts.currentId).toBe(first.id); expect(layouts.items.find(item => item.id === next.id)!.updatedAt).toBe(updated);
    expect(new Layouts(storage).current.id).toBe(next.id);
    layouts.save(first.id, first.document); expect(new Layouts(storage).current.id).toBe(first.id);
    expect(layouts.sorted[0]!.id).toBe(first.id);
  });
  test('同一毫秒连续修改也按先后排序，手动保存当前布局可成为最新', () => {
    const layouts = new Layouts(memory()), first = layouts.current, next = layouts.create('第二份');
    layouts.select(first.id); layouts.save(first.id, first.document); const a = layouts.current.updatedAt; layouts.save(next.id, next.document);
    expect(layouts.sorted[0]!.id).toBe(next.id); expect(layouts.sorted[0]!.updatedAt > a).toBe(true);
    expect(layouts.currentId).toBe(first.id);
  });
  test('重名布局互不覆盖，无效名称和未知 ID 不改变数据', () => {
    const layouts = new Layouts(memory()); layouts.create('同名'); layouts.create('同名');
    expect(layouts.items).toHaveLength(3); const before = structuredClone(layouts.items), id = layouts.currentId;
    expect(() => layouts.create('  ')).toThrow('布局名称'); expect(() => layouts.create('长'.repeat(61))).toThrow('布局名称');
    expect(() => layouts.select('missing')).toThrow('不存在'); expect(() => layouts.save('missing', blank())).toThrow('不存在');
    expect(layouts.items).toEqual(before); expect(layouts.currentId).toBe(id);
  });
  test('保存失败不改内存、当前 ID、时间戳或原存档', () => {
    const storage = memory(), layouts = new Layouts(storage), before = structuredClone(layouts.items), raw = storage.getItem(LAYOUTS_KEY), id = layouts.currentId;
    storage.failOn(LAYOUTS_KEY);
    expect(() => layouts.create('不能写入')).toThrow('保存布局失败'); expect(() => layouts.save(id, blank())).toThrow('保存布局失败');
    expect(layouts.items).toEqual(before); expect(layouts.currentId).toBe(id); expect(storage.getItem(LAYOUTS_KEY)).toBe(raw);
  });
  test('拒绝非法文档，不将尚未组装或越界的结构写入布局库', () => {
    const layouts = new Layouts(memory()), before = structuredClone(layouts.items), node = { ...createNode('basic.button'), col: 1000 };
    expect(() => layouts.save(layouts.currentId, { ...blank(), nodes: [node] })).toThrow(); expect(layouts.items).toEqual(before);
  });
  test('损坏的布局库保留原记录，尽可能恢复旧工作区', () => {
    const storage = memory(), doc = { ...blank(), nodes: [createNode('basic.input')] };
    storage.setItem(LAYOUTS_KEY, '{broken'); storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    const layouts = new Layouts(storage); expect(layouts.warning).toContain('读取失败'); expect(layouts.current.document).toEqual(doc);
    expect(storage.getItem(LAYOUTS_KEY)).toBe('{broken');
  });
  test('存储读取或首次写入被拒绝时仍可查看工作台，但不伪报保存成功', () => {
    const unavailable = new Layouts({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
    expect(unavailable.warning).toContain('读取失败'); expect(unavailable.current.document.nodes).toHaveLength(4);
    expect(() => unavailable.save(unavailable.currentId, blank())).toThrow('保存布局失败');
    const storage = memory(); storage.failOn(LAYOUTS_KEY); const layouts = new Layouts(storage);
    expect(layouts.warning).toContain('尚未保存'); expect(layouts.items).toHaveLength(1);
  });
  test('旧兼容镜像失败不会撤销已保存的布局库', () => {
    const storage = memory(), layouts = new Layouts(storage); storage.failOn(STORAGE_KEY);
    const item = layouts.create('仍可保存'); expect(parseLayouts(storage.getItem(LAYOUTS_KEY)!).some(layout => layout.id === item.id)).toBe(true);
    expect(new Layouts(storage).current.id).toBe(item.id);
  });
  test('布局库校验版本、时间、重复 ID、空库和数量上限', () => {
    const layouts = new Layouts(memory()), item = layouts.current, serialize = (items: unknown[]) => JSON.stringify({ schemaVersion: 1, items });
    expect(() => parseLayouts('{}')).toThrow(); expect(() => parseLayouts(serialize([]))).toThrow();
    expect(() => parseLayouts(serialize([item, item]))).toThrow(); expect(() => parseLayouts(serialize([{ ...item, updatedAt: '昨天' }]))).toThrow();
    expect(() => parseLayouts(serialize([{ ...item, name: '' }]))).toThrow();
    expect(() => parseLayouts(serialize(Array.from({ length: MAX_LAYOUTS + 1 }, (_, i) => ({ ...item, id: `id-${i}` }))))).toThrow();
    expect(() => parseLayouts(serialize([{ ...item, document: {} }]))).toThrow();
  });
});
