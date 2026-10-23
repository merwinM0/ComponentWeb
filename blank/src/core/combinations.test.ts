import { describe, expect, test } from 'bun:test';
import { captureCombination, Combinations, COMBINATIONS_KEY } from './combinations';
import { initialDocument, createNode } from './model';
import { cloneForest } from './operations';

function memory() {
  const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('我的组合', () => {
  test('保存选区和子树不修改工作区，可重命名、恢复与删除', () => {
    const storage = memory(); const saved = new Combinations(storage); const doc = initialDocument(); const original = structuredClone(doc);
    const snapshot = captureCombination(doc, doc.nodes.map(node => node.id)); expect(doc).toEqual(original); expect(snapshot.nodes.length).toBe(5); expect(snapshot.nodes.filter(node => !node.parentId).length).toBe(1);
    saved.save('我的模块', snapshot); expect(saved.items.length).toBe(1); expect(storage.data.has(COMBINATIONS_KEY)).toBe(true);
    saved.rename(saved.items[0].id, '<b>只是名称</b>'); expect(new Combinations(storage).items[0].name).toBe('<b>只是名称</b>');
    const a = cloneForest(snapshot.nodes, snapshot.nodes.filter(node => !node.parentId).map(node => node.id)); const b = cloneForest(snapshot.nodes, snapshot.nodes.filter(node => !node.parentId).map(node => node.id));
    expect(a.nodes.every(node => !b.nodes.some(other => other.id === node.id))).toBe(true);
    a.nodes[0].props.title = '单独改动'; expect(b.nodes[0].props.title).not.toBe('单独改动');
    saved.remove(saved.items[0].id); expect(new Combinations(storage).items).toEqual([]);
  });
  test('存储失败不伪报成功，也不修改内存', () => {
    const saved = new Combinations({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
    const node = createNode('basic.button'); const snapshot = { ...initialDocument(), nodes: [node] };
    expect(() => saved.save('模块', snapshot)).toThrow('保存组合失败'); expect(saved.items).toEqual([]);
  });
  test('空选区、无效名称与损坏记录被处理', () => {
    expect(() => captureCombination(initialDocument(), [])).toThrow();
    const storage = memory(); storage.data.set(COMBINATIONS_KEY, '{bad'); const saved = new Combinations(storage); expect(saved.warning).not.toBe(''); expect(storage.data.get(COMBINATIONS_KEY)).toBe('{bad');
    const doc = initialDocument(); const snapshot = captureCombination(doc, [doc.nodes[0].id]); expect(() => saved.save(' ', snapshot)).toThrow(); expect(() => saved.save('x'.repeat(61), snapshot)).toThrow();
  });
});
