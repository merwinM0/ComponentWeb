import { initialDocument, parseDocument, type Document } from './model';
import { STORAGE_KEY } from './store';

export const LAYOUTS_KEY = 'componentweb.layouts.v1';
export const MAX_LAYOUTS = 100;
export interface SavedLayout { id: string; name: string; createdAt: string; updatedAt: string; document: Document }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const snapshot = (doc: Document) => parseDocument(JSON.stringify(doc));
const nameOf = (name: string) => { const clean = name.trim(); if (!clean || clean.length > 60) throw new Error('布局名称需为 1～60 个字符'); return clean; };

export function parseLayouts(raw: string): SavedLayout[] {
  const data = JSON.parse(raw);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.items) || !data.items.length || data.items.length > MAX_LAYOUTS) throw new Error('布局库格式无效');
  const ids = new Set<string>();
  return data.items.map((item: SavedLayout) => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.name !== 'string' ||
      ![item.createdAt, item.updatedAt].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))) throw new Error('布局信息无效');
    ids.add(item.id);
    return { id: item.id, name: nameOf(item.name), createdAt: new Date(item.createdAt).toISOString(), updatedAt: new Date(item.updatedAt).toISOString(), document: snapshot(item.document) };
  });
}

/** 布局库是持久化来源；当前选择只存在内存，启动始终打开最近修改的一份。 */
export class Layouts {
  items: SavedLayout[] = [];
  currentId = '';
  warning = '';
  private storage?: StoragePort;
  private listeners = new Set<() => void>();
  constructor(storage?: StoragePort) {
    let doc = initialDocument();
    try {
      this.storage = storage ?? localStorage;
      const raw = this.storage.getItem(LAYOUTS_KEY);
      if (raw !== null) {
        this.items = parseLayouts(raw); this.currentId = this.sorted[0]!.id; this.mirror(); return;
      }
      const legacy = this.storage.getItem(STORAGE_KEY); if (legacy) doc = parseDocument(legacy);
    } catch {
      this.warning = '布局库读取失败，原记录未修改；已尝试恢复旧工作区。';
      try { const raw = this.storage?.getItem(STORAGE_KEY); if (raw) doc = parseDocument(raw); } catch { /* 无法恢复时保留示例。 */ }
    }
    const now = new Date().toISOString();
    this.items = [{ id: crypto.randomUUID(), name: '默认布局', createdAt: now, updatedAt: now, document: doc }]; this.currentId = this.items[0]!.id;
    if (!this.warning) {
      try { this.replace(this.items); } catch { this.warning = '布局尚未保存，请检查浏览器存储权限和剩余空间。'; }
    }
  }
  get current() { return this.items.find(item => item.id === this.currentId)!; }
  get sorted() { return [...this.items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { this.listeners.forEach(listener => listener()); }
  private timestamp() { return new Date(Math.max(Date.now(), ...this.items.map(item => Date.parse(item.updatedAt) + 1))).toISOString(); }
  private mirror() {
    // 旧键仅作兼容镜像；镜像失败不撤销已经成功写入的布局库。
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.current.document)); } catch { /* 布局库仍是唯一持久化来源。 */ }
  }
  private replace(items: SavedLayout[], currentId = this.currentId) {
    try {
      if (!this.storage) throw new Error('unavailable');
      this.storage.setItem(LAYOUTS_KEY, JSON.stringify({ schemaVersion: 1, items }));
    } catch { throw new Error('保存布局失败，请检查浏览器存储权限和剩余空间'); }
    this.items = items; this.currentId = currentId; this.warning = ''; this.mirror(); this.notify();
  }
  select(id: string) {
    if (!this.items.some(item => item.id === id)) throw new Error('布局不存在');
    if (id === this.currentId) return;
    this.currentId = id; this.mirror(); this.notify();
  }
  create(name: string) {
    const clean = nameOf(name); if (this.items.length >= MAX_LAYOUTS) throw new Error(`最多保存 ${MAX_LAYOUTS} 个布局`);
    const now = this.timestamp(), item: SavedLayout = { id: crypto.randomUUID(), name: clean, createdAt: now, updatedAt: now, document: { ...initialDocument(), nodes: [] } };
    this.replace([...this.items, item], item.id); return item;
  }
  save(id: string, doc: Document) {
    if (!this.items.some(item => item.id === id)) throw new Error('布局不存在');
    const document = snapshot(doc), updatedAt = this.timestamp();
    this.replace(this.items.map(item => item.id === id ? { ...item, updatedAt, document } : item));
  }
}
