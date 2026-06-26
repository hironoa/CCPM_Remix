import { PersistenceAdapter, ProjectInfo } from "./types";

export class FileStorageAdapter implements PersistenceAdapter {
  id = "file";
  name = "ワークスペース (フォルダ)";
  description = "PC上のフォルダを指定し、プロジェクトごとにJSONファイルを保存します。";

  private dirHandle: FileSystemDirectoryHandle | null = null;
  private isConnecting = false;

  isReady(): boolean {
    return this.dirHandle !== null;
  }

  async connect(): Promise<void> {
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
      throw new Error("お使いのブラウザはFile System Access APIをサポートしていません。別のブラウザをお試しください。");
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error("フォルダ選択がキャンセルされました。");
      }
      
      // iFrameなどのセキュリティ制限で失敗した場合、OPFS（Origin Private File System）へのフォールバックを試みる
      if (e.message && (e.message.includes('SecurityError') || e.message.toLowerCase().includes('cross origin') || e.message.toLowerCase().includes('must be executing'))) {
        try {
          console.log("Falling back to Origin Private File System (OPFS) due to browser restrictions.");
          this.dirHandle = await navigator.storage.getDirectory();
          alert("プレビュー環境（iFrame）の制限により、PCの直接フォルダの代わりにブラウザ内部のプライベートフォルダ（OPFS）を使用します。\n※ このデータはブラウザのキャッシュをクリアすると消去される場合があります。");
          return;
        } catch (opfsError) {
          console.error("OPFS fallback failed:", opfsError);
          throw new Error("プレビュー環境のセキュリティ制限によりフォルダを選択できず、代替ストレージ（OPFS）の取得にも失敗しました。\n右上の「別タブで開く」ボタンから新しいタブで開いてお試しください。");
        }
      }
      throw e;
    } finally {
      this.isConnecting = false;
    }
  }

  async listProjects(): Promise<ProjectInfo[]> {
    if (!this.dirHandle) return [];
    
    // First, try to read workspace_meta.json
    try {
      const fileHandle = await this.dirHandle.getFileHandle("workspace_meta.json", { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const meta = JSON.parse(text);
      if (meta && meta.projects) {
        return meta.projects;
      }
    } catch (e) {
      // File might not exist
    }

    // Fallback: list all JSON files that start with project_
    const projects: ProjectInfo[] = [];
    for await (const entry of (this.dirHandle as any).values()) {
      if (entry.kind === "file" && entry.name.startsWith("project_") && entry.name.endsWith(".json")) {
        const id = entry.name.replace("project_", "").replace(".json", "");
        projects.push({ id, name: `Project ${id}` }); // We don't know the exact name without reading
      }
    }
    return projects;
  }

  private async saveWorkspaceMeta(projects: ProjectInfo[]): Promise<void> {
    if (!this.dirHandle) return;
    try {
      const fileHandle = await this.dirHandle.getFileHandle("workspace_meta.json", { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(JSON.stringify({ projects }, null, 2));
      await writable.close();
    } catch (e) {
      console.error("Failed to save workspace meta", e);
    }
  }

  async loadProject(id: string): Promise<any | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`project_${id}.json`, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to load project ${id}`, e);
      return null;
    }
  }

  async saveProject(id: string, name: string, data: any): Promise<void> {
    if (!this.dirHandle) return;
    
    // Update meta
    const projects = await this.listProjects();
    const existing = projects.find(p => p.id === id);
    if (!existing) {
      projects.push({ id, name });
      await this.saveWorkspaceMeta(projects);
    } else if (existing.name !== name) {
      existing.name = name;
      await this.saveWorkspaceMeta(projects);
    }

    try {
      const fileHandle = await this.dirHandle.getFileHandle(`project_${id}.json`, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (e) {
      console.error(`Failed to save project ${id}`, e);
    }
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.dirHandle) return;
    try {
      await this.dirHandle.removeEntry(`project_${id}.json`);
      
      const projects = await this.listProjects();
      const updated = projects.filter(p => p.id !== id);
      await this.saveWorkspaceMeta(updated);
    } catch (e) {
      console.error(`Failed to delete project ${id}`, e);
    }
  }

  async loadGlobalUsers(): Promise<any[]> {
    if (!this.dirHandle) return [];
    try {
      const fileHandle = await this.dirHandle.getFileHandle("global_users.json", { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (e) {
      return [];
    }
  }

  async saveGlobalUsers(users: any[]): Promise<void> {
    if (!this.dirHandle) return;
    try {
      const fileHandle = await this.dirHandle.getFileHandle("global_users.json", { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(JSON.stringify(users, null, 2));
      await writable.close();
    } catch (e) {
      console.error("Failed to save global users", e);
    }
  }

  async load(): Promise<any | null> {
    const projects = await this.listProjects();
    if (projects.length > 0) {
      return await this.loadProject(projects[0].id);
    }
    return null;
  }

  async save(data: any): Promise<void> {
    const projects = await this.listProjects();
    let id = "default";
    let name = "Default Project";
    if (projects.length > 0) {
      id = projects[0].id;
      name = projects[0].name;
    }
    await this.saveProject(id, name, data);
  }
}

