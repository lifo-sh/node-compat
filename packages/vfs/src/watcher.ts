import type { VFSWatchEvent, VFSWatchListener, VFSWatchHandle } from "./types.js";

export class VFSEventEmitter {
  private listeners: Map<string, Set<VFSWatchListener>> = new Map();
  private globalListeners: Set<VFSWatchListener> = new Set();

  emit(event: VFSWatchEvent): void {
    // Notify path-specific listeners
    const pathListeners = this.listeners.get(event.path);
    if (pathListeners) {
      for (const listener of pathListeners) {
        listener(event);
      }
    }

    // Notify listeners watching parent directories (recursive watch)
    for (const [watchPath, listeners] of this.listeners) {
      if (watchPath !== event.path && event.path.startsWith(watchPath + "/")) {
        for (const listener of listeners) {
          listener(event);
        }
      }
    }

    // Notify global listeners
    for (const listener of this.globalListeners) {
      listener(event);
    }
  }

  /** Watch a specific path (and its subtree) */
  watch(path: string, listener: VFSWatchListener): VFSWatchHandle {
    let listeners = this.listeners.get(path);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(path, listeners);
    }
    listeners.add(listener);

    return {
      close: () => {
        listeners!.delete(listener);
        if (listeners!.size === 0) {
          this.listeners.delete(path);
        }
      },
    };
  }

  /** Watch a specific file only (no subtree) */
  watchFile(path: string, listener: VFSWatchListener): VFSWatchHandle {
    let listeners = this.listeners.get(path);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(path, listeners);
    }

    const filteredListener: VFSWatchListener = (event) => {
      if (event.path === path) {
        listener(event);
      }
    };

    listeners.add(filteredListener);

    return {
      close: () => {
        listeners!.delete(filteredListener);
        if (listeners!.size === 0) {
          this.listeners.delete(path);
        }
      },
    };
  }
}
