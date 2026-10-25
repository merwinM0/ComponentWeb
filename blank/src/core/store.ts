import { initialDocument, parseDocument, type Document } from './model';

// 保留原存储键以发现旧布局；v1 / v2 / v3 文档兼容迁移为 v4。
export const STORAGE_KEY = 'componentweb.document.v1';

export interface StorePort {
  readonly contextToken?: object;
  readonly doc: Document;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  subscribe(listener: () => void): () => unknown;
  commit(doc: Document, appearanceBefore?: Document['appearance']): void;
  undo(): void;
  redo(): void;
}

export class Store implements StorePort {
  doc: Document;
  private past: Document[] = [];
  private future: Document[] = [];
  private listeners = new Set<() => void>();

  constructor(doc = initialDocument()) { this.doc = structuredClone(doc); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { this.listeners.forEach(listener => listener()); }
  commit(doc: Document, appearanceBefore?: Document['appearance']) {
    // 网格外观独立于布局；配色操作的撤销基线应是用户刚才看见的颜色。
    const previous = appearanceBefore ? { ...this.doc, appearance: appearanceBefore } : this.doc;
    if (JSON.stringify(doc) === JSON.stringify(previous)) return;
    this.past.push(structuredClone(previous));
    if (this.past.length > 80) this.past.shift();
    this.doc = structuredClone(doc);
    this.future = [];
    this.notify();
  }
  undo() {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.doc);
    this.doc = previous;
    this.notify();
  }
  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.doc);
    this.doc = next;
    this.notify();
  }
}

export function loadDocument(): { doc: Document; warning?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { doc: raw ? parseDocument(raw) : initialDocument() };
  } catch {
    return { doc: initialDocument(), warning: '无法读取本地记录，已载入示例；编辑后将尝试保存新记录。' };
  }
}

export function saveDocument(doc: Document): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); return true; }
  catch { return false; }
}
