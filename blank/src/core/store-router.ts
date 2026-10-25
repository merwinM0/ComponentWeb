import { Store, type StorePort } from './store';
import type { Document } from './types';

/** UI 只订阅这一入口；工作区和各级设计草稿分别保留自己的历史。 */
export class StoreRouter implements StorePort {
  private listeners = new Set<() => void>();
  private unsubscribe: () => unknown;
  constructor(public active: Store) { this.unsubscribe = active.subscribe(() => this.notify()); }
  get contextToken() { return this.active; }
  get doc() { return this.active.doc; }
  get canUndo() { return this.active.canUndo; }
  get canRedo() { return this.active.canRedo; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { this.listeners.forEach(listener => listener()); }
  activate(store: Store) {
    this.unsubscribe(); this.active = store; this.unsubscribe = store.subscribe(() => this.notify()); this.notify();
  }
  commit(doc: Document, appearanceBefore?: Document['appearance']) { this.active.commit(doc, appearanceBefore); }
  undo() { this.active.undo(); }
  redo() { this.active.redo(); }
}
