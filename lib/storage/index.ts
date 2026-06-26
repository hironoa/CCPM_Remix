import { PersistenceAdapter } from "./types";
import { LocalStorageAdapter } from "./local-adapter";
import { FileStorageAdapter } from "./file-adapter";

export class StorageManager {
  private activeAdapter!: PersistenceAdapter;
  public readonly adapters: PersistenceAdapter[];

  constructor() {
    this.adapters = [
      new LocalStorageAdapter(),
      new FileStorageAdapter(),
      // ここに将来、CloudSQLAdapter や FirebaseAdapter を追加しやすくなっています。
    ];

    // デフォルトはローカルストレージ
    this.activeAdapter = this.adapters[0];
  }

  getAdapter(): PersistenceAdapter {
    return this.activeAdapter;
  }

  async setAdapter(adapterId: string): Promise<void> {
    const target = this.adapters.find(a => a.id === adapterId);
    if (!target) throw new Error(`Adapter ${adapterId} not found`);
    
    // アダプタにコネクト処理が必要な場合は実行する
    if (target.connect) {
      await target.connect();
    }
    
    if (target.isReady()) {
      this.activeAdapter = target;
    } else {
      throw new Error(`Failed to activate adapter ${adapterId}`);
    }
  }
  
  // Removed setFileAdapterNew


  getActiveAdapterId() {
    return this.activeAdapter.id;
  }
}

export const storageManager = new StorageManager();
