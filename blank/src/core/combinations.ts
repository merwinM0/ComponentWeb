import { groupNodes, cloneForest } from './operations';
import { parseDocument, type Document } from './model';
import { topSelection } from './tree';

export const COMBINATIONS_KEY = 'componentweb.combinations.v1';
export interface SavedCombination { id: string; name: string; createdAt: string; document: Document }
export function captureCombination(doc: Document, ids: Iterable<string>): Document {
  const roots = topSelection(doc.nodes, ids);
  if (!roots.length) throw new Error('请先选择要保存的组件');
  let nodes = doc.nodes;
  let selected = roots.map(node => node.id);
  if (roots.length > 1) {
    const grouped = groupNodes(nodes, selected);
    nodes = grouped.nodes; selected = [grouped.container.id];
  }
  const cloned = cloneForest(nodes, selected);
  const root = cloned.nodes.find(node => node.id === cloned.roots[0])!;
  root.col = 0; root.row = 0; root.parentId = null;
  return parseDocument(JSON.stringify({ ...doc, nodes: cloned.nodes }));
}
export class Combinations {
  items: SavedCombination[] = [];
  warning = '';
  private listeners = new Set<() => void>();
  private storage?: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try {
      this.storage = storage ?? localStorage;
      const raw = this.storage.getItem(COMBINATIONS_KEY);
      if (!raw) return;
      const value = JSON.parse(raw);
      if (!Array.isArray(value) || value.length > 50) throw new Error('组合格式无效');
      const ids = new Set<string>();
      this.items = value.map(item => {
        if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || typeof item.createdAt !== 'string') throw new Error('组合信息无效');
        ids.add(item.id);
        const doc = parseDocument(JSON.stringify(item.document));
        if (topSelection(doc.nodes, doc.nodes.map(node => node.id)).length !== 1) throw new Error('组合必须有一个根组件');
        return { id: item.id, name: item.name, createdAt: item.createdAt, document: doc };
      });
    } catch { this.items = []; this.warning = '我的组合读取失败，原存储未修改；保存新组合前请确认浏览器记录。'; }
  }
  subscribe(listener: () => void) { this.listeners.add(listener); }
  private replace(items: SavedCombination[]) {
    try { if (!this.storage) throw new Error('unavailable'); this.storage.setItem(COMBINATIONS_KEY, JSON.stringify(items)); }
    catch { throw new Error('保存组合失败，请检查浏览器存储权限和剩余空间'); }
    this.items = items; this.listeners.forEach(listener => listener());
  }
  save(name: string, document: Document) {
    const clean = name.trim();
    if (!clean || clean.length > 60) throw new Error('组合名称需为 1～60 个字符');
    if (this.items.length >= 50) throw new Error('最多保存 50 个组合，请先删除不需要的组合');
    const snapshot = parseDocument(JSON.stringify(document));
    if (topSelection(snapshot.nodes, snapshot.nodes.map(node => node.id)).length !== 1) throw new Error('组合根组件无效');
    this.replace([...this.items, { id: crypto.randomUUID(), name: clean, createdAt: new Date().toISOString(), document: snapshot }]);
  }
  rename(id: string, name: string) {
    const clean = name.trim();
    if (!clean || clean.length > 60) throw new Error('组合名称需为 1～60 个字符');
    this.replace(this.items.map(item => item.id === id ? { ...item, name: clean } : item));
  }
  remove(id: string) { this.replace(this.items.filter(item => item.id !== id)); }
}
