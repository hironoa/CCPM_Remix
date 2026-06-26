import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import * as JapaneseHolidays from "japanese-holidays";
import { storageManager } from "./storage";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType = "regular" | "project_buffer" | "feeding_buffer";

export interface Task {
  id: string;
  name: string;
  duration: number; // in hours (not days)
  status: TaskStatus;
  type: TaskType;
  predecessors: string[]; // task ids
  resourceId?: string;
  progress: number; // 0 to 100
  actualDuration?: number; // 実績工数
  remainingDuration?: number; // 残り工数
  originalEstimate?: number; // 自動計画前の元の見積もり(CCPMの安全余裕算出用)
  originalBufferDuration?: number; // Project buffer total hours (for UI)
  parentId?: string; // For nested WBS
  isExpanded?: boolean;
  manualStartDate?: Date; // 手動配置用オフセット
  manualEndDate?: Date; // 手動配置用の終了日
  position?: { x: number; y: number }; // PERT図での明示的な座標
  // Calculated fields
  startDate?: Date;
  endDate?: Date;
  earlyStart?: Date;
  earlyFinish?: Date;
  lateStart?: Date;
  lateFinish?: Date;
  slack?: number;
  isCritical?: boolean;
  calculatedFeedingBuffer?: number;
}

export interface Resource {
  id: string;
  name: string;
  capacity: number; // e.g., max tasks per day
  productivity?: number; // >1 means higher productivity, completing 1h standard work in <1h
  role?: string;
}

export interface DailyLog {
  id: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  hours: number;
  startTime?: number; // Added for schedule view
  resourceId?: string; // Who logged the hours
}

export interface TaskStatusLog {
  id: string;
  taskId: string;
  date: string;
  progress: number;
  remainingDuration: number;
}

export interface ColumnDef {
  id: string;
  label: string;
  width: number;
  visible: boolean;
}

export interface ProjectVersion {
  id: string;
  timestamp: string;
  author: string;
  message: string;
  data: any;
}

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface GlobalUser {
  id: string;
  name: string;
  role?: string;
  defaultCapacity?: number;
}

export interface State {
  globalUsers: GlobalUser[];
  projects: ProjectInfo[];
  currentProjectId: string | null;
  currentProjectName: string | null;
  
  tasks: Task[];
  resources: Resource[];
  dailyLogs: DailyLog[];
  taskStatusLogs: TaskStatusLog[];
  feverHistory: {
    date: string;
    ccProgress: number;
    bufferConsumption: number;
    pv?: number;
    ev?: number;
    ac?: number;
  }[];
  feverZones: {
    startRed: number;
    startYellow: number;
    endRed: number;
    endYellow: number;
  };
  versions: ProjectVersion[];
  currentUser: string;
  isLoading: boolean;
  activeView:
    | "dashboard"
    | "wbs"
    | "gantt"
    | "pert"
    | "kanban"
    | "fever"
    | "resources"
    | "evm"
    | "scrum"
    | "timesheet"
    | "logs"
    | "versions";
  projectStartDate: Date;
  workingHoursPerDay: number;
  bufferConfig: {
    type: "ratio" | "hours" | "endDate";
    ratio: number;
    hours: number;
    endDate: Date | null;
    feedingBufferRatio: number; // 自動配置時の%
    feedingBufferMode: "task" | "edge"; // 案1か案2か
  };
  ganttSettings: {
    viewMode: "wbs" | "resource";
    columns: ColumnDef[];
    collapsedTasks: string[];
    selectedResources: string[];
  };
  // Workspace Actions
  loadWorkspace: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  updateProjectName: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Global Users Actions
  addGlobalUser: (user: Partial<GlobalUser>) => Promise<void>;
  updateGlobalUser: (id: string, updates: Partial<GlobalUser>) => Promise<void>;
  deleteGlobalUser: (id: string) => Promise<void>;
  
  // Actions
  saveData: () => Promise<void>;
  loadSampleData: () => void;
  setCurrentUser: (name: string) => void;
  restoreVersion: (id: string) => void;
  setGanttSettings: (settings: Partial<State["ganttSettings"]>) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  setProjectStartDate: (date: Date) => void;
  setWorkingHoursPerDay: (hours: number) => void;
  setBufferConfig: (config: Partial<State["bufferConfig"]>) => void;
  setFeverZones: (zones: Partial<State["feverZones"]>) => void;
  autoPlaceFeedingBuffers: () => void;
  getProjectBufferHours: () => number;
  addTask: (task: Partial<Task>) => void;
  addTasks: (tasks: Partial<Task>[]) => void;
  updateTask: (
    id: string,
    updates: Partial<Task> & { asOfDate?: string },
  ) => void;
  reorderTask: (
    sourceId: string,
    targetId: string,
    position: "before" | "after" | "inside",
  ) => void;
  reorderTasksMulti: (
    sourceIds: string[],
    targetId: string,
    position: "before" | "after" | "inside",
  ) => void;
  deleteTask: (id: string) => void;
  autoSchedule: (options?: { reduceEstimateRatio?: number }) => void;
  addResource: (resource: Partial<Resource>) => void;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  deleteResource: (id: string) => void;
  updateDailyLog: (
    taskId: string,
    date: string,
    hours: number,
    startTime?: number,
    resourceId?: string,
  ) => void;
  addDailyLog: (
    taskId: string,
    date: string,
    hours: number,
    startTime: number,
    resourceId?: string,
  ) => void;
  updateDailyLogById: (logId: string, hours: number, startTime: number) => void;
  removeDailyLogById: (logId: string) => void;
  updateTaskStatusLog: (
    taskId: string,
    date: string,
    progress: number,
    remainingDuration: number,
  ) => void;
  recordFeverSnapshot: (skipSave?: boolean, targetDateStr?: string) => void;
  setActiveView: (view: State["activeView"]) => void;
  recalculateSchedule: (projectStartDate: Date) => void;
  storageProviderId: string;
  switchStorageProvider: (id: string, isNew?: boolean) => Promise<void>;
}

export const isWorkingDay = (d: Date): boolean => {
  if (isNaN(d.getTime())) return true; // Prevent infinite loop if invalid
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  if (JapaneseHolidays.isHoliday(d)) return false;
  return true;
};

export const snapToWorkingDay = (timeMs: number): number => {
  if (isNaN(timeMs)) return timeMs;
  let d = new Date(timeMs);
  while (!isWorkingDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
};

export const snapToWorkingDayBackward = (timeMs: number): number => {
  if (isNaN(timeMs)) return timeMs;
  let d = new Date(timeMs);
  while (!isWorkingDay(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d.getTime();
};

export const addWorkingHoursMs = (
  startMs: number,
  hours: number,
  customWorkingHoursPerDay?: number,
): number => {
  if (isNaN(startMs) || isNaN(hours)) return startMs;
  if (hours <= 0) return snapToWorkingDay(startMs);
  let current = new Date(startMs);
  const workingHoursPerDay =
    customWorkingHoursPerDay || useStore.getState().workingHoursPerDay || 6;
  let targetAddedMs = (hours / workingHoursPerDay) * 24 * 60 * 60 * 1000;

  while (targetAddedMs > 0) {
    let startOfDay = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
    );
    let endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    let available = endOfDay.getTime() - current.getTime();

    if (isWorkingDay(startOfDay)) {
      if (targetAddedMs <= available) {
        current.setTime(current.getTime() + targetAddedMs);
        targetAddedMs = 0;
      } else {
        targetAddedMs -= available;
        current.setTime(endOfDay.getTime());
      }
    } else {
      current.setTime(endOfDay.getTime());
    }
  }
  return current.getTime();
};

export const subWorkingHoursMs = (
  endMs: number,
  hours: number,
  customWorkingHoursPerDay?: number,
): number => {
  if (isNaN(endMs) || isNaN(hours)) return endMs;
  if (hours <= 0) return snapToWorkingDayBackward(endMs);
  let current = new Date(endMs);
  const workingHoursPerDay =
    customWorkingHoursPerDay || useStore.getState().workingHoursPerDay || 6;
  let targetSubMs = (hours / workingHoursPerDay) * 24 * 60 * 60 * 1000;

  while (targetSubMs > 0) {
    let startOfDay = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
    );
    let available = current.getTime() - startOfDay.getTime();

    if (available === 0) {
      current.setDate(current.getDate() - 1);
      startOfDay = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
      );
      current = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      available = 24 * 60 * 60 * 1000;
    }

    if (isWorkingDay(startOfDay)) {
      if (targetSubMs <= available) {
        current.setTime(current.getTime() - targetSubMs);
        targetSubMs = 0;
      } else {
        targetSubMs -= available;
        current.setTime(startOfDay.getTime());
      }
    } else {
      current.setTime(startOfDay.getTime());
    }
  }
  return current.getTime();
};

export const getWorkingHoursDiff = (startMs: number, endMs: number): number => {
  if (isNaN(startMs) || isNaN(endMs)) return 0;
  if (startMs > endMs) return -getWorkingHoursDiff(endMs, startMs);

  let current = new Date(startMs);
  let totalWorkingMs = 0;
  const workingHoursPerDay = useStore.getState().workingHoursPerDay || 6;

  while (current.getTime() < endMs) {
    let startOfDay = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
    );
    let endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    let chunkEnd = Math.min(endMs, endOfDay.getTime());
    let chunkDuration = chunkEnd - current.getTime();

    if (isWorkingDay(startOfDay)) {
      totalWorkingMs += chunkDuration;
    }

    current.setTime(chunkEnd);
  }

  return (totalWorkingMs / (24 * 60 * 60 * 1000)) * workingHoursPerDay;
};

const computeTaskStatus = (
  taskId: string,
  currentTask: Task,
  dailyLogs: DailyLog[],
  taskStatusLogs: TaskStatusLog[],
): Task => {
  const tDailyLogs = dailyLogs.filter((l) => l.taskId === taskId);
  const actualDuration = tDailyLogs.reduce((acc, l) => acc + l.hours, 0);

  const tStatusLogs = taskStatusLogs
    .filter((l) => l.taskId === taskId)
    .sort((a, b) => b.date.localeCompare(a.date));
  let computedProgress = 0;
  let remainingDuration = 0;

  if (tStatusLogs.length > 0) {
    const latestStatusLog = tStatusLogs[0];
    const postLogHours = tDailyLogs
      .filter((l) => l.date > latestStatusLog.date)
      .reduce((acc, l) => acc + l.hours, 0);
    remainingDuration = Math.max(
      0,
      latestStatusLog.remainingDuration - postLogHours,
    );
    if (postLogHours === 0) {
      computedProgress = latestStatusLog.progress;
    } else {
      const expected = actualDuration + remainingDuration;
      computedProgress =
        expected > 0 ? Math.round((actualDuration / expected) * 100) : 0;
    }
  } else {
    remainingDuration = Math.max(
      0,
      (currentTask.duration || 0) - actualDuration,
    );
    const expected = actualDuration + remainingDuration;
    computedProgress =
      expected > 0 ? Math.round((actualDuration / expected) * 100) : 0;
  }

  let progress = computedProgress;

  if (progress >= 100) {
    progress = 100;
    remainingDuration = 0;
  }

  let status = currentTask.status;
  if (progress >= 100) status = "done";
  else if (progress > 0 && status === "todo") status = "in_progress";
  else if (progress < 100 && status === "done") status = "in_progress";

  if (
    currentTask.status === "done" &&
    currentTask.progress === 100 &&
    progress === 100
  ) {
    status = "done";
  }

  return {
    ...currentTask,
    actualDuration,
    remainingDuration,
    progress,
    status,
  };
};

export const defaultGanttColumns: ColumnDef[] = [
  { id: "name", label: "タスク名", width: 240, visible: true },
  { id: "startDate", label: "開始日", width: 85, visible: false },
  { id: "endDate", label: "終了日", width: 85, visible: false },
  { id: "resource", label: "担当", width: 80, visible: true },
  { id: "progress", label: "進捗", width: 64, visible: true },
  { id: "expected", label: "見積", width: 56, visible: true },
  { id: "actual", label: "実績", width: 64, visible: true },
  { id: "remaining", label: "残時間", width: 64, visible: true },
  { id: "status", label: "状態", width: 80, visible: true },
  { id: "predecessors", label: "先行タスク", width: 100, visible: true },
];

function generateDiffMessage(oldData: any, newData: any): string {
  if (!oldData) return "初期保存";
  const changes: string[] = [];

  const oldTaskMap = new Map(oldData.tasks?.map((t: any) => [t.id, t]) || []);
  const newTaskMap = new Map(newData.tasks?.map((t: any) => [t.id, t]) || []);
  let addedTasks = 0, removedTasks = 0, updatedTasks = 0;
  for (const t of newData.tasks || []) {
    if (!oldTaskMap.has(t.id)) addedTasks++;
    else if (JSON.stringify(oldTaskMap.get(t.id)) !== JSON.stringify(t)) updatedTasks++;
  }
  for (const t of oldData.tasks || []) {
    if (!newTaskMap.has(t.id)) removedTasks++;
  }
  if (addedTasks > 0) changes.push(`タスク追加(${addedTasks})`);
  if (removedTasks > 0) changes.push(`タスク削除(${removedTasks})`);
  if (updatedTasks > 0) changes.push(`タスク更新(${updatedTasks})`);

  const oldLogMap = new Map(oldData.dailyLogs?.map((l: any) => [l.id, l]) || []);
  const newLogMap = new Map(newData.dailyLogs?.map((l: any) => [l.id, l]) || []);
  let addedLogs = 0, removedLogs = 0, updatedLogs = 0;
  for (const l of newData.dailyLogs || []) {
    if (!oldLogMap.has(l.id)) addedLogs++;
    else if (JSON.stringify(oldLogMap.get(l.id)) !== JSON.stringify(l)) updatedLogs++;
  }
  for (const l of oldData.dailyLogs || []) {
    if (!newLogMap.has(l.id)) removedLogs++;
  }
  if (addedLogs > 0) changes.push(`実績追加(${addedLogs})`);
  if (removedLogs > 0) changes.push(`実績削除(${removedLogs})`);
  if (updatedLogs > 0) changes.push(`実績更新(${updatedLogs})`);

  const oldResMap = new Map(oldData.resources?.map((r: any) => [r.id, r]) || []);
  const newResMap = new Map(newData.resources?.map((r: any) => [r.id, r]) || []);
  let addedRes = 0, removedRes = 0, updatedRes = 0;
  for (const r of newData.resources || []) {
    if (!oldResMap.has(r.id)) addedRes++;
    else if (JSON.stringify(oldResMap.get(r.id)) !== JSON.stringify(r)) updatedRes++;
  }
  for (const r of oldData.resources || []) {
    if (!newResMap.has(r.id)) removedRes++;
  }
  if (addedRes > 0) changes.push(`リソース追加(${addedRes})`);
  if (removedRes > 0) changes.push(`リソース削除(${removedRes})`);
  if (updatedRes > 0) changes.push(`リソース更新(${updatedRes})`);

  if (oldData.projectStartDate !== newData.projectStartDate) {
    changes.push(`開始日変更`);
  }

  if (changes.length === 0) return "その他の設定変更";
  return changes.join(", ");
}

export const defaultGanttSettings = {
  viewMode: "wbs" as const,
  columns: defaultGanttColumns,
  collapsedTasks: [] as string[],
  selectedResources: [] as string[],
};

let saveTimeout: NodeJS.Timeout | null = null;

export const useStore = create<State>((set, get) => ({
  globalUsers: [],
  projects: [],
  currentProjectId: null,
  currentProjectName: null,
  
  tasks: [],
  resources: [],
  dailyLogs: [],
  taskStatusLogs: [],
  feverHistory: [],
  feverZones: {
    startRed: 10,
    startYellow: 5,
    endRed: 80,
    endYellow: 60,
  },
  versions: [],
  currentUser: typeof window !== "undefined" ? localStorage.getItem("ccpm_current_user") || "Local User" : "Local User",
  isLoading: true,
  activeView: "dashboard",
  ganttSettings: {
    viewMode: "wbs",
    columns: defaultGanttColumns,
    collapsedTasks: [],
    selectedResources: [],
  },
  projectStartDate: new Date(new Date().setHours(0, 0, 0, 0)),
  workingHoursPerDay: 6,
  bufferConfig: {
    type: "ratio",
    ratio: 50,
    hours: 80, // Default some hours
    endDate: null,
    feedingBufferRatio: 50,
    feedingBufferMode: "task",
  },
  storageProviderId: "local",

  switchStorageProvider: async (id: string, isNew?: boolean) => {
    try {
      await storageManager.setAdapter(id);
      set({ isLoading: true });
      set({ storageProviderId: storageManager.getActiveAdapterId() });
      await get().loadWorkspace();
    } catch (e: any) {
      console.error("ストレージ変更に失敗しました", e);
      alert(`ストレージの変更に失敗しました。\n\n詳細: ${e.message || String(e)}`);
      // Revert select display
      set({ storageProviderId: storageManager.getActiveAdapterId() });
    } finally {
      set({ isLoading: false });
    }
  },

  loadWorkspace: async () => {
    set({ isLoading: true });
    try {
      const adapter = storageManager.getAdapter();
      const [projects, globalUsers] = await Promise.all([
        adapter.listProjects(),
        adapter.loadGlobalUsers()
      ]);
      set({ projects, globalUsers });

      const currentId = get().currentProjectId;
      if (projects.length > 0) {
        // If we have a current project, and it still exists, keep it. Otherwise select the first one.
        const projectToLoad = projects.find(p => p.id === currentId) || projects[0];
        await get().switchProject(projectToLoad.id);
      } else {
        // No projects, create a default one
        await get().createProject("新しいプロジェクト");
      }
    } catch (e) {
      console.error("Failed to load workspace", e);
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name: string) => {
    set({ isLoading: true });
    const id = uuidv4();
    const adapter = storageManager.getAdapter();
    
    // Default project state
    const data = {
      tasks: [],
      resources: [],
      dailyLogs: [],
      taskStatusLogs: [],
      feverHistory: [],
      feverZones: {
        startRed: 10,
        startYellow: 5,
        endRed: 80,
        endYellow: 60,
      },
      bufferConfig: {
        type: "ratio",
        ratio: 50,
        hours: 80,
        endDate: null,
        feedingBufferRatio: 50,
        feedingBufferMode: "task",
      },
      projectStartDate: new Date().toISOString(),
      workingHoursPerDay: 8,
      ganttSettings: defaultGanttSettings,
      versions: [],
    };
    
    await adapter.saveProject(id, name, data);
    
    const projects = await adapter.listProjects();
    set({ projects });
    await get().switchProject(id);
  },

  switchProject: async (id: string) => {
    set({ isLoading: true });
    const adapter = storageManager.getAdapter();
    const data = await adapter.loadProject(id);
    const projects = await adapter.listProjects();
    const proj = projects.find(p => p.id === id);
    
    if (data && proj) {
      // Re-hydrate dates like in fetchData
      const parsedTasks = (data.tasks || []).map((t: any) => ({
        ...t,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined,
        earlyStart: t.earlyStart ? new Date(t.earlyStart) : undefined,
        earlyFinish: t.earlyFinish ? new Date(t.earlyFinish) : undefined,
        lateStart: t.lateStart ? new Date(t.lateStart) : undefined,
        lateFinish: t.lateFinish ? new Date(t.lateFinish) : undefined,
        manualStartDate: t.manualStartDate ? new Date(t.manualStartDate) : undefined,
        manualEndDate: t.manualEndDate ? new Date(t.manualEndDate) : undefined,
      }));
      
      let parsedBufferConfig = {
        type: "ratio" as const,
        ratio: 50,
        hours: 80,
        endDate: null as Date | null,
        feedingBufferRatio: 50,
        feedingBufferMode: "task" as const,
      };
      if (data.bufferConfig) {
        parsedBufferConfig = {
          ...data.bufferConfig,
          feedingBufferRatio: data.bufferConfig.feedingBufferRatio || 50,
          feedingBufferMode: data.bufferConfig.feedingBufferMode || "task",
          endDate: data.bufferConfig.endDate ? new Date(data.bufferConfig.endDate) : null,
        };
      }

      let projectStartDate = new Date();
      if (data.projectStartDate) {
        projectStartDate = new Date(data.projectStartDate);
      } else {
        projectStartDate.setHours(0, 0, 0, 0);
      }

      set({
        currentProjectId: id,
        currentProjectName: proj.name,
        tasks: parsedTasks,
        resources: data.resources || [],
        dailyLogs: data.dailyLogs || [],
        taskStatusLogs: data.taskStatusLogs || [],
        feverHistory: data.feverHistory || [],
        feverZones: data.feverZones || { startRed: 10, startYellow: 5, endRed: 80, endYellow: 60 },
        versions: data.versions || [],
        bufferConfig: parsedBufferConfig,
        ganttSettings: data.ganttSettings || defaultGanttSettings,
        projectStartDate,
        workingHoursPerDay: data.workingHoursPerDay || 8,
        isLoading: false,
      });
      get().recalculateSchedule(projectStartDate);
    } else {
      set({ isLoading: false });
    }
  },

  updateProjectName: async (id: string, name: string) => {
    const adapter = storageManager.getAdapter();
    const data = await adapter.loadProject(id);
    if (data) {
      await adapter.saveProject(id, name, data);
      const projects = await adapter.listProjects();
      set({ projects });
      if (id === get().currentProjectId) {
        set({ currentProjectName: name });
      }
    }
  },

  deleteProject: async (id: string) => {
    const adapter = storageManager.getAdapter();
    await adapter.deleteProject(id);
    const projects = await adapter.listProjects();
    set({ projects });
    if (get().currentProjectId === id) {
      if (projects.length > 0) {
        await get().switchProject(projects[0].id);
      } else {
        await get().createProject("新しいプロジェクト");
      }
    }
  },

  addGlobalUser: async (user) => {
    const newUser = { id: uuidv4(), ...user } as GlobalUser;
    const globalUsers = [...get().globalUsers, newUser];
    set({ globalUsers });
    const adapter = storageManager.getAdapter();
    await adapter.saveGlobalUsers(globalUsers);
  },

  updateGlobalUser: async (id, updates) => {
    const globalUsers = get().globalUsers.map(u => u.id === id ? { ...u, ...updates } : u);
    set({ globalUsers });
    const adapter = storageManager.getAdapter();
    await adapter.saveGlobalUsers(globalUsers);
  },

  deleteGlobalUser: async (id) => {
    const globalUsers = get().globalUsers.filter(u => u.id !== id);
    set({ globalUsers });
    const adapter = storageManager.getAdapter();
    await adapter.saveGlobalUsers(globalUsers);
  },


  setBufferConfig: (config) => {
    set((state) => ({ bufferConfig: { ...state.bufferConfig, ...config } }));
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  setFeverZones: (zones) => {
    set((state) => ({ feverZones: { ...state.feverZones, ...zones } }));
    get().saveData();
  },

  setWorkingHoursPerDay: (hours) => {
    set({ workingHoursPerDay: hours });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  getProjectBufferHours: () => {
    const state = get();
    const pb = state.tasks.find((t) => t.type === "project_buffer");
    if (pb && pb.originalBufferDuration !== undefined) {
      return pb.originalBufferDuration;
    }

    const config = state.bufferConfig;

    // Compute total critical duration
    const leafTasks = state.tasks.filter(
      (t) => !state.tasks.some((p) => p.parentId === t.id),
    );
    const criticalTasks = leafTasks.filter(
      (t) => t.isCritical && t.type === "regular",
    );

    if (config.type === "ratio") {
      const totalPooledDuration = criticalTasks.reduce(
        (acc, t) => acc + ((t.originalEstimate || t.duration) - t.duration),
        0,
      );
      if (totalPooledDuration > 0) {
        // CCPM: 削られた安全余裕（プール）の合計の ratio % をプロジェクトバッファとする
        return totalPooledDuration * (config.ratio / 100);
      } else {
        // フォールバック: 削られていない場合は、現在のクリティカルパスの比率とする
        const totalCriticalDuration = criticalTasks.reduce(
          (acc, t) => acc + t.duration,
          0,
        );
        return totalCriticalDuration * (config.ratio / 100);
      }
    } else if (config.type === "hours") {
      return config.hours;
    } else if (config.type === "endDate" && config.endDate) {
      // Find max early finish of ALL tasks before project buffer
      let maxEarlyFinish = state.projectStartDate.getTime();
      const validPrecedingTasks = leafTasks.filter(
        (t) => t.type !== "project_buffer",
      );
      validPrecedingTasks.forEach((t) => {
        if (
          (t as any).baselineEarlyFinish &&
          (t as any).baselineEarlyFinish.getTime() > maxEarlyFinish
        ) {
          maxEarlyFinish = (t as any).baselineEarlyFinish.getTime();
        }
      });

      const endMs = config.endDate.getTime();
      // We add 1 day to endMs because selecting June 30th implies the buffer should INCLUDE June 30th completely.
      // So the absolute deadline is July 1st 00:00 local time.
      const adjustedEndMs = endMs + 24 * 60 * 60 * 1000;

      if (adjustedEndMs > maxEarlyFinish) {
        const daysDiff =
          (adjustedEndMs - maxEarlyFinish) / (24 * 60 * 60 * 1000);
        return Math.max(0, daysDiff * (state.workingHoursPerDay || 6));
      }
      return 0;
    }
    return 0;
  },

  setProjectStartDate: (date: Date) => {
    set({ projectStartDate: date });
    get().recalculateSchedule(date);
    get().saveData();
  },

  loadSampleData: () => {
    const res1 = {
      id: uuidv4(),
      name: "プロジェクトマネージャー (PM)",
      capacity: 8,
      productivity: 1.0,
    };
    const res2 = {
      id: uuidv4(),
      name: "システム/要件エンジニア",
      capacity: 8,
      productivity: 1.0,
    };
    const res3 = {
      id: uuidv4(),
      name: "ソフトウェアアーキテクト",
      capacity: 6,
      productivity: 1.2,
    };
    const res4 = {
      id: uuidv4(),
      name: "組み込みソフトエンジニア",
      capacity: 8,
      productivity: 0.8,
    };
    const res5 = {
      id: uuidv4(),
      name: "テスト/QAエンジニア",
      capacity: 8,
      productivity: 1.0,
    };

    const g1 = {
      id: uuidv4(),
      name: "システム/ソフトウェア要件定義 (SWE.1)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };
    const g2 = {
      id: uuidv4(),
      name: "アーキテクチャ/詳細設計 (SWE.2-3)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };
    const g3 = {
      id: uuidv4(),
      name: "実装・単体テスト (SWE.4)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };
    const g4 = {
      id: uuidv4(),
      name: "ソフトウェア結合テスト (SWE.5)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };
    const g5 = {
      id: uuidv4(),
      name: "ソフトウェア適格性確認テスト (SWE.6)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };
    const g6 = {
      id: uuidv4(),
      name: "システム統合テスト (SYS.4-5)",
      duration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      isExpanded: true,
    };

    // 要件定義
    const t1_1 = {
      id: uuidv4(),
      name: "システム要件分析・ユースケース定義",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [],
      progress: 0,
      resourceId: res2.id,
      parentId: g1.id,
    };
    const t1_2 = {
      id: uuidv4(),
      name: "ソフトウェア要件抽出",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t1_1.id],
      progress: 0,
      resourceId: res2.id,
      parentId: g1.id,
    };
    const t1_3 = {
      id: uuidv4(),
      name: "ソフトウェア要件レビュー",
      duration: 8,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t1_2.id],
      progress: 0,
      resourceId: res3.id,
      parentId: g1.id,
    };
    const t2_1 = {
      id: uuidv4(),
      name: "システム適格性テスト計画策定",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t1_1.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g1.id,
    };
    const t2_2 = {
      id: uuidv4(),
      name: "SW適格性テスト仕様書作成",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t1_3.id, t2_1.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g1.id,
    };

    // 設計
    const t3_1 = {
      id: uuidv4(),
      name: "SW構成要素・I/F設計",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t1_3.id],
      progress: 0,
      resourceId: res3.id,
      parentId: g2.id,
    };
    const t3_2 = {
      id: uuidv4(),
      name: "AUTOSAR BSWスタック設計",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_1.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g2.id,
    };
    const t3_3 = {
      id: uuidv4(),
      name: "アーキテクチャレビュー",
      duration: 8,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_2.id],
      progress: 0,
      resourceId: res3.id,
      parentId: g2.id,
    };
    const t4_1 = {
      id: uuidv4(),
      name: "SW結合テスト仕様書(BSW-ASW)",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_3.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g2.id,
    };
    const t4_2 = {
      id: uuidv4(),
      name: "SW結合テスト仕様書(ASW間)",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_3.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g2.id,
    };
    const t5_1 = {
      id: uuidv4(),
      name: "制御アルゴリズム(MBD)詳細設計",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_3.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g2.id,
    };
    const t5_2 = {
      id: uuidv4(),
      name: "非MBDモジュール詳細設計",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_3.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g2.id,
    };

    // 実装・単体テスト
    const t7_1 = {
      id: uuidv4(),
      name: "OS/MCALコンフィグレーション",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t3_3.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g3.id,
    };
    const t7_2 = {
      id: uuidv4(),
      name: "RTE/COM等BSW設定",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t7_1.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g3.id,
    };
    const t8_1 = {
      id: uuidv4(),
      name: "ASW MBDモデルコード生成",
      duration: 8,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t5_1.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g3.id,
    };
    const t8_2 = {
      id: uuidv4(),
      name: "CDD実装",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t5_2.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g3.id,
    };
    const t8_3 = {
      id: uuidv4(),
      name: "ASW手書きロジック実装",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t5_2.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g3.id,
    };
    const t9_1 = {
      id: uuidv4(),
      name: "ASW(MILS) 単体テスト実施",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t8_1.id, t8_3.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g3.id,
    };
    const t9_2 = {
      id: uuidv4(),
      name: "CDD/BSW(SILS) 単体テスト実施",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t7_2.id, t8_2.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g3.id,
    };

    // 結合テスト
    const t10_1 = {
      id: uuidv4(),
      name: "RTEベース ASW間結合テスト",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t4_1.id, t4_2.id, t9_1.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g4.id,
    };
    const t10_2 = {
      id: uuidv4(),
      name: "BSW-ASWスタック結合テスト",
      duration: 32,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t4_1.id, t4_2.id, t9_2.id, t10_1.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g4.id,
    };

    // 適格性確認
    const t11_1 = {
      id: uuidv4(),
      name: "HILS環境構築(プラントモデル)",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t10_2.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g5.id,
    };
    const t11_2 = {
      id: uuidv4(),
      name: "自動テストシナリオ作成・デバッグ",
      duration: 24,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t2_2.id, t11_1.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g5.id,
    };
    const t11_3 = {
      id: uuidv4(),
      name: "HILS SW要件適格性テスト実行",
      duration: 32,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t11_2.id],
      progress: 0,
      resourceId: res5.id,
      parentId: g5.id,
    };

    // システム統合
    const t12_1 = {
      id: uuidv4(),
      name: "実機ECUフラッシュ・環境立ち上げ",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t11_3.id],
      progress: 0,
      resourceId: res4.id,
      parentId: g6.id,
    };
    const t12_2 = {
      id: uuidv4(),
      name: "ネットワーク(CAN/LIN)通信テスト",
      duration: 16,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t12_1.id],
      progress: 0,
      resourceId: res2.id,
      parentId: g6.id,
    };
    const t12_3 = {
      id: uuidv4(),
      name: "車両機能統合テスト・適合(Calib)",
      duration: 32,
      actualDuration: 0,
      status: "todo" as TaskStatus,
      type: "regular" as TaskType,
      predecessors: [t12_2.id],
      progress: 0,
      resourceId: res2.id,
      parentId: g6.id,
    };

    const pb = {
      id: uuidv4(),
      name: "プロジェクトバッファ",
      duration: 64,
      status: "todo" as TaskStatus,
      type: "project_buffer" as TaskType,
      predecessors: [t12_3.id],
      progress: 0,
    };

    const tasksArray: Task[] = [
      g1,
      t1_1,
      t1_2,
      t1_3,
      t2_1,
      t2_2,
      g2,
      t3_1,
      t3_2,
      t3_3,
      t4_1,
      t4_2,
      t5_1,
      t5_2,
      g3,
      t7_1,
      t7_2,
      t8_1,
      t8_2,
      t8_3,
      t9_1,
      t9_2,
      g4,
      t10_1,
      t10_2,
      g5,
      t11_1,
      t11_2,
      t11_3,
      g6,
      t12_1,
      t12_2,
      t12_3,
      pb,
    ] as any;

    const todayStr = new Date().toISOString().split("T")[0];
    const dummyLogs: DailyLog[] = [];
    tasksArray.forEach((t) => {
      if (t.actualDuration && t.actualDuration > 0) {
        dummyLogs.push({
          id: uuidv4(),
          taskId: t.id,
          date: todayStr,
          hours: t.actualDuration,
          resourceId: t.resourceId, // Use task's resourceId as default
        });
      }
    });

    set({
      resources: [res1, res2, res3, res4, res5],
      tasks: tasksArray,
      dailyLogs: dummyLogs,
      isLoading: false,
      projectStartDate: new Date(new Date().setHours(0, 0, 0, 0)),
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  reorderTasks: (activeId: string, overId: string) => {
    set((state) => {
      const oldIndex = state.tasks.findIndex((t) => t.id === activeId);
      const newIndex = state.tasks.findIndex((t) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const newTasks = [...state.tasks];
      const [removed] = newTasks.splice(oldIndex, 1);
      newTasks.splice(newIndex, 0, removed);
      return { tasks: newTasks };
    });
    get().saveData();
  },

  setCurrentUser: (name) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ccpm_current_user", name);
    }
    set({ currentUser: name });
  },

  restoreVersion: (id) => {
    const version = get().versions.find((v) => v.id === id);
    if (!version) return;
    const data = version.data;
    
    // We parse similarly to fetchData
    const seenIds = new Set<string>();
    const tasks = (data.tasks || []).map((t: any) => {
      let tid = t.id;
      if (seenIds.has(tid)) {
        tid = uuidv4();
      }
      seenIds.add(tid);

      return {
        ...t,
        id: tid,
        duration: typeof t.duration === "number" && !isNaN(t.duration) ? t.duration : 0,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined,
        earlyStart: t.earlyStart ? new Date(t.earlyStart) : undefined,
        earlyFinish: t.earlyFinish ? new Date(t.earlyFinish) : undefined,
        lateStart: t.lateStart ? new Date(t.lateStart) : undefined,
        lateFinish: t.lateFinish ? new Date(t.lateFinish) : undefined,
        manualStartDate: t.manualStartDate ? new Date(t.manualStartDate) : undefined,
        manualEndDate: t.manualEndDate ? new Date(t.manualEndDate) : undefined,
      };
    });

    let parsedBufferConfig = {
      type: "ratio" as const,
      ratio: 50,
      hours: 80,
      endDate: null as Date | null,
      feedingBufferRatio: 50,
      feedingBufferMode: "task" as const,
    };
    if (data.bufferConfig) {
      parsedBufferConfig = {
        ...data.bufferConfig,
        feedingBufferRatio: data.bufferConfig.feedingBufferRatio || 50,
        feedingBufferMode: data.bufferConfig.feedingBufferMode || "task",
        endDate: data.bufferConfig.endDate ? new Date(data.bufferConfig.endDate) : null,
      };
    } else if (data.projectBufferRatio !== undefined) {
      parsedBufferConfig.ratio = data.projectBufferRatio;
    }

    let projectStartDate = new Date();
    if (data.projectStartDate) {
      projectStartDate = new Date(data.projectStartDate);
    } else {
      projectStartDate.setHours(0, 0, 0, 0);
    }

    const d = new Date(version.timestamp);
    const dateStr = d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const newVersion = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      author: get().currentUser || "Local User",
      message: `${dateStr} のバージョンに復元しました`,
      data: {
        tasks,
        resources: data.resources || [],
        dailyLogs: data.dailyLogs || [],
        taskStatusLogs: data.taskStatusLogs || [],
        feverHistory: data.feverHistory || [],
        feverZones: data.feverZones || {
          startRed: 10,
          startYellow: 5,
          endRed: 80,
          endYellow: 60,
        },
        bufferConfig: parsedBufferConfig,
        ganttSettings: data.ganttSettings
          ? {
              ...defaultGanttSettings,
              ...data.ganttSettings,
            }
          : defaultGanttSettings,
        projectStartDate,
      }
    };

    set({
      tasks,
      resources: data.resources || [],
      dailyLogs: data.dailyLogs || [],
      taskStatusLogs: data.taskStatusLogs || [],
      feverHistory: data.feverHistory || [],
      feverZones: data.feverZones || {
        startRed: 10,
        startYellow: 5,
        endRed: 80,
        endYellow: 60,
      },
      bufferConfig: parsedBufferConfig,
      ganttSettings: data.ganttSettings
        ? {
            ...defaultGanttSettings,
            ...data.ganttSettings,
            columns: data.ganttSettings.columns || defaultGanttColumns,
          }
        : defaultGanttSettings,
      projectStartDate,
      workingHoursPerDay: data.workingHoursPerDay || 8,
      versions: [...get().versions, newVersion].slice(-50),
    });

    get().recalculateSchedule(projectStartDate);
    // saveData() 内でさらに自動的に差分履歴が作られないように、ここでは saveData() ではなく storageManager.save() を直接呼ぶか、もしくはそのまま saveData() を呼ぶが、直近のデータと一致するため差分追加はスキップされるはず。
    get().saveData();
  },

  saveData: async () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      get().recordFeverSnapshot(true); // 自動記録
      const {
        tasks,
        resources,
        dailyLogs,
        taskStatusLogs,
        feverHistory,
        feverZones,
        bufferConfig,
        projectStartDate,
        ganttSettings,
        versions,
        currentUser,
      } = get();
      
      try {
        const payload = {
          tasks,
          resources,
          dailyLogs,
          taskStatusLogs,
          feverHistory,
          feverZones,
          bufferConfig,
          projectStartDate: projectStartDate.toISOString(),
          ganttSettings,
        };

        let newVersions = [...versions];
        const lastVersion = newVersions[newVersions.length - 1];
        const oldData = lastVersion ? lastVersion.data : null;
        
        const diffMessage = generateDiffMessage(oldData, payload);
        
        // Only push version if there is a real change or if it's the very first save
        if (diffMessage !== "その他の設定変更" || !oldData) {
          newVersions.push({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            author: currentUser || "Local User",
            message: diffMessage,
            data: payload,
          });
          
          // Keep only the last 50 versions to avoid massive payloads
          if (newVersions.length > 50) {
            newVersions = newVersions.slice(newVersions.length - 50);
          }
          set({ versions: newVersions });
        }

        await storageManager.getAdapter().saveProject(
          get().currentProjectId!,
          get().currentProjectName || "Default Project",
          { ...payload, versions: newVersions }
        );
      } catch (e) {
        console.error("Failed to save", e);
      }
    }, 500);
  },

  autoPlaceFeedingBuffers: () => {
    // 既存の合流バッファを一旦削除（手動作成のものは残すかどうするか？ここでは「自動一括配置」なので、再配置のことも考え、合流バッファはすべて削除してから作り直すのがシンプルだが…一旦全て残し、足りないところに追加する形にする）
    // （完全自動配置ボタンを押すと増え続けるのを防ぐため、自動配置されたfeeding_bufferかどうかの区分が無いなら、一旦 feeding_buffer を全削除して作り直すのが安全）
    const state = get();
    let currentTasks = state.tasks.map((t) => ({ ...t }));

    // Step 1: Remove completely auto-placed or all feeding buffers to reset (for simplicity, we remove all feeding buffers that have "合流バッファ" in their name, or ideally all feeding_buffer)
    currentTasks = currentTasks.filter((t) => t.type !== "feeding_buffer");
    // Also remove them from predecessors
    currentTasks.forEach((t) => {
      t.predecessors = t.predecessors.filter(
        (pid) =>
          !state.tasks.find(
            (ot) => ot.id === pid && ot.type === "feeding_buffer",
          ),
      );
      // Restore original predecessors that were pointing to feeding buffers
      state.tasks
        .filter((ot) => ot.type === "feeding_buffer")
        .forEach((fb) => {
          if (
            state.tasks
              .find((ot) => ot.id === t.id)
              ?.predecessors.includes(fb.id)
          ) {
            // This task depended on FB. So it should depend on FB's predecessors.
            fb.predecessors.forEach((fbPred) => {
              if (!t.predecessors.includes(fbPred)) t.predecessors.push(fbPred);
            });
          }
        });
    });

    // Temp state to recalculate and find critical path without feeding buffers
    set({ tasks: currentTasks });
    get().recalculateSchedule(get().projectStartDate);

    // Now get the freshly calculated slack/critical info
    const freshTasks = get().tasks;
    const ratio = get().bufferConfig.feedingBufferRatio / 100;

    const newTasks = [...freshTasks];
    const bufferInsertions: { task: Task; afterId: string }[] = [];

    // Find non-critical leaf nodes that feed into a critical node
    freshTasks.forEach((task) => {
      // task is non-critical
      if (!task.isCritical && task.type === "regular") {
        // Find successors of this non-critical task
        const successors = freshTasks.filter((t) =>
          t.predecessors.includes(task.id),
        );
        // If it feeds into AT LEAST ONE critical task
        const criticalSuccessors = successors.filter((t) => t.isCritical);
        if (criticalSuccessors.length > 0) {
          // Calculate depth (simply the duration of this task, or we could walk backwards)
          // Walk backwards to find max non-critical path length
          let maxLen = 0;
          const visited = new Set<string>();
          const walkBack = (tId: string): number => {
            if (visited.has(tId)) return 0;
            visited.add(tId);
            const node = freshTasks.find((x) => x.id === tId);
            if (!node || node.isCritical) return 0;
            let maxP = 0;
            node.predecessors.forEach((pid) => {
              maxP = Math.max(maxP, walkBack(pid));
            });
            return maxP + node.duration;
          };
          const chainLen = walkBack(task.id);
          // 合流バッファがクリティカルパスに影響を与えないよう、スラックの範囲内に収める（-0.5hして完全に0にならないようにする）
          const maxAllowedBuffer = Math.max(
            0,
            (task.slack || 0) * (state.workingHoursPerDay || 6) - 0.5,
          );
          const bufferDuration = Math.round(
            Math.min(chainLen * ratio, maxAllowedBuffer),
          );

          if (bufferDuration > 0) {
            const fbId = uuidv4();
            const fbTask: Task = {
              id: fbId,
              name: "合流バッファ (自動)",
              duration: bufferDuration,
              status: "todo",
              type: "feeding_buffer",
              predecessors: [task.id],
              progress: 0,
              parentId: task.parentId, // keep it in the same group if possible
            };
            bufferInsertions.push({ task: fbTask, afterId: task.id });

            // Update the critical successors to depend on fb instead of task
            criticalSuccessors.forEach((cs) => {
              const succInNew = newTasks.find((x) => x.id === cs.id);
              if (succInNew) {
                succInNew.predecessors = succInNew.predecessors.filter(
                  (p) => p !== task.id,
                );
                succInNew.predecessors.push(fbId);
              }
            });
          }
        }
      }
    });

    // Insert buffers immediately after their respective tasks in array
    bufferInsertions.forEach(({ task: fbTask, afterId }) => {
      const idx = newTasks.findIndex((t) => t.id === afterId);
      if (idx !== -1) {
        newTasks.splice(idx + 1, 0, fbTask);
      } else {
        newTasks.push(fbTask);
      }
    });

    set({ tasks: newTasks });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  addTask: (task) => {
    const newTask: Task = {
      id: uuidv4(),
      name: task.name || "New Task",
      duration: task.duration || 1,
      status: task.status || "todo",
      type: task.type || "regular",
      predecessors: task.predecessors || [],
      progress: task.progress || 0,
      resourceId: task.resourceId,
      position: task.position,
      parentId: task.parentId,
      manualStartDate: task.manualStartDate,
      manualEndDate: task.manualEndDate,
    };
    set((state) => ({ tasks: [...state.tasks, newTask] }));
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  addTasks: (newTasksArray) => {
    const mappedTasks = newTasksArray.map((task) => ({
      id: uuidv4(),
      name: task.name || "New Task",
      duration: task.duration || 1,
      status: task.status || "todo",
      type: task.type || "regular",
      predecessors: task.predecessors || [],
      progress: task.progress || 0,
      resourceId: task.resourceId,
      position: task.position,
      parentId: task.parentId,
      manualStartDate: task.manualStartDate,
      manualEndDate: task.manualEndDate,
    }));
    set((state) => ({ tasks: [...state.tasks, ...mappedTasks] }));
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  updateTask: (id, updates) => {
    let statusLogUpdated = false;
    let targetDateStr = updates.asOfDate;
    set((state) => {
      const todayStr = (() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split("T")[0];
      })();
      const dateToLog = updates.asOfDate || todayStr;
      if (!targetDateStr) targetDateStr = dateToLog;
      let newTaskStatusLogs = [...state.taskStatusLogs];

      const newTasks = state.tasks.map((t) => {
        if (t.id === id) {
          let newDuration = updates.duration ?? t.duration;
          let newProgress = updates.progress ?? t.progress;
          let newStatus = updates.status ?? t.status;
          let newActualDuration =
            updates.actualDuration ??
            (t.actualDuration !== undefined ? t.actualDuration : 0);

          let newRemainingDuration = t.remainingDuration;
          if (updates.remainingDuration !== undefined) {
            newRemainingDuration = updates.remainingDuration;
          } else if (updates.duration !== undefined && updates.progress === undefined) {
            newRemainingDuration = Math.max(0, newDuration - newActualDuration);
          } else {
            newRemainingDuration = t.remainingDuration !== undefined
              ? t.remainingDuration
              : Math.max(0, newDuration - newActualDuration);
          }

          // Kanban 等から status だけ変更された場合、progress 等を追従させる
          if (updates.status !== undefined && updates.progress === undefined) {
            if (updates.status === "todo") {
              newProgress = 0;
              newRemainingDuration = Math.max(0, newDuration - newActualDuration);
            } else if (updates.status === "done") {
              newProgress = 100;
              newRemainingDuration = 0;
            } else if (updates.status === "in_progress" && newProgress >= 100) {
              newProgress = 50; // doneから戻した場合、とりあえず50%にする
              if (newRemainingDuration === 0) {
                newRemainingDuration = Math.max(0, newDuration - newActualDuration);
              }
            } else if (updates.status === "in_progress" && newProgress === 0) {
              // todoから移した場合
              newProgress = 10; // 少し進捗した扱いにする（任意）
            }
          }

          if (
            updates.progress !== undefined &&
            updates.actualDuration === undefined &&
            updates.remainingDuration === undefined
          ) {
            // 進捗を更新したときに残工数を自動で計算する
            newRemainingDuration = Math.max(
              0,
              newDuration * (1 - newProgress / 100),
            );
          } else if (
            updates.actualDuration !== undefined ||
            updates.remainingDuration !== undefined ||
            updates.duration !== undefined
          ) {
            // 実績、残工数、見積を更新したときは、進捗率を自動で同期する
            const expected = newActualDuration + newRemainingDuration;
            if (expected > 0) {
              newProgress = Math.round((newActualDuration / expected) * 100);
            } else {
              newProgress = 0;
            }
          }

          // 進捗100%なら確実にdone
          if (newProgress >= 100) {
            newProgress = 100;
            newRemainingDuration = 0;
            newStatus = "done";
          } else if (newProgress < 100 && newProgress > 0) {
            newStatus = "in_progress";
          } else if (newProgress === 0) {
            newStatus = "todo";
          }

          // If the user manually updated progress or remainingDuration (or actualDuration from chart)
          if (
            updates.progress !== undefined ||
            updates.remainingDuration !== undefined ||
            updates.actualDuration !== undefined ||
            updates.status !== undefined
          ) {
            statusLogUpdated = true;
            const existingIdx = newTaskStatusLogs.findIndex(
              (l) => l.taskId === id && l.date === dateToLog,
            );
            if (existingIdx >= 0) {
              newTaskStatusLogs[existingIdx] = {
                ...newTaskStatusLogs[existingIdx],
                progress: newProgress,
                remainingDuration: newRemainingDuration,
              };
            } else {
              newTaskStatusLogs.push({
                id: uuidv4(),
                taskId: id,
                date: dateToLog,
                progress: newProgress,
                remainingDuration: newRemainingDuration,
              });
            }
          }

          const filteredUpdates = { ...updates };
          delete filteredUpdates.asOfDate;

          let finalTask = { ...t, ...filteredUpdates };

          // 「手動で状態を変える操作」では computeTaskStatus を呼ばず、入力された値を尊重する
          if (newProgress !== undefined) finalTask.progress = newProgress;
          if (newStatus !== undefined) finalTask.status = newStatus as any;
          if (newRemainingDuration !== undefined) finalTask.remainingDuration = newRemainingDuration;
          if (newActualDuration !== undefined) finalTask.actualDuration = newActualDuration;

          return finalTask;
        }
        return t;
      });

      return { tasks: newTasks, taskStatusLogs: newTaskStatusLogs };
    });

    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
    if (statusLogUpdated && targetDateStr) {
      get().recordFeverSnapshot(false, targetDateStr);
    }
  },

  reorderTask: (sourceId, targetId, position) => {
    set((state) => {
      const sourceIndex = state.tasks.findIndex((t) => t.id === sourceId);
      if (sourceIndex === -1 || sourceId === targetId) return state;

      const newTasks = [...state.tasks];
      const [sourceTask] = newTasks.splice(sourceIndex, 1);

      const adjustedTargetIndex = newTasks.findIndex((t) => t.id === targetId);
      if (adjustedTargetIndex === -1) return state;
      const targetTask = newTasks[adjustedTargetIndex];

      const newSourceTask = { ...sourceTask };

      let insertIndex = adjustedTargetIndex;
      if (position === "before") {
        newSourceTask.parentId = targetTask.parentId;
      } else {
        insertIndex = adjustedTargetIndex + 1;
        const gatherDescendants = (parentId: string) => {
          const children = newTasks.filter((t) => t.parentId === parentId);
          for (const child of children) {
            const idx = newTasks.findIndex((t) => t.id === child.id);
            if (idx >= insertIndex) insertIndex = idx + 1;
            gatherDescendants(child.id);
          }
        };
        gatherDescendants(targetTask.id);

        if (position === "inside") {
          newSourceTask.parentId = targetTask.id;
          newTasks[adjustedTargetIndex] = { ...targetTask, isExpanded: true }; // expand parent
        } else {
          newSourceTask.parentId = targetTask.parentId;
        }
      }

      // Cycle check
      const hasCycle = (
        taskId: string,
        parentId: string | undefined,
      ): boolean => {
        if (!parentId) return false;
        if (taskId === parentId) return true;
        const parent = newTasks.find((t) => t.id === parentId);
        return parent ? hasCycle(taskId, parent.parentId) : false;
      };

      if (hasCycle(newSourceTask.id, newSourceTask.parentId)) {
        return state;
      }

      newTasks.splice(insertIndex, 0, newSourceTask);

      return { tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  reorderTasksMulti: (sourceIds, targetId, position) => {
    set((state) => {
      if (sourceIds.includes(targetId)) return state;

      let newTasks = [...state.tasks];
      const targetIndex = newTasks.findIndex((t) => t.id === targetId);
      if (targetIndex === -1) return state;
      const targetTask = newTasks[targetIndex];

      const extractTaskAndDescendants = (
        tId: string,
        extracted: Task[] = [],
      ) => {
        const idx = newTasks.findIndex((t) => t.id === tId);
        if (idx !== -1) {
          extracted.push(newTasks.splice(idx, 1)[0]);
          const children = newTasks
            .filter((t) => t.parentId === tId)
            .map((t) => t.id);
          for (const cid of children) {
            extractTaskAndDescendants(cid, extracted);
          }
        }
        return extracted;
      };

      const allExtractedTasks: Task[] = [];
      const parentIdMap = new Map<string, string | undefined>();

      for (const sId of sourceIds) {
        if (allExtractedTasks.some((t) => t.id === sId)) continue;

        const sourceTaskIdx = state.tasks.findIndex((t) => t.id === sId);
        if (sourceTaskIdx !== -1) {
          const originalParentId = state.tasks[sourceTaskIdx].parentId;
          let newParentId = originalParentId;
          if (position === "before") {
            newParentId = targetTask.parentId;
          } else if (position === "inside") {
            newParentId = targetTask.id;
          } else if (position === "after") {
            newParentId = targetTask.parentId;
          }
          parentIdMap.set(sId, newParentId);

          const extracted = extractTaskAndDescendants(sId);
          allExtractedTasks.push(...extracted);
        }
      }

      const adjustedTargetIndex = newTasks.findIndex((t) => t.id === targetId);
      if (adjustedTargetIndex === -1) return state;

      let insertIndex = adjustedTargetIndex;
      if (position === "after") {
        insertIndex = adjustedTargetIndex + 1;
        const gatherDescendantsCount = (parentId: string): number => {
          const children = newTasks.filter((t) => t.parentId === parentId);
          let count = children.length;
          for (const child of children) {
            count += gatherDescendantsCount(child.id);
          }
          return count;
        };
        insertIndex += gatherDescendantsCount(targetTask.id);
      } else if (position === "inside") {
        newTasks[adjustedTargetIndex] = { ...targetTask, isExpanded: true };
        insertIndex = adjustedTargetIndex + 1;
      }

      // Cycle check for all roots
      const hasCycle = (
        taskId: string,
        parentId: string | undefined,
      ): boolean => {
        if (!parentId) return false;
        if (taskId === parentId) return true;
        // check against newly formed tree context (combined)
        const parent =
          newTasks.find((t) => t.id === parentId) ||
          allExtractedTasks.find((t) => t.id === parentId);
        return parent ? hasCycle(taskId, parent.parentId) : false;
      };

      for (const t of allExtractedTasks) {
        if (parentIdMap.has(t.id)) {
          t.parentId = parentIdMap.get(t.id);
          if (hasCycle(t.id, t.parentId)) {
            return state; // abort
          }
        }
      }

      newTasks.splice(insertIndex, 0, ...allExtractedTasks);

      return { tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  deleteTask: (id) => {
    set((state) => {
      const targetTask = state.tasks.find((t) => t.id === id);
      // Remove task and also remove it from any predecessors lists
      const filtered = state.tasks.filter((t) => t.id !== id);
      return {
        tasks: filtered.map((t) => {
          const updatedTask = {
            ...t,
            predecessors: t.predecessors.filter((pid) => pid !== id),
          };
          if (updatedTask.parentId === id) {
            updatedTask.parentId = targetTask?.parentId;
          }
          return updatedTask;
        }),
      };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  addResource: (res) => {
    const newRes: Resource = {
      id: uuidv4(),
      name: res.name || "New Resource",
      capacity: res.capacity || 8,
      productivity: res.productivity || 1.0,
    };
    set((state) => ({ resources: [...state.resources, newRes] }));
    get().saveData();
  },

  updateResource: (id, updates) => {
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
    get().saveData();
  },

  deleteResource: (id) => {
    set((state) => ({
      resources: state.resources.filter((r) => r.id !== id),
      tasks: state.tasks.map((t) =>
        t.resourceId === id ? { ...t, resourceId: undefined } : t,
      ),
    }));
    get().saveData();
  },

  updateDailyLog: (taskId, date, hours, startTime, resourceId) => {
    set((state) => {
      // List view support: Clear all logs for this date/task and create one combined/new log
      const affectedLogs = state.dailyLogs.filter(
        (l) =>
          l.taskId === taskId &&
          l.date === date &&
          (resourceId === undefined || l.resourceId === resourceId),
      );
      const oldHours = affectedLogs.reduce((acc, l) => acc + l.hours, 0);
      const diffHours = hours - oldHours;

      const newLogs = state.dailyLogs.filter(
        (l) =>
          !(
            l.taskId === taskId &&
            l.date === date &&
            (resourceId === undefined || l.resourceId === resourceId)
          ),
      );
      if (hours > 0) {
        newLogs.push({
          id: uuidv4(),
          taskId,
          date,
          hours,
          startTime: startTime !== undefined ? startTime : 8,
          resourceId,
        });
      }

      // Update actualDuration on the task based on new logs
      const newTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return computeTaskStatus(taskId, t, newLogs, state.taskStatusLogs);
        }
        return t;
      });
      return { dailyLogs: newLogs, tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  addDailyLog: (taskId, date, hours, startTime, resourceId) => {
    set((state) => {
      const newLogs = [
        ...state.dailyLogs,
        { id: uuidv4(), taskId, date, hours, startTime, resourceId },
      ];
      const newTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return computeTaskStatus(taskId, t, newLogs, state.taskStatusLogs);
        }
        return t;
      });
      return { dailyLogs: newLogs, tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  updateDailyLogById: (logId, hours, startTime) => {
    set((state) => {
      const existingLog = state.dailyLogs.find((l) => l.id === logId);
      if (!existingLog) return state;
      const diffHours = hours - existingLog.hours;

      const newLogs = state.dailyLogs.map((l) =>
        l.id === logId ? { ...l, hours, startTime } : l,
      );
      const newTasks = state.tasks.map((t) => {
        if (t.id === existingLog.taskId) {
          return computeTaskStatus(
            existingLog.taskId,
            t,
            newLogs,
            state.taskStatusLogs,
          );
        }
        return t;
      });
      return { dailyLogs: newLogs, tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  removeDailyLogById: (logId) => {
    set((state) => {
      const existingLog = state.dailyLogs.find((l) => l.id === logId);
      if (!existingLog) return state;
      const diffHours = -existingLog.hours;

      const newLogs = state.dailyLogs.filter((l) => l.id !== logId);
      const newTasks = state.tasks.map((t) => {
        if (t.id === existingLog.taskId) {
          return computeTaskStatus(
            existingLog.taskId,
            t,
            newLogs,
            state.taskStatusLogs,
          );
        }
        return t;
      });
      return { dailyLogs: newLogs, tasks: newTasks };
    });
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  updateTaskStatusLog: (taskId, date, progress, remainingDuration) => {
    set((state) => {
      const existingIdx = state.taskStatusLogs.findIndex(
        (l) => l.taskId === taskId && l.date === date,
      );
      const newLogs = [...state.taskStatusLogs];
      if (existingIdx >= 0) {
        newLogs[existingIdx] = {
          ...newLogs[existingIdx],
          progress,
          remainingDuration,
        };
      } else {
        newLogs.push({
          id: uuidv4(),
          taskId,
          date,
          progress,
          remainingDuration,
        });
      }

      let newTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return computeTaskStatus(taskId, t, state.dailyLogs, newLogs);
        }
        return t;
      });
      return { taskStatusLogs: newLogs, tasks: newTasks };
    });
    // Trigger snapshot for the updated date
    get().recordFeverSnapshot(false, date);
  },

  setActiveView: (view) => set({ activeView: view }),
  setGanttSettings: (settings) => {
    set((state) => ({
      ganttSettings: { ...state.ganttSettings, ...settings },
    }));
    get().saveData();
  },

  recordFeverSnapshot: (skipSave = false, targetDateStr?: string) => {
    const state = get();

    // Determine the target date string properly without messing up the original date object for diff calculations
    let targetDateObj: Date;
    let dateStr: string;

    if (targetDateStr) {
      const [y, m, d] = targetDateStr.split("-").map(Number);
      targetDateObj = new Date(y, m - 1, d);
      dateStr = targetDateStr;
    } else {
      targetDateObj = new Date();
      targetDateObj.setHours(0, 0, 0, 0); // Normalize to local midnight
      const shiftedObj = new Date(targetDateObj);
      shiftedObj.setMinutes(
        shiftedObj.getMinutes() - shiftedObj.getTimezoneOffset(),
      );
      dateStr = shiftedObj.toISOString().split("T")[0];
    }

    // Helper: get the historical state of a task as of the target date
    const getHistoricalTaskData = (taskId: string, t: Task) => {
      const taskDailyLogs = state.dailyLogs.filter(
        (l) => l.taskId === taskId && l.date <= dateStr,
      );
      const actual = taskDailyLogs.reduce((sum, l) => sum + l.hours, 0);

      const taskStatusLogs = state.taskStatusLogs
        .filter((l) => l.taskId === taskId && l.date <= dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latestStatus = taskStatusLogs.length > 0 ? taskStatusLogs[0] : null;
      const remaining = latestStatus
        ? latestStatus.remainingDuration
        : Math.max(0, t.duration - actual);

      let progress = 0;
      const expected = actual + remaining;
      if (t.status === "done") {
        progress = 100; // Done tasks should always be 100% EV regardless of actual hours
      } else if (expected > 0) {
        progress = (actual / expected) * 100;
      }

      return { actual, progress, remaining };
    };

    const leafTasks = state.tasks.filter(
      (t) => !state.tasks.some((p) => p.parentId === t.id),
    );
    const criticalTasks = leafTasks.filter(
      (t) => t.isCritical && t.type === "regular",
    );

    let completedCritical = 0;
    let totalCriticalDuration = 0;
    let delay = 0;

    criticalTasks.forEach((t) => {
      const h = getHistoricalTaskData(t.id, t);
      totalCriticalDuration += t.duration;
      completedCritical += t.duration * (h.progress / 100);

      const expectedTotal = h.actual + h.remaining;
      const taskDelay = expectedTotal - t.duration;

      if (taskDelay > 0) delay += taskDelay;
    });

    const ccProgress =
      totalCriticalDuration > 0
        ? (completedCritical / totalCriticalDuration) * 100
        : 0;
    const projectBuffer = get().getProjectBufferHours();
    const bufferConsumption =
      projectBuffer > 0 ? (delay / projectBuffer) * 100 : 0;

    // EVM metrics
    let ev = 0;
    let ac = 0;
    let pv = 0;

    const projectStartDate = state.projectStartDate;
    const dayIndexForToday = Math.floor(
      (targetDateObj.getTime() - projectStartDate.getTime()) /
        (24 * 60 * 60 * 1000),
    );

    leafTasks.forEach((t) => {
      if (t.type !== "project_buffer" && t.type !== "feeding_buffer") {
        const h = getHistoricalTaskData(t.id, t);
        ev += t.duration * (h.progress / 100);
        ac += h.actual; // Use the sum of actual past timesheet hours

        const targetDateMs = targetDateObj.getTime() + 24 * 60 * 60 * 1000;
        const baseStart = (t as any).baselineEarlyStart || t.earlyStart;
        const baseFinish = (t as any).baselineEarlyFinish || t.earlyFinish;
        const startMs = baseStart
          ? baseStart.getTime()
          : projectStartDate.getTime();
        const endMs = baseFinish ? baseFinish.getTime() : startMs;

        if (targetDateMs >= endMs) {
          pv += t.duration;
        } else if (targetDateMs > startMs && endMs > startMs) {
          const workingDiff = getWorkingHoursDiff(startMs, targetDateMs);
          const totalWorking = getWorkingHoursDiff(startMs, endMs);
          if (totalWorking > 0) {
            pv +=
              t.duration * Math.min(1, Math.max(0, workingDiff / totalWorking));
          } else {
            pv += t.duration * ((targetDateMs - startMs) / (endMs - startMs));
          }
        }
      }
    });

    set((s) => {
      const newHistory = s.feverHistory ? [...s.feverHistory] : [];
      const existingIdx = newHistory.findIndex((h) => h.date === dateStr);
      if (existingIdx !== -1) {
        newHistory[existingIdx] = {
          date: dateStr,
          ccProgress,
          bufferConsumption,
          pv,
          ev,
          ac,
        };
      } else {
        newHistory.push({
          date: dateStr,
          ccProgress,
          bufferConsumption,
          pv,
          ev,
          ac,
        });
      }
      return { feverHistory: newHistory };
    });
    if (!skipSave) get().saveData();
  },

  autoSchedule: (options) => {
    // 初回に現在の依存関係からCPM計算（slackの算出等）を実施
    get().recalculateSchedule(get().projectStartDate);

    set((state) => {
      let tasks: Task[] = state.tasks.map((t) => ({
        ...t,
        manualStartDate: undefined,
        manualEndDate: undefined,
      }));
      const parentTaskIds = new Set(
        tasks.map((t) => t.parentId).filter(Boolean),
      );

      if (options?.reduceEstimateRatio) {
        const ratio = options.reduceEstimateRatio / 100;
        tasks = tasks.map((t) => {
          if (t.type === "regular" && !parentTaskIds.has(t.id)) {
            const currentOrig = t.originalEstimate || t.duration;
            const newDuration = Math.max(
              1,
              Math.round(currentOrig * (1 - ratio)),
            );
            // 見積もりを短縮する。進捗や実績がある場合の影響はCCPMの観点からはリセットに近いが、
            // durationだけを削ることで、実際の配置（autoSchedule）で利用される。
            const safeProgress = t.progress || 0;
            const actual =
              t.actualDuration !== undefined
                ? t.actualDuration
                : t.duration * (safeProgress / 100);
            const newRemaining = Math.max(0, newDuration - actual);
            const newExpected = actual + newRemaining;
            const newProgress =
              newExpected > 0 ? (actual / newExpected) * 100 : 0;

            return {
              ...t,
              originalEstimate: currentOrig,
              duration: newDuration,
              remainingDuration: newRemaining,
              progress: Math.round(newProgress * 100) / 100,
            };
          }
          return t;
        });
      }

      const projectStart = state.projectStartDate.getTime();

      // 対象タスク（leafの regular タスクのみ対象）
      const regTasks = tasks.filter(
        (t) => t.type === "regular" && !parentTaskIds.has(t.id),
      );
      const taskMap = new Map(tasks.map((t) => [t.id, t]));

      const inDegree = new Map<string, number>();
      const adj = new Map<string, string[]>(); // u -> list of v

      regTasks.forEach((t) => {
        inDegree.set(t.id, 0);
        adj.set(t.id, []);
      });

      regTasks.forEach((t) => {
        t.predecessors.forEach((pid) => {
          if (adj.has(pid)) {
            adj.get(pid)!.push(t.id);
            inDegree.set(t.id, inDegree.get(t.id)! + 1);
          }
        });
      });

      const readyQueue: string[] = [];
      inDegree.forEach((deg, id) => {
        if (deg === 0) readyQueue.push(id);
      });

      const resourceAvail = new Map<string, number>();
      const finishTimes = new Map<string, number>();
      const lastResourceTask = new Map<string, string>();

      while (readyQueue.length > 0) {
        // Sort queue: slack昇順、duration降順、id昇順
        readyQueue.sort((a, b) => {
          const ta = taskMap.get(a)!;
          const tb = taskMap.get(b)!;
          const slackDiff = (ta.slack || 0) - (tb.slack || 0);
          if (slackDiff !== 0) return slackDiff;
          const durDiff = tb.duration - ta.duration;
          if (durDiff !== 0) return durDiff;
          return ta.id.localeCompare(tb.id);
        });

        const curId = readyQueue.shift()!;
        const task = taskMap.get(curId)!;

        const resKey = task.resourceId || "unassigned";

        // 同一リソースでの直前タスクへの依存関係を自動追加
        if (resKey !== "unassigned" && lastResourceTask.has(resKey)) {
          const prevId = lastResourceTask.get(resKey)!;
          if (!task.predecessors.includes(prevId)) {
            task.predecessors = [...task.predecessors, prevId];
          }
        }

        let est = projectStart;
        task.predecessors.forEach((pid) => {
          if (finishTimes.has(pid)) {
            est = Math.max(est, finishTimes.get(pid)!);
          }
        });

        const ravail = resourceAvail.get(resKey) || projectStart;
        est = Math.max(est, ravail);
        est = snapToWorkingDay(est);

        const safeProgress = task.progress || 0;
        const actual =
          task.actualDuration !== undefined
            ? task.actualDuration
            : task.duration * (safeProgress / 100);
        const remaining =
          task.remainingDuration !== undefined
            ? task.remainingDuration
            : Math.max(0, task.duration - actual);
        const expectedDuration = actual + remaining;

        const resourceInfo = state.resources.find((r) => r.id === resKey);
        const resProductivity = resourceInfo?.productivity || 1.0;
        const resCapacity = resourceInfo?.capacity;

        const requiredEffort = expectedDuration / resProductivity;
        const finishTime = addWorkingHoursMs(est, requiredEffort, resCapacity);

        task.manualStartDate = new Date(est);

        finishTimes.set(curId, finishTime);
        resourceAvail.set(resKey, finishTime);
        if (resKey !== "unassigned") {
          lastResourceTask.set(resKey, curId);
        }

        const neighbors = adj.get(curId) || [];
        neighbors.forEach((nid) => {
          const currentDeg = inDegree.get(nid)! - 1;
          inDegree.set(nid, currentDeg);
          if (currentDeg === 0) {
            readyQueue.push(nid);
          }
        });
      }

      return { tasks };
    });
    // 割り当て後にもう一度全体スケジュールを計算して保存
    get().recalculateSchedule(get().projectStartDate);
    get().saveData();
  },

  // Simple CPM calculation
  recalculateSchedule: (projectStartDate) => {
    set((state) => {
      // Create fresh references for all tasks so React detects the update
      const tasks = state.tasks.map((t) => ({ ...t }));
      const parentTaskIds = new Set(
        tasks.map((t) => t.parentId).filter(Boolean),
      );

      // Topological sort (naive) - only for leaf tasks or tasks without children
      const sorted: Task[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const visit = (taskId: string) => {
        if (visited.has(taskId)) return;
        if (visiting.has(taskId)) return; // Cycle detected: ignore the edge
        const task = tasks.find((t) => t.id === taskId);
        if (!task || parentTaskIds.has(taskId)) return; // Skip parents in CPM graph

        visiting.add(taskId);
        task.predecessors.forEach(visit);
        visiting.delete(taskId);

        visited.add(taskId);
        sorted.push(task);
      };

      tasks.forEach((t) => {
        if (!parentTaskIds.has(t.id)) visit(t.id);
      });

      // Forward pass (Early Start/Finish)
      sorted.forEach((task) => {
        let baseStart = task.manualStartDate
          ? task.manualStartDate.getTime()
          : projectStartDate.getTime();
        let maxEarlyFinish = snapToWorkingDay(baseStart);
        let maxBaselineEarlyFinish = snapToWorkingDay(baseStart);

        task.predecessors.forEach((pid) => {
          const pred = tasks.find((t) => t.id === pid);
          if (pred && pred.earlyFinish) {
            const predFinish = snapToWorkingDay(pred.earlyFinish.getTime());
            if (predFinish > maxEarlyFinish) {
              maxEarlyFinish = predFinish;
            }
          }
          if (pred && (pred as any).baselineEarlyFinish) {
            const predBaseFinish = snapToWorkingDay(
              (pred as any).baselineEarlyFinish.getTime(),
            );
            if (predBaseFinish > maxBaselineEarlyFinish) {
              maxBaselineEarlyFinish = predBaseFinish;
            }
          }
        });

        const safeProgress = task.progress || 0;
        const actual =
          task.actualDuration !== undefined
            ? task.actualDuration
            : task.duration * (safeProgress / 100);
        const remaining =
          task.remainingDuration !== undefined
            ? task.remainingDuration
            : Math.max(0, task.duration - actual);

        if (task.type === "feeding_buffer") {
          if (task.originalBufferDuration === undefined) {
            task.originalBufferDuration = Math.max(1, task.duration);
            (task as any).baselineEndOfFeedingBuffer = addWorkingHoursMs(
              maxBaselineEarlyFinish,
              task.originalBufferDuration,
            );
          }
          const origDur = task.originalBufferDuration;
          const baselineEndMs =
            (task as any).baselineEndOfFeedingBuffer ||
            addWorkingHoursMs(maxBaselineEarlyFinish, origDur);

          task.earlyStart = new Date(maxEarlyFinish);

          // 合流バッファの役割は、後続タスクの開始日（＝ベースラインの終了期日）を守ること
          // 先行が遅れて maxEarlyFinish が baselineEndMs に近づけば、duration は減る
          const bufferRemainingMs = baselineEndMs - maxEarlyFinish;

          if (bufferRemainingMs > 0) {
            task.duration = Math.max(
              0,
              (bufferRemainingMs / (24 * 60 * 60 * 1000)) *
                (state.workingHoursPerDay || 6),
            );
            task.earlyFinish = new Date(baselineEndMs);
          } else {
            // バッファを食いつぶした（消費し切った）場合、期間は0になり後ろに押し出される
            task.duration = 0;
            task.earlyFinish = new Date(maxEarlyFinish);
          }

          (task as any).baselineEarlyStart = new Date(maxBaselineEarlyFinish);
          (task as any).baselineEarlyFinish = new Date(baselineEndMs);
        } else {
          const expectedDuration = actual + remaining;

          const resourceInfo = state.resources.find(
            (r) => r.id === task.resourceId,
          );
          const resProductivity = resourceInfo?.productivity || 1.0;
          const resCapacity = resourceInfo?.capacity;

          const requiredEffort = expectedDuration / resProductivity;
          const requiredBaselineEffort = task.duration / resProductivity;

          task.earlyStart = new Date(maxEarlyFinish);
          task.earlyFinish = new Date(
            addWorkingHoursMs(maxEarlyFinish, requiredEffort, resCapacity),
          );

          (task as any).baselineEarlyStart = new Date(maxBaselineEarlyFinish);
          (task as any).baselineEarlyFinish = new Date(
            addWorkingHoursMs(
              maxBaselineEarlyFinish,
              requiredBaselineEffort,
              resCapacity,
            ),
          );
        }

        // Default start/end to early dates
        task.startDate = new Date(task.earlyStart);
        task.endDate = new Date(task.earlyFinish);
      });

      // Update dynamic buffers inline based on store config
      const config = get().bufferConfig;
      let dynamicProjectBufferHours = 0;

      const leafTasks = tasks.filter(
        (t) => !tasks.some((p) => p.parentId === t.id),
      );
      const criticalTasks = leafTasks.filter(
        (t) => t.isCritical && t.type === "regular",
      );

      if (config.type === "ratio") {
        const totalPooledDuration = criticalTasks.reduce(
          (acc, t) => acc + ((t.originalEstimate || t.duration) - t.duration),
          0,
        );
        if (totalPooledDuration > 0) {
          // CCPM: 削られた安全余裕（プール）の合計の ratio % をプロジェクトバッファとする
          dynamicProjectBufferHours =
            totalPooledDuration * (config.ratio / 100);
        } else {
          const totalCriticalDuration = criticalTasks.reduce(
            (acc, t) => acc + t.duration,
            0,
          );
          dynamicProjectBufferHours =
            totalCriticalDuration * (config.ratio / 100);
        }
      } else if (config.type === "hours") {
        dynamicProjectBufferHours = config.hours;
      } else if (config.type === "endDate" && config.endDate) {
        let maxEarlyFinish = snapToWorkingDay(projectStartDate.getTime());
        const validPrecedingTasks = leafTasks.filter(
          (t) => t.type !== "project_buffer",
        );
        validPrecedingTasks.forEach((t) => {
          if ((t as any).baselineEarlyFinish) {
            const finish = snapToWorkingDay(
              (t as any).baselineEarlyFinish.getTime(),
            );
            if (finish > maxEarlyFinish) {
              maxEarlyFinish = finish;
            }
          }
        });
        const endMs = config.endDate.getTime();
        const adjustedEndMs = endMs + 24 * 60 * 60 * 1000;
        if (adjustedEndMs > maxEarlyFinish) {
          const daysDiff =
            (adjustedEndMs - maxEarlyFinish) / (24 * 60 * 60 * 1000);
          dynamicProjectBufferHours = Math.max(
            0,
            daysDiff * (state.workingHoursPerDay || 6),
          ); // Remove round so it's exact
        }
      }

      let totalDelay = 0;
      leafTasks.forEach((t) => {
        if (t.type !== "project_buffer" && t.type !== "feeding_buffer") {
          const safeProgress = t.progress || 0;
          const actual =
            t.actualDuration !== undefined
              ? t.actualDuration
              : t.duration * (safeProgress / 100);
          const remaining =
            t.remainingDuration !== undefined
              ? t.remainingDuration
              : Math.max(0, t.duration - actual);
          const expectedTotal = actual + remaining;
          const taskDelay = expectedTotal - t.duration;
          totalDelay += taskDelay;
        }
      });

      tasks.forEach((task) => {
        if (task.type === "project_buffer") {
          // Find max actual early finish to know where buffer STARTS
          let maxActualEarlyFinish = projectStartDate.getTime();
          let maxActualBaselineEarlyFinish = projectStartDate.getTime();

          leafTasks.forEach((t) => {
            if (t.type !== "project_buffer") {
              if (
                t.earlyFinish &&
                t.earlyFinish.getTime() > maxActualEarlyFinish
              ) {
                maxActualEarlyFinish = t.earlyFinish.getTime();
              }
              if (
                (t as any).baselineEarlyFinish &&
                (t as any).baselineEarlyFinish.getTime() >
                  maxActualBaselineEarlyFinish
              ) {
                maxActualBaselineEarlyFinish = (
                  t as any
                ).baselineEarlyFinish.getTime();
              }
            }
          });

          task.originalBufferDuration = dynamicProjectBufferHours; // new field to keep track
          (task as any).baselineEarlyStart = new Date(
            maxActualBaselineEarlyFinish,
          );

          if (config.type === "endDate" && config.endDate) {
            // In endDate mode, buffer ALWAYS finishes exactly at the config.endDate
            task.earlyStart = new Date(maxActualEarlyFinish);
            const endMs = config.endDate.getTime();
            const adjustedEndMs = endMs + 24 * 60 * 60 * 1000;
            task.earlyFinish = new Date(
              Math.max(task.earlyStart.getTime(), adjustedEndMs),
            );
            const actualDiff = adjustedEndMs - maxActualEarlyFinish;
            task.duration = Math.max(
              0,
              (actualDiff / (24 * 60 * 60 * 1000)) *
                (state.workingHoursPerDay || 6), // Use dynamic adjustedEndMs here correctly
            );
          } else {
            task.duration = Math.max(0, dynamicProjectBufferHours - totalDelay);
            // In ratio/hours mode, the literal target end date shifts based on original baseline
            task.earlyStart = new Date(maxActualEarlyFinish);
            task.earlyFinish = new Date(
              addWorkingHoursMs(task.earlyStart.getTime(), task.duration),
            );
          }
          task.endDate = new Date(task.earlyFinish);
        }
      });

      // Backward pass (Late Start/Finish & Slack)
      let projectEndWithoutBuffer = projectStartDate.getTime();
      sorted.forEach((t) => {
        if (
          t.type !== "project_buffer" &&
          t.earlyFinish &&
          t.earlyFinish.getTime() > projectEndWithoutBuffer
        ) {
          projectEndWithoutBuffer = t.earlyFinish.getTime();
        }
      });

      [...sorted].reverse().forEach((task) => {
        let minLateStart =
          task.type === "project_buffer"
            ? task.earlyFinish!.getTime()
            : projectEndWithoutBuffer;
        // find successors
        const successors = tasks.filter((t) =>
          t.predecessors.includes(task.id),
        );
        successors.forEach((succ) => {
          if (succ.lateStart && succ.lateStart.getTime() < minLateStart) {
            minLateStart = succ.lateStart.getTime();
          }
        });

        task.lateFinish = new Date(minLateStart);

        if (task.type === "project_buffer" || task.type === "feeding_buffer") {
          task.lateStart = new Date(
            subWorkingHoursMs(minLateStart, task.duration),
          );
        } else {
          const resourceInfo = state.resources.find(
            (r) => r.id === task.resourceId,
          );
          const resProductivity = resourceInfo?.productivity || 1.0;
          const resCapacity = resourceInfo?.capacity;
          const safeProgress = task.progress || 0;
          const actual =
            task.actualDuration !== undefined
              ? task.actualDuration
              : task.duration * (safeProgress / 100);
          const remaining =
            task.remainingDuration !== undefined
              ? task.remainingDuration
              : Math.max(0, task.duration - actual);
          const expectedDuration = actual + remaining;
          const requiredEffort = expectedDuration / resProductivity;
          task.lateStart = new Date(
            subWorkingHoursMs(minLateStart, requiredEffort, resCapacity),
          );
        }

        task.slack =
          (task.lateFinish.getTime() - task.earlyFinish!.getTime()) /
          (24 * 60 * 60 * 1000);
        task.isCritical = task.slack <= 0;
      });

      // Calculate Parent Tasks bounds
      const calculateParentBounds = (parentId: string) => {
        const children = tasks.filter((t) => t.parentId === parentId);
        if (children.length === 0) return;

        let minStart = Number.MAX_SAFE_INTEGER;
        let maxEnd = 0;
        let maxLateEnd = 0;
        let minSlack = Number.MAX_SAFE_INTEGER;

        let totalDuration = 0;
        let totalActualDuration = 0;
        let totalRemainingDuration = 0;

        children.forEach((c) => {
          // Recursively calculate if child is also a parent
          if (parentTaskIds.has(c.id)) calculateParentBounds(c.id);

          if (c.earlyStart && c.earlyStart.getTime() < minStart)
            minStart = c.earlyStart.getTime();
          if (c.earlyFinish && c.earlyFinish.getTime() > maxEnd)
            maxEnd = c.earlyFinish.getTime();
          if (c.lateFinish && c.lateFinish.getTime() > maxLateEnd)
            maxLateEnd = c.lateFinish.getTime();
          if (c.slack !== undefined && c.slack < minSlack) minSlack = c.slack;

          totalDuration += c.duration;
          totalActualDuration +=
            c.actualDuration !== undefined
              ? c.actualDuration
              : c.duration * ((c.progress || 0) / 100);
          totalRemainingDuration +=
            c.remainingDuration !== undefined
              ? c.remainingDuration
              : Math.max(
                  0,
                  c.duration -
                    (c.actualDuration !== undefined
                      ? c.actualDuration
                      : c.duration * ((c.progress || 0) / 100)),
                );
        });

        const parent = tasks.find((t) => t.id === parentId);
        if (parent && minStart !== Number.MAX_SAFE_INTEGER && maxEnd !== 0) {
          parent.earlyStart = new Date(minStart);
          parent.earlyFinish = new Date(maxEnd);
          parent.startDate = new Date(minStart);
          parent.endDate = new Date(maxEnd);

          parent.duration = totalDuration;
          parent.actualDuration = totalActualDuration;
          parent.remainingDuration = totalRemainingDuration;

          parent.isCritical = minSlack <= 0;
          parent.slack = minSlack !== Number.MAX_SAFE_INTEGER ? minSlack : 0;

          const expectedWork = totalActualDuration + totalRemainingDuration;
          parent.progress =
            expectedWork > 0
              ? Math.round((totalActualDuration / expectedWork) * 100)
              : 0;
        }
      };

      // Find top-level parents and iterate
      const rootParents = Array.from(parentTaskIds).filter((pid) => {
        if (!pid) return false;
        const t = tasks.find((x) => x.id === pid);
        return t && !t.parentId;
      });
      rootParents.forEach((pid) => calculateParentBounds(pid as string));

      // Calculate feeding buffers for non-critical edges (Plan 2)
      const feedRatio = get().bufferConfig.feedingBufferRatio / 100;
      tasks.forEach((task) => {
        if (
          !task.isCritical &&
          task.type === "regular" &&
          !parentTaskIds.has(task.id)
        ) {
          const successors = tasks.filter((t) =>
            t.predecessors.includes(task.id),
          );
          const hasCriticalSuccessor = successors.some((t) => t.isCritical);

          if (hasCriticalSuccessor) {
            // Calculate chain length
            const visited = new Set<string>();
            const walkBack = (tId: string): number => {
              if (visited.has(tId)) return 0;
              visited.add(tId);
              const node = tasks.find((x) => x.id === tId);
              if (!node || node.isCritical) return 0;
              let maxP = 0;
              node.predecessors.forEach((pid) => {
                maxP = Math.max(maxP, walkBack(pid));
              });
              return maxP + node.duration;
            };
            const chainLen = walkBack(task.id);
            // Limit buffer to slack hours
            task.calculatedFeedingBuffer = Math.min(
              chainLen * feedRatio,
              (task.slack || 0) * (state.workingHoursPerDay || 6),
            );
          } else {
            task.calculatedFeedingBuffer = 0;
          }
        } else {
          task.calculatedFeedingBuffer = 0;
        }
      });

      return { tasks };
    });
  },
}));
