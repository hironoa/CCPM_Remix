import { PersistenceAdapter, ProjectInfo } from "./types";

const LOCAL_STORAGE_KEY = "applet-ccpm-data";

export class LocalStorageAdapter implements PersistenceAdapter {
  id = "local";
  name = "ローカル（ブラウザ）";
  description = "現在のブラウザ内にデータを保存します。共有はできません。";

  isReady(): boolean {
    return typeof window !== "undefined";
  }

  async listProjects(): Promise<ProjectInfo[]> {
    const projectsStr = localStorage.getItem("ccpm_projects");
    if (projectsStr) {
      try {
        return JSON.parse(projectsStr);
      } catch (e) {
        console.error(e);
      }
    }
    // Backward compatibility: If there is an old single file data, treat it as "Default Project"
    const oldData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (oldData) {
      const defaultProject = { id: "default", name: "Default Project" };
      localStorage.setItem("ccpm_projects", JSON.stringify([defaultProject]));
      localStorage.setItem("ccpm_project_default", oldData);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return [defaultProject];
    }
    return [];
  }

  async loadProject(id: string): Promise<any | null> {
    const dataStr = localStorage.getItem(`ccpm_project_${id}`);
    if (!dataStr) return null;
    try {
      return JSON.parse(dataStr);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async saveProject(id: string, name: string, data: any): Promise<void> {
    const projects = await this.listProjects();
    const existing = projects.find(p => p.id === id);
    if (!existing) {
      projects.push({ id, name });
    } else if (existing.name !== name) {
      existing.name = name;
    }
    localStorage.setItem("ccpm_projects", JSON.stringify(projects));
    localStorage.setItem(`ccpm_project_${id}`, JSON.stringify(data));
  }

  async deleteProject(id: string): Promise<void> {
    const projects = await this.listProjects();
    const updated = projects.filter(p => p.id !== id);
    localStorage.setItem("ccpm_projects", JSON.stringify(updated));
    localStorage.removeItem(`ccpm_project_${id}`);
  }

  async loadGlobalUsers(): Promise<any[]> {
    const usersStr = localStorage.getItem("ccpm_global_users");
    if (!usersStr) return [];
    try {
      return JSON.parse(usersStr);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async saveGlobalUsers(users: any[]): Promise<void> {
    localStorage.setItem("ccpm_global_users", JSON.stringify(users));
  }

  async load(): Promise<any | null> {
    if (typeof window === "undefined") return null;
    const projects = await this.listProjects();
    if (projects.length > 0) {
      return await this.loadProject(projects[0].id);
    }
    return null;
  }

  async save(data: any): Promise<void> {
    if (typeof window === "undefined") return;
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

