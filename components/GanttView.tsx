"use client";
import { useStore, Task, addWorkingHoursMs, isWorkingDay, ColumnDef, defaultGanttColumns } from "@/lib/store";
import { Plus, GripVertical, ArrowRight, Columns, Check, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import * as JapaneseHolidays from "japanese-holidays";

const DayWidth = 32; // px
const RowHeight = 32; // h-8 = 32px

const formatDate = (date?: Date | string | null) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatEndDate = (date?: Date | string | null) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  if (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  ) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateString = (val: string) => {
  if (!val) return undefined;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseEndDateString = (val: string) => {
  if (!val) return undefined;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
};

const DraggableTaskBar = ({
  task,
  startOffset,
  extraPastDays,
  isParent,
  isDrawingConnection,
  onStartConnection,
  onHoverConnection,
  progressOverride,
}: {
  task: Task;
  startOffset: number;
  extraPastDays: number;
  isParent: boolean;
  isDrawingConnection?: boolean;
  onStartConnection?: (taskId: string, e: React.MouseEvent) => void;
  onHoverConnection?: (taskId: string | null) => void;
  progressOverride?: number;
}) => {
  const { updateTask, projectStartDate, workingHoursPerDay } = useStore();
  const safeProgress =
    progressOverride !== undefined ? progressOverride : task.progress || 0;
  const actual =
    task.actualDuration !== undefined
      ? task.actualDuration
      : task.duration * (safeProgress / 100);
  const remaining =
    task.remainingDuration !== undefined
      ? task.remainingDuration
      : Math.max(0, task.duration - actual);
  const expectedTotal = isParent ? task.duration : actual + remaining;

  const [isResizing, setIsResizing] = useState(false);
  const [localDuration, setLocalDuration] = useState(expectedTotal);

  const [isMoving, setIsMoving] = useState(false);
  const [localStartOffset, setLocalStartOffset] = useState(startOffset);

  useEffect(() => {
    if (!isResizing) {
      setLocalDuration(expectedTotal);
    }
  }, [expectedTotal, isResizing]);

  const [isResizingLeft, setIsResizingLeft] = useState(false);

  useEffect(() => {
    if (!isResizingLeft && !isMoving) {
      setLocalStartOffset(startOffset);
    }
  }, [startOffset, isResizingLeft, isMoving]);

  useEffect(() => {
    if (!isResizing && !isResizingLeft) {
      setLocalDuration(expectedTotal);
    }
  }, [expectedTotal, isResizing, isResizingLeft]);

  const startResizeLeft = (e: React.MouseEvent) => {
    if (
      task.parentId === undefined &&
      useStore.getState().tasks.some((t) => t.parentId === task.id)
    )
      return;

    e.preventDefault();
    e.stopPropagation();
    setIsResizingLeft(true);
    const scrollContainer = document.getElementById("gantt-scroll-container");
    const initialScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
    const startX = e.clientX + initialScroll;
    const initialDuration = localDuration;
    const initialOffset = localStartOffset;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = moveEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      let dayDiff = diffX / DayWidth;

      const targetDuration = initialDuration - dayDiff * workingHoursPerDay;
      const newDuration = Math.max(
        workingHoursPerDay,
        Math.round(targetDuration / workingHoursPerDay) * workingHoursPerDay,
      );

      // Re-calculate actualDayDiff based on the clamped newDuration
      const actualDayDiff =
        (initialDuration - newDuration) / workingHoursPerDay;
      const newOffset = initialOffset + actualDayDiff;

      setLocalDuration(newDuration);
      setLocalStartOffset(newOffset);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizingLeft(false);

      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = upEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      let dayDiff = diffX / DayWidth;

      const targetDuration = initialDuration - dayDiff * workingHoursPerDay;
      const newDuration = Math.max(
        workingHoursPerDay,
        Math.round(targetDuration / workingHoursPerDay) * workingHoursPerDay,
      );
      const actualDayDiff =
        (initialDuration - newDuration) / workingHoursPerDay;
      const newOffset = initialOffset + actualDayDiff;

      if (newDuration !== initialDuration || newOffset !== initialOffset) {
        const newStartDate = new Date(
          projectStartDate.getTime() + newOffset * 24 * 60 * 60 * 1000,
        );
        const safeProgress = task.progress || 0;
        const actual =
          task.actualDuration !== undefined
            ? task.actualDuration
            : task.duration * (safeProgress / 100);

        const newRemaining = newDuration - actual;

        updateTask(task.id, {
          manualStartDate: newStartDate,
          remainingDuration: newRemaining,
        });
      } else {
        setLocalDuration(initialDuration);
        setLocalStartOffset(initialOffset);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const [isProgressResizing, setIsProgressResizing] = useState(false);
  const [localProgress, setLocalProgress] = useState(task.progress || 0);

  useEffect(() => {
    if (!isProgressResizing) {
      setLocalProgress(task.progress || 0);
    }
  }, [task.progress, isProgressResizing]);

  const startProgressResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsProgressResizing(true);
    const scrollContainer = document.getElementById("gantt-scroll-container");
    const initialScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
    const startX = e.clientX + initialScroll;
    const initialProgress = localProgress;

    const safeProgress = task.progress || 0;
    const actualLocal =
      task.actualDuration !== undefined
        ? task.actualDuration
        : task.duration * (safeProgress / 100);
    const remainingLocal =
      task.remainingDuration !== undefined
        ? task.remainingDuration
        : Math.max(0, task.duration - actualLocal);
    const expectedTotalLocal = actualLocal + remainingLocal;
    const displayDuration = expectedTotalLocal;
    const widthPx = (displayDuration / workingHoursPerDay) * DayWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = moveEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const diffPercent = (diffX / widthPx) * 100;
      let newProgress = initialProgress + diffPercent;
      newProgress = Math.max(0, Math.min(100, newProgress));
      setLocalProgress(newProgress);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsProgressResizing(false);

      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = upEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const diffPercent = (diffX / widthPx) * 100;
      let newProgress = Math.round((initialProgress + diffPercent) / 10) * 10;
      newProgress = Math.max(0, Math.min(100, newProgress));

      if (newProgress !== task.progress) {
        updateTask(task.id, {
          progress: newProgress,
          status:
            newProgress === 100
              ? "done"
              : newProgress === 0
                ? "todo"
                : "in_progress",
        });
      } else {
        setLocalProgress(task.progress || 0);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const scrollContainer = document.getElementById("gantt-scroll-container");
    const initialScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
    const startX = e.clientX + initialScroll;
    const initialDuration = localDuration;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = moveEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const dayDiff = diffX / DayWidth;
      const targetDuration = initialDuration + dayDiff * workingHoursPerDay;
      const newDuration = Math.max(
        workingHoursPerDay,
        Math.round(targetDuration / workingHoursPerDay) * workingHoursPerDay,
      );
      setLocalDuration(newDuration);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);

      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = upEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const dayDiff = diffX / DayWidth;
      const targetDuration = initialDuration + dayDiff * workingHoursPerDay;
      const newDuration = Math.max(
        workingHoursPerDay,
        Math.round(targetDuration / workingHoursPerDay) * workingHoursPerDay,
      );

      if (newDuration !== initialDuration) {
        const safeProgress = task.progress || 0;
        const actual =
          task.actualDuration !== undefined
            ? task.actualDuration
            : task.duration * (safeProgress / 100);

        const newRemaining = newDuration - actual;

        updateTask(task.id, {
          remainingDuration: newRemaining,
        });
      } else {
        setLocalDuration(initialDuration);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startMove = (e: React.MouseEvent) => {
    if (
      task.parentId === undefined &&
      useStore.getState().tasks.some((t) => t.parentId === task.id)
    )
      return;

    e.preventDefault();
    setIsMoving(true);
    const scrollContainer = document.getElementById("gantt-scroll-container");
    const initialScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
    const startX = e.clientX + initialScroll;
    const initialOffset = localStartOffset;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = moveEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const dayDiff = diffX / DayWidth;
      setLocalStartOffset(initialOffset + dayDiff);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsMoving(false);

      const currentScroll = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currentX = upEvent.clientX + currentScroll;
      const diffX = currentX - startX;
      const dayDiff = Math.round(diffX / DayWidth);
      const newOffset = Math.round(initialOffset + dayDiff);

      if (newOffset !== initialOffset) {
        const newStartDate = new Date(
          projectStartDate.getTime() + newOffset * 24 * 60 * 60 * 1000,
        );
        updateTask(task.id, { manualStartDate: newStartDate });
      } else {
        setLocalStartOffset(initialOffset);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const displayDuration =
    isResizing || isResizingLeft ? localDuration : expectedTotal;

  const currentStartOffset =
    isMoving || isResizingLeft ? localStartOffset : startOffset;

  let widthPx = 0;
  if (isResizing || isResizingLeft || isMoving) {
    const startMs =
      projectStartDate.getTime() + currentStartOffset * 24 * 60 * 60 * 1000;
    const endMs = addWorkingHoursMs(startMs, displayDuration);
    widthPx = Math.max(
      DayWidth,
      ((endMs - startMs) / (24 * 60 * 60 * 1000)) * DayWidth,
    );
  } else {
    if (task.earlyStart && task.earlyFinish) {
      widthPx =
        ((task.earlyFinish.getTime() - task.earlyStart.getTime()) /
          (24 * 60 * 60 * 1000)) *
        DayWidth;
      if (widthPx === 0 && displayDuration > 0)
        widthPx = (displayDuration / workingHoursPerDay) * DayWidth;
    } else {
      widthPx = (displayDuration / workingHoursPerDay) * DayWidth;
    }
  }

  const nonWorkingDays = useMemo(() => {
    const days: number[] = [];
    if (widthPx <= 0) return days;
    const startMs =
      projectStartDate.getTime() + currentStartOffset * 24 * 60 * 60 * 1000;
    const durationDays = Math.ceil(widthPx / DayWidth);
    for (let i = 0; i < durationDays; i++) {
      const d = new Date(startMs + i * 24 * 60 * 60 * 1000);
      if (!isWorkingDay(d)) {
        days.push(i);
      }
    }
    return days;
  }, [projectStartDate, currentStartOffset, widthPx]);

  if (isParent) {
    // It's a parent / group task
    return (
      <div
        className="absolute h-[8px] top-1/2 -translate-y-1/2 flex select-none z-10"
        style={{
          left: `${(startOffset + extraPastDays) * DayWidth}px`,
          width: `${widthPx}px`,
        }}
        title={`${task.name} (${Math.round(safeProgress)}%)`}
      >
        <div className="relative w-full h-full bg-slate-200 rounded-sm overflow-hidden">
          <div
            className="h-full bg-slate-500 transition-all duration-300"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
        <div className="absolute left-0 top-full w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-transparent border-t-slate-500" />
        <div className="absolute right-0 top-full w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-transparent border-t-slate-500" />
      </div>
    );
  }

  let currentProgress = isProgressResizing ? localProgress : task.progress || 0;

  let colorTheme = {
    container: "bg-indigo-50 border-indigo-400 text-indigo-800",
    fill: "bg-indigo-200",
  };

  if (task.type === "project_buffer" || task.type === "feeding_buffer") {
    if (task.type === "project_buffer" && task.originalBufferDuration) {
      colorTheme = {
        container: "bg-emerald-50 border-emerald-500 text-emerald-900",
        fill: "bg-emerald-200",
      };
    } else {
      colorTheme = {
        container: "bg-amber-50 border-amber-400 text-amber-800",
        fill: "bg-amber-200",
      };
    }
  } else if (task.isCritical) {
    colorTheme = {
      container: "bg-rose-50 border-rose-500 text-rose-800",
      fill: "bg-[#fca5a5]", // red-300
    };
  }

  const canResize = task.type !== "project_buffer" && !isParent;

  return (
    <div
      data-no-pan="true"
      className={`absolute flex items-center group transition-all duration-75 ${isResizing || isResizingLeft ? "z-50" : "z-10"}`}
      style={{
        left: `${(currentStartOffset + extraPastDays) * DayWidth}px`,
        width: `${widthPx}px`,
      }}
    >
      <div
        onMouseDown={startMove}
        className={`relative w-full h-5 rounded shadow-sm border text-[10px] sm:text-xs leading-none font-medium select-none overflow-hidden ${colorTheme.container} cursor-grab active:cursor-grabbing ${isResizing || isResizingLeft ? "shadow-lg scale-y-105 opacity-90" : "group-hover:scale-y-105 transition-transform"}`}
      >
        <div
          className={`absolute top-0 left-0 h-full pointer-events-none ${isProgressResizing ? "" : "transition-all duration-75"} ${colorTheme.fill}`}
          style={{ width: `${currentProgress}%` }}
        />
        <div className="absolute inset-0 flex items-center px-2 truncate hidden sm:flex pointer-events-none whitespace-nowrap z-10 text-inherit drop-shadow-sm">
          {task.type === "project_buffer" && task.originalBufferDuration ? (
            <span className="font-bold flex items-center gap-2">
              <span className="text-white drop-shadow-md pb-[1px]">
                消費{" "}
                {Number(
                  (task.originalBufferDuration - task.duration).toFixed(2),
                )}
                h
              </span>
              <span className="text-emerald-900">
                / 残 {Number(task.duration.toFixed(2))}h
              </span>
            </span>
          ) : (
            <>{Number(currentProgress.toFixed(0))}%</>
          )}
        </div>
      </div>

      {/* Progress drag handle */}
      {task.type !== "project_buffer" && (
        <div
          onMouseDown={startProgressResize}
          className={`absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize flex items-center justify-center z-20 touch-none group/progress ${isProgressResizing ? "bg-black/10" : "hover:bg-black/10"}`}
          style={{ left: `${currentProgress}%` }}
        >
          <div
            className={`w-1 h-3/4 bg-slate-500/50 rounded-full transition-opacity ${isProgressResizing ? "opacity-100" : "opacity-0 group-hover/progress:opacity-100"}`}
          />
        </div>
      )}

      {/* Left resize handle */}
      {canResize && (
        <div
          onMouseDown={startResizeLeft}
          className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-2.5 h-5 bg-white border border-slate-300 shadow-sm rounded-[2px] flex items-center justify-center cursor-ew-resize touch-none z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50"
        >
          <GripVertical className="w-[8px] h-3 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Right resize handle */}
      {canResize && (
        <div
          onMouseDown={startResize}
          className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-2.5 h-5 bg-white border border-slate-300 shadow-sm rounded-[2px] flex items-center justify-center cursor-ew-resize touch-none z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50"
        >
          <GripVertical className="w-[8px] h-3 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Connection Handles */}
      {!isParent && canResize && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartConnection?.(task.id, e);
          }}
          className="absolute top-1/2 -right-[30px] -translate-y-1/2 w-[18px] h-[18px] bg-blue-500 hover:bg-blue-600 rounded-full cursor-crosshair z-30 opacity-0 group-hover:opacity-100 transition-opacity border-[1.5px] border-white shadow-sm flex items-center justify-center"
          title="ドラッグして後続タスクに接続"
        >
          <ArrowRight className="w-3 h-3 text-white pointer-events-none" />
        </div>
      )}

      {!isParent && isDrawingConnection && (
        <div
          onMouseEnter={() => onHoverConnection?.(task.id)}
          onMouseLeave={() => onHoverConnection?.(null)}
          className="absolute top-1/2 -left-[30px] -translate-y-1/2 w-[18px] h-[18px] bg-emerald-500 rounded-full z-30 transition-all border-[1.5px] border-white hover:bg-emerald-600 shadow-sm flex items-center justify-center opacity-100"
          title="ドロップして接続"
        >
          <ArrowRight className="w-3 h-3 text-white pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default function GanttView() {
  const {
    tasks,
    resources,
    addTask,
    projectStartDate,
    bufferConfig,
    setBufferConfig,
    getProjectBufferHours,
    ganttSettings,
    setGanttSettings,
  } = useStore();
  const [newTaskName, setNewTaskName] = useState("");
  const [confirmDeleteConn, setConfirmDeleteConn] = useState<{
    predId: string;
    targetId: string;
  } | null>(null);

  const [extraPastDays, setExtraPastDays] = useState(30);
  const [extraFutureDays, setExtraFutureDays] = useState(60);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const {
    selectedResources = [],
    viewMode = "wbs",
    columns = defaultGanttColumns,
    collapsedTasks: collapsedTasksArray = [],
  } = ganttSettings || {};

  const collapsedTasks = useMemo(
    () => new Set(collapsedTasksArray),
    [collapsedTasksArray],
  );

  const setSelectedResources = (
    res: string[] | ((prev: string[]) => string[]),
  ) => {
    setGanttSettings({
      selectedResources:
        typeof res === "function" ? res(selectedResources) : res,
    });
  };
  const setViewMode = (mode: "wbs" | "resource") => {
    setGanttSettings({ viewMode: mode });
  };
  const setColumns = (newCols: ColumnDef[] | ((prev: ColumnDef[]) => ColumnDef[])) => {
    setGanttSettings({ columns: typeof newCols === "function" ? newCols(columns) : newCols });
  };
  const setCollapsedTasks = (
    newSet: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => {
    const s = typeof newSet === "function" ? newSet(collapsedTasks) : newSet;
    setGanttSettings({ collapsedTasks: Array.from(s) });
  };

  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<
    "before" | "after" | "inside" | null
  >(null);

  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDragOverColId(colId), 0);
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    if (!draggedColId) return;
    e.preventDefault();
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleColDrop = (e: React.DragEvent, dropColId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    if (!draggedColId || draggedColId === dropColId) {
      setDraggedColId(null);
      return;
    }

    const newCols = [...columns];
    const fromIndex = newCols.findIndex((c) => c.id === draggedColId);
    const toIndex = newCols.findIndex((c) => c.id === dropColId);
    if (fromIndex >= 0 && toIndex >= 0) {
      const [removed] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, removed);
      setColumns(newCols);
    }
    setDraggedColId(null);
  };

  const handleColDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 1) ||
      (direction === "down" && index === columns.length - 1) ||
      index === 0
    )
      return;

    const newCols = [...columns];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newCols[index], newCols[targetIndex]] = [
      newCols[targetIndex],
      newCols[index],
    ];
    setColumns(newCols);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, id: string) => {
    const idsToDrag = [id];
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "task", ids: idsToDrag }),
    );
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDraggingIds(idsToDrag), 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (draggingIds.length === 0 || draggingIds.includes(id)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    let pos: "before" | "after" | "inside" = "inside";
    if (y < rect.height * 0.25) pos = "before";
    else if (y > rect.height * 0.75) pos = "after";

    const state = useStore.getState();
    const targetTask = state.tasks.find((t) => t.id === id);
    const hasChildren = state.tasks.some((t) => t.parentId === id);
    if (targetTask?.isExpanded && hasChildren && pos === "after") {
      pos = "inside";
    }

    if (dragOverId !== id || dropPosition !== pos) {
      setDragOverId(id);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    setDragOverId(null);
    setDropPosition(null);

    if (draggingIds.length === 0 || draggingIds.includes(id) || !dropPosition) {
      setDraggingIds([]);
      return;
    }

    if (draggingIds.length === 1) {
      useStore.getState().reorderTask(draggingIds[0], id, dropPosition);
    } else {
      useStore.getState().reorderTasksMulti(draggingIds, id, dropPosition);
    }
    setDraggingIds([]);
  };

  const handleDragEnd = () => {
    setDraggingIds([]);
    setDragOverId(null);
    setDropPosition(null);
  };

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const leftPaneWidth = columns
    .filter((c) => c.visible)
    .reduce((sum, col) => sum + col.width, 0);

  const toggleCollapse = (taskId: string) => {
    setCollapsedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return newSet;
    });
  };

  const [drawingConn, setDrawingConn] = useState<{
    startId: string;
    endId?: string | null;
    startX?: number;
    startY?: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [editingCell, setEditingCell] = useState<{
    r: number;
    c: string;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    r: number;
    c: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("#gantt-scroll-container")) {
        setSelectedCell(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const closest = target.closest("[data-row][data-col]") as HTMLElement;
    if (!closest) return;
    const rowStr = closest.dataset.row;
    const colStr = closest.dataset.col;
    if (!rowStr || !colStr) return;

    const row = parseInt(rowStr, 10);
    const col = colStr;

    const activeCols = columns.filter((c) => c.visible).map((c) => c.id);

    const colIdx = activeCols.indexOf(col);
    if (colIdx === -1) return;

    const isEditing = editingCell?.r === row && editingCell?.c === col;

    if (isEditing) {
      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        setEditingCell(null);
        setTimeout(() => {
          const el = document.querySelector(
            `[data-row="${row + 1}"][data-col="${col}"]`,
          ) as HTMLElement;
          if (el) {
            el.focus({ preventScroll: true });
            const scrollContainer = el.closest(".overflow-auto") as HTMLElement;
            if (scrollContainer) {
              const rect = el.getBoundingClientRect();
              const containerRect = scrollContainer.getBoundingClientRect();
              const headerHeight = 40;
              const footerHeight = 40;
              if (rect.top < containerRect.top + headerHeight) {
                scrollContainer.scrollTop -=
                  containerRect.top + headerHeight - rect.top;
              } else if (rect.bottom > containerRect.bottom - footerHeight) {
                scrollContainer.scrollTop +=
                  rect.bottom - (containerRect.bottom - footerHeight);
              }
            }
          }
        }, 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
        setTimeout(() => {
          const el = document.querySelector(
            `[data-row="${row}"][data-col="${col}"]`,
          ) as HTMLElement;
          if (el) el.focus();
        }, 0);
      }
      return;
    }

    let nextRow = row;
    let nextColIdx = colIdx;
    let handled = false;

    if (e.key === "ArrowDown") {
      nextRow++;
      handled = true;
    } else if (e.key === "ArrowUp") {
      nextRow = Math.max(0, row - 1);
      handled = true;
    } else if (e.key === "ArrowRight") {
      nextColIdx = Math.min(activeCols.length - 1, colIdx + 1);
      handled = true;
    } else if (e.key === "ArrowLeft") {
      nextColIdx = Math.max(0, colIdx - 1);
      handled = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        col !== "expected" &&
        !target.classList.contains("cursor-not-allowed")
      ) {
        setEditingCell({ r: row, c: col });
      }
      return;
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (
        col !== "expected" &&
        !target.classList.contains("cursor-not-allowed")
      ) {
        setEditingCell({ r: row, c: col });
      }
      return; // let character type into input once it renders
    }

    if (handled) {
      e.preventDefault();
      const nextCol = activeCols[nextColIdx];
      setTimeout(() => {
        let actualNextRow = nextRow;
        let nextEl = document.querySelector(
          `[data-row="${actualNextRow}"][data-col="${nextCol}"]`,
        ) as HTMLElement;
        while (!nextEl && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          if (e.key === "ArrowDown") actualNextRow++;
          else actualNextRow--;
          if (actualNextRow < 0 || actualNextRow > tasks.length + 10) break;
          nextEl = document.querySelector(
            `[data-row="${actualNextRow}"][data-col="${nextCol}"]`,
          ) as HTMLElement;
        }
        if (nextEl) {
          setSelectedCell({ r: actualNextRow, c: nextCol });
          nextEl.focus({ preventScroll: true });
          const scrollContainer = nextEl.closest(
            ".overflow-auto",
          ) as HTMLElement;
          if (scrollContainer) {
            const rect = nextEl.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const headerHeight = 40;
            const footerHeight = 40;
            if (rect.top < containerRect.top + headerHeight) {
              scrollContainer.scrollTop -=
                containerRect.top + headerHeight - rect.top;
            } else if (rect.bottom > containerRect.bottom - footerHeight) {
              scrollContainer.scrollTop +=
                rect.bottom - (containerRect.bottom - footerHeight);
            }
          }
        }
      }, 0);
    }
  };

  const handleStartConnection = (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const svgContainer = document.getElementById("gantt-svg-container");
    if (!svgContainer) return;
    const rect = svgContainer.getBoundingClientRect();
    setDrawingConn({
      startId: taskId,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    if (!drawingConn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svgContainer = document.getElementById("gantt-svg-container");
      if (!svgContainer) return;
      const rect = svgContainer.getBoundingClientRect();
      setDrawingConn((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX - rect.left,
              currentY: e.clientY - rect.top,
            }
          : null,
      );
    };

    const handleMouseUp = () => {
      setDrawingConn((prev) => {
        if (prev && prev.endId && prev.startId !== prev.endId) {
          const state = useStore.getState();

          const hasCycle = (startId: string, targetId: string) => {
            const visited = new Set<string>();
            const queue = [startId];
            while (queue.length > 0) {
              const current = queue.shift()!;
              if (current === targetId) return true;
              if (!visited.has(current)) {
                visited.add(current);
                const t = state.tasks.find((t) => t.id === current);
                if (t) {
                  queue.push(...t.predecessors);
                }
              }
            }
            return false;
          };

          if (!hasCycle(prev.startId, prev.endId)) {
            const endTask = state.tasks.find((t) => t.id === prev.endId);
            if (endTask && !endTask.predecessors.includes(prev.startId)) {
              state.updateTask(endTask.id, {
                predecessors: [...endTask.predecessors, prev.startId],
              });
            }
          }
        }
        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drawingConn]);

  const visibleTasks = useMemo(() => {
    if (viewMode === "wbs") {
      return tasks.filter((t) => {
        let current = t.parentId;
        while (current) {
          if (collapsedTasks.has(current)) return false;
          const parent = tasks.find((p) => p.id === current);
          current = parent?.parentId;
        }
        return true;
      });
    } else {
      const byResId = new Map<string, Task[]>();
      resources.forEach((r) => byResId.set(r.id, []));
      const unassigned: Task[] = [];

      tasks.forEach((t) => {
        // Skip parent tasks in resource view for simplicity
        if (tasks.some((p) => p.parentId === t.id)) return;
        if (t.type === "project_buffer" || t.type === "feeding_buffer") return;
        if (t.resourceId && byResId.has(t.resourceId)) {
          byResId.get(t.resourceId)!.push(t);
        } else {
          unassigned.push(t);
        }
      });

      const result: Task[] = [];
      resources.forEach((res) => {
        if (selectedResources.length > 0 && !selectedResources.includes(res.id))
          return;

        const items = byResId.get(res.id)!;
        if (items.length > 0) {
          const earlyStarts = items.map(
            (t) => t.earlyStart?.getTime() || projectStartDate.getTime(),
          );
          const ends = items.map((t) => {
            const st = t.earlyStart?.getTime() || projectStartDate.getTime();
            const pd = t.progress || 0;
            const act =
              t.actualDuration !== undefined
                ? t.actualDuration
                : t.duration * (pd / 100);
            const rem =
              t.remainingDuration !== undefined
                ? t.remainingDuration
                : Math.max(0, t.duration - act);
            const exp = act + rem;
            return st + (exp / 8) * 24 * 60 * 60 * 1000;
          });
          const minStart = new Date(Math.min(...earlyStarts));
          const maxEnd = Math.max(...ends);
          const dur = Math.max(
            0,
            ((maxEnd - minStart.getTime()) / (24 * 60 * 60 * 1000)) * 8,
          );

          result.push({
            id: `__res_${res.id}`,
            name: res.name,
            duration: dur,
            earlyStart: minStart,
            status: "todo",
            type: "regular",
            predecessors: [],
            progress: 0,
            isVirtualGroup: true,
          } as any);
          if (!collapsedTasks.has(`__res_${res.id}`)) {
            result.push(...items);
          }
        }
      });
      if (
        unassigned.length > 0 &&
        (selectedResources.length === 0 ||
          selectedResources.includes("unassigned"))
      ) {
        const earlyStarts = unassigned.map(
          (t) => t.earlyStart?.getTime() || projectStartDate.getTime(),
        );
        const ends = unassigned.map((t) => {
          const st = t.earlyStart?.getTime() || projectStartDate.getTime();
          const pd = t.progress || 0;
          const act =
            t.actualDuration !== undefined
              ? t.actualDuration
              : t.duration * (pd / 100);
          const rem =
            t.remainingDuration !== undefined
              ? t.remainingDuration
              : Math.max(0, t.duration - act);
          const exp = act + rem;
          return st + (exp / 8) * 24 * 60 * 60 * 1000;
        });
        const minStart = new Date(Math.min(...earlyStarts));
        const maxEnd = Math.max(...ends);
        const dur = Math.max(
          0,
          ((maxEnd - minStart.getTime()) / (24 * 60 * 60 * 1000)) * 8,
        );

        result.push({
          id: `__res_unassigned`,
          name: "未割当",
          duration: dur,
          earlyStart: minStart,
          status: "todo",
          type: "regular",
          predecessors: [],
          progress: 0,
          isVirtualGroup: true,
        } as any);
        if (!collapsedTasks.has("__res_unassigned")) {
          result.push(...unassigned);
        }
      }
      return result;
    }
  }, [
    tasks,
    collapsedTasks,
    viewMode,
    resources,
    projectStartDate,
    selectedResources,
  ]);

  const taskTotals = useMemo(() => {
    const totals: Record<
      string,
      {
        duration: number;
        actual: number;
        expected: number;
        isParent: boolean;
        remaining: number;
        progress?: number;
      }
    > = {};
    tasks.forEach((task) => {
      const isParent = tasks.some((t) => t.parentId === task.id);
      if (isParent) {
        let totalDuration = 0;
        let totalActual = 0;
        let totalRemaining = 0;
        const sumRecursive = (id: string) => {
          const directChildren = tasks.filter((t) => t.parentId === id);
          if (directChildren.length === 0) {
            const leaf = tasks.find((t) => t.id === id);
            if (!leaf) return;
            const actual =
              leaf.actualDuration !== undefined
                ? leaf.actualDuration
                : leaf.duration * ((leaf.progress || 0) / 100);
            const rem =
              leaf.remainingDuration !== undefined
                ? leaf.remainingDuration
                : Math.max(0, leaf.duration - actual);
            totalDuration += leaf.duration;
            totalActual += actual;
            totalRemaining += rem;
          } else {
            directChildren.forEach((c) => sumRecursive(c.id));
          }
        };
        sumRecursive(task.id);
        const expected = totalActual + totalRemaining;
        totals[task.id] = {
          duration: totalDuration,
          actual: totalActual,
          remaining: totalRemaining,
          expected: expected,
          progress: expected > 0 ? (totalActual / expected) * 100 : 0,
          isParent: true,
        };
      } else {
        const actual =
          task.actualDuration !== undefined
            ? task.actualDuration
            : task.duration * ((task.progress || 0) / 100);
        const rem =
          task.remainingDuration !== undefined
            ? task.remainingDuration
            : Math.max(0, task.duration - actual);
        const expected = actual + rem;
        totals[task.id] = {
          duration: task.duration,
          actual,
          remaining: rem,
          expected: expected,
          progress: expected > 0 ? (actual / expected) * 100 : 0,
          isParent: false,
        };
      }
    });
    return totals;
  }, [tasks]);

  const handleColumnResize = (
    e: React.MouseEvent,
    colId: string,
    width: number,
    minWidth: number,
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(minWidth, startW + (moveEvent.clientX - startX));
      setColumns((prev) =>
        prev.map((c) => (c.id === colId ? { ...c, width: newWidth } : c)),
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Panning state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, sL: 0, sT: 0 });

  // Initial scroll to today
  const initialScrollDone = useRef(false);
  const leftPaneWidthRef = useRef(leftPaneWidth);
  const extraPastDaysRef = useRef(extraPastDays);
  const tasksRef = useRef(tasks);
  const projectStartDateRef = useRef(projectStartDate);

  useLayoutEffect(() => {
    leftPaneWidthRef.current = leftPaneWidth;
    extraPastDaysRef.current = extraPastDays;
    tasksRef.current = tasks;
    projectStartDateRef.current = projectStartDate;
  });

  useEffect(() => {
    if (!scrollRef.current || initialScrollDone.current) return;
    const el = scrollRef.current;

    const doInitialScroll = () => {
      // Wait for content to be rendered and scrollable
      if (initialScrollDone.current || el.scrollWidth <= el.clientWidth) return;

      const minOffset = tasksRef.current.reduce((min, t) => {
        if (!t.earlyStart) return min;
        const offset =
          (t.earlyStart.getTime() - projectStartDateRef.current.getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.min(min, offset);
      }, 0);

      // Target to display the earliest task or project start (with a 1-day padding)
      const targetDayIndex =
        extraPastDaysRef.current + Math.min(0, minOffset) - 1;
      let targetScroll = targetDayIndex * DayWidth;

      if (targetScroll < 0) targetScroll = 0;

      el.scrollLeft = targetScroll;
      initialScrollDone.current = true;
    };

    doInitialScroll();
  }); // Run on every render until scroll is possible and done

  const prevExtraPastDays = useRef(extraPastDays);
  useLayoutEffect(() => {
    if (scrollRef.current && prevExtraPastDays.current !== extraPastDays) {
      const added = extraPastDays - prevExtraPastDays.current;
      scrollRef.current.scrollLeft += added * DayWidth;
      panStartRef.current.sL += added * DayWidth;
      prevExtraPastDays.current = extraPastDays;
    }
  }, [extraPastDays]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

    // Add past days when scrolling near left edge
    if (scrollLeft < 200) {
      setExtraPastDays((prev) => {
        // Only increment if we are not already processing a jump
        if (prev === prevExtraPastDays.current) {
          return prev + 30;
        }
        return prev;
      });
    }

    // Add future days when scrolling near right edge
    if (scrollWidth - clientWidth - scrollLeft < 200) {
      setExtraFutureDays((prev) => prev + 30);
    }
  };

  const handlePanStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not pan if clicking on inputs, buttons, scrollbars, or resize handles
    if (
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.closest("[data-no-pan]")
    ) {
      return;
    }
    if (!scrollRef.current) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      sL: scrollRef.current.scrollLeft,
      sT: scrollRef.current.scrollTop,
    };
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning || !scrollRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    scrollRef.current.scrollLeft = panStartRef.current.sL - dx;
    scrollRef.current.scrollTop = panStartRef.current.sT - dy;
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      addTask({ name: newTaskName, type: "regular", duration: 1 });
      setNewTaskName("");
    }
  };

  // Determine chart duration based on latest task
  const regularMaxEndDay = tasks
    .filter((t) => t.type === "regular")
    .reduce((max, task) => {
      if (task.earlyFinish) {
        const offset =
          (task.earlyFinish.getTime() - projectStartDate.getTime()) /
          (24 * 60 * 60 * 1000);
        return Math.max(max, offset);
      }
      return max;
    }, 0);

  const maxEndDay = tasks.reduce((max, task) => {
    if (task.earlyFinish) {
      const offset =
        (task.earlyFinish.getTime() - projectStartDate.getTime()) /
        (24 * 60 * 60 * 1000);
      return Math.max(max, offset);
    }
    return max;
  }, 0);

  const leafTasks = tasks.filter(
    (t) => !tasks.some((p) => p.parentId === t.id),
  );
  const projectBuffer = getProjectBufferHours();

  let delay = 0;
  leafTasks.forEach((t) => {
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
    if (taskDelay > 0) {
      delay += taskDelay;
    }
  });
  const remainingBuffer = projectBuffer - delay;

  const minStartOffset = useMemo(
    () =>
      tasks.reduce((min, task) => {
        if (!task.earlyStart) return min;
        const offset =
          (task.earlyStart.getTime() - projectStartDate.getTime()) /
          (24 * 60 * 60 * 1000);
        return Math.min(min, offset);
      }, 0),
    [tasks, projectStartDate],
  );

  useEffect(() => {
    if (minStartOffset < -extraPastDays + 10) {
      setExtraPastDays((prev) => Math.max(prev, -minStartOffset + 30));
    }
  }, [minStartOffset, extraPastDays]);

  const chartDays = Math.max(
    30,
    Math.max(maxEndDay, regularMaxEndDay + projectBuffer / 8) + 5,
  );
  const totalChartDays = extraPastDays + chartDays + extraFutureDays;

  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round(
      (today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }, [projectStartDate]);

  // Determine connections for SVG
  const connections = useMemo(() => {
    const lines: {
      id: string;
      predId: string;
      targetId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isCritical: boolean;
    }[] = [];
    visibleTasks.forEach((task, tIndex) => {
      task.predecessors.forEach((predId) => {
        const predIndex = visibleTasks.findIndex((t) => t.id === predId);
        if (predIndex !== -1) {
          const pred = visibleTasks[predIndex];
          const predStartOffset = pred.earlyStart
            ? (pred.earlyStart.getTime() - projectStartDate.getTime()) /
              (24 * 60 * 60 * 1000)
            : 0;
          const taskStartOffset = task.earlyStart
            ? (task.earlyStart.getTime() - projectStartDate.getTime()) /
              (24 * 60 * 60 * 1000)
            : 0;

          const safeProgress = pred.progress || 0;
          const actual =
            pred.actualDuration !== undefined
              ? pred.actualDuration
              : pred.duration * (safeProgress / 100);
          const remaining =
            pred.remainingDuration !== undefined
              ? pred.remainingDuration
              : Math.max(0, pred.duration - actual);
          const isPredParent = tasks.some((t) => t.parentId === pred.id);
          const expectedTotal = isPredParent
            ? pred.duration
            : actual + remaining;
          const displayDuration =
            pred.type === "project_buffer" &&
            pred.originalBufferDuration !== undefined
              ? pred.originalBufferDuration
              : expectedTotal;

          let predWidthPx = 0;
          if (pred.earlyStart && pred.earlyFinish) {
            predWidthPx =
              ((pred.earlyFinish.getTime() - pred.earlyStart.getTime()) /
                (24 * 60 * 60 * 1000)) *
              DayWidth;
            if (predWidthPx === 0 && displayDuration > 0)
              predWidthPx = (displayDuration / 8) * DayWidth;
          } else {
            predWidthPx = (displayDuration / 8) * DayWidth;
          }

          const x1 = (predStartOffset + extraPastDays) * DayWidth + predWidthPx;
          const y1 = predIndex * RowHeight + RowHeight / 2;

          const x2 = (taskStartOffset + extraPastDays) * DayWidth;
          const y2 = tIndex * RowHeight + RowHeight / 2;

          const isCritical = !!pred.isCritical && !!task.isCritical;

          lines.push({
            id: `${predId}_${task.id}`,
            predId,
            targetId: task.id,
            x1,
            y1,
            x2,
            y2,
            isCritical,
          });
        }
      });
    });
    return lines;
  }, [visibleTasks, projectStartDate, extraPastDays]);

  if (!isMounted) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-white">
        <div className="animate-pulse text-slate-400 text-sm">
          Loading Chart...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white select-none relative">
      <div className="flex-1 bg-slate-50/50 p-4 sm:p-6 pb-8 relative flex flex-col min-h-0">
        <div className="flex flex-col gap-3 relative z-50 shrink-0 mb-3 w-full">
          <div className="flex justify-between items-end w-full">
            <div className="flex gap-4 items-end flex-wrap">
              {/* Toggles */}
              <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 pointer-events-auto h-[32px] shrink-0">
                <button
                  className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "wbs" ? "bg-white shadow-sm text-blue-600 rounded" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => setViewMode("wbs")}
                >
                  ツリー表示
                </button>
                <button
                  className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "resource" ? "bg-white shadow-sm text-blue-600 rounded" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => setViewMode("resource")}
                >
                  担当別表示
                </button>
              </div>

              {/* Add Task input container */}
              <div className="flex items-center gap-2 h-[32px] shrink-0">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="新規タスク名 (Enterで追加)..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTask();
                  }}
                  className="w-[200px] border border-slate-200 px-3 py-1.5 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none h-full"
                />
                <button
                  onClick={handleAddTask}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-xs font-medium h-full"
                >
                  <Plus className="w-4 h-4" /> 追加
                </button>
              </div>

              {/* Buffer settings box */}
              <div className="flex items-center bg-white p-1 rounded-md border border-slate-200 shadow-sm shrink-0 flex-wrap text-[11px] h-[32px]">
                <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                  <span className="text-slate-500 font-medium">Pバッファ:</span>
                  <select
                    value={bufferConfig.type}
                    onChange={(e) =>
                      setBufferConfig({ type: e.target.value as any })
                    }
                    className="border-none bg-transparent outline-none cursor-pointer"
                  >
                    <option value="ratio">比率</option>
                    <option value="hours">時間</option>
                    <option value="endDate">終了日</option>
                  </select>
                  {bufferConfig.type === "ratio" && (
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={bufferConfig.ratio}
                        onChange={(e) =>
                          setBufferConfig({
                            ratio: Number(e.target.value) || 0,
                          })
                        }
                        className="w-8 outline-none text-right font-mono bg-transparent"
                      />
                      <span className="text-slate-500 ml-0.5">%</span>
                    </div>
                  )}
                  {bufferConfig.type === "hours" && (
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1">
                      <input
                        type="number"
                        min="0"
                        value={bufferConfig.hours}
                        onChange={(e) =>
                          setBufferConfig({
                            hours: Number(e.target.value) || 0,
                          })
                        }
                        className="w-8 outline-none text-right font-mono bg-transparent"
                      />
                      <span className="text-slate-500 ml-0.5">h</span>
                    </div>
                  )}
                  {bufferConfig.type === "endDate" && (
                    <input
                      type="date"
                      value={
                        bufferConfig.endDate
                          ? new Date(bufferConfig.endDate)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        if (!e.target.value) setBufferConfig({ endDate: null });
                        else {
                          const [y, m, d] = e.target.value
                            .split("-")
                            .map(Number);
                          setBufferConfig({ endDate: new Date(y, m - 1, d) });
                        }
                      }}
                      className="outline-none bg-slate-50 border border-slate-200 rounded px-1"
                    />
                  )}
                </div>

                <div className="flex items-center gap-1 border-r border-slate-200 px-2">
                  <span className="text-slate-500 font-medium">
                    合流バッファ設定:
                  </span>
                  <select
                    value={bufferConfig.feedingBufferMode || "task"}
                    onChange={(e) =>
                      setBufferConfig({
                        feedingBufferMode: e.target.value as any,
                      })
                    }
                    className="border-none bg-transparent outline-none cursor-pointer"
                  >
                    <option value="task">タスク生成 (案1)</option>
                    <option value="edge">リンク描画 (案2)</option>
                  </select>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={bufferConfig.feedingBufferRatio || 50}
                      onChange={(e) =>
                        setBufferConfig({
                          feedingBufferRatio: Number(e.target.value) || 0,
                        })
                      }
                      className="w-8 outline-none text-right font-mono bg-transparent"
                    />
                    <span className="text-slate-500 ml-0.5">%</span>
                  </div>
                  <button
                    onClick={() =>
                      useStore.getState().autoPlaceFeedingBuffers()
                    }
                    disabled={bufferConfig.feedingBufferMode !== "task"}
                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-indigo-200 transition-colors"
                  >
                    配置実行
                  </button>
                </div>

                <div className="flex items-center gap-2 pl-2 pr-1 font-mono font-bold">
                  <span>総バッファ: {projectBuffer.toFixed(1)}h</span>
                  <span>
                    残:{" "}
                    <span
                      className={
                        remainingBuffer < 0 ? "text-red-600" : "text-blue-600"
                      }
                    >
                      {remainingBuffer.toFixed(1)}h
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="relative shrink-0 ml-auto" ref={columnMenuRef}>
              {/* Columns Toggle on the Right */}
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-medium h-[32px]"
                title="表示項目の設定"
              >
                <Columns className="w-3.5 h-3.5" /> 表示項目
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg z-[100] p-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-800">項目の設定</h3>
                    <button
                      onClick={() => setShowColumnMenu(false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
                    {columns.map((col, idx) => (
                      <div
                        key={col.id}
                        className={`flex items-center justify-between group p-1 rounded border border-transparent cursor-grab active:cursor-grabbing ${dragOverColId === col.id ? "bg-blue-50 border-blue-200 shadow-sm" : "hover:bg-slate-50"}`}
                        draggable
                        onDragStart={(e) => handleColDragStart(e, col.id)}
                        onDragOver={(e) => handleColDragOver(e, col.id)}
                        onDrop={(e) => handleColDrop(e, col.id)}
                        onDragEnter={(e) => {
                          if (draggedColId) {
                            e.preventDefault();
                            setDragOverColId(col.id);
                          }
                        }}
                        onDragEnd={handleColDragEnd}
                      >
                        <div className="flex items-center gap-1.5 flex-1">
                          <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={col.visible}
                              onChange={(e) => {
                                const newCols = [...columns];
                                newCols[idx].visible = e.target.checked;
                                setColumns(newCols);
                              }}
                              disabled={col.id === "name"}
                              className="accent-blue-500 rounded cursor-pointer"
                            />
                            <span
                              className={`text-sm select-none ${col.id === "name" ? "text-slate-400" : "text-slate-700"}`}
                            >
                              {col.label}
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveColumn(idx, "up")}
                            disabled={idx <= 1}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            title="上に移動"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveColumn(idx, "down")}
                            disabled={idx === 0 || idx === columns.length - 1}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            title="下に移動"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {viewMode === "resource" && (
            <div className="flex items-center gap-1.5 border-t border-slate-200 pt-3 flex-wrap">
              <span className="text-xs font-medium text-slate-500 mr-2">
                担当者フィルター:
              </span>
              {resources.map((res) => {
                const isSelected =
                  selectedResources.length === 0 ||
                  selectedResources.includes(res.id);
                return (
                  <button
                    key={res.id}
                    onClick={() => {
                      if (selectedResources.length === 0)
                        setSelectedResources([res.id]);
                      else if (selectedResources.includes(res.id))
                        setSelectedResources(
                          selectedResources.filter((id) => id !== res.id),
                        );
                      else setSelectedResources([...selectedResources, res.id]);
                    }}
                    className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${
                      isSelected
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {res.name}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  if (selectedResources.length === 0)
                    setSelectedResources(["unassigned"]);
                  else if (selectedResources.includes("unassigned"))
                    setSelectedResources(
                      selectedResources.filter((id) => id !== "unassigned"),
                    );
                  else
                    setSelectedResources([...selectedResources, "unassigned"]);
                }}
                className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${
                  selectedResources.length === 0 ||
                  selectedResources.includes("unassigned")
                    ? "bg-slate-200 text-slate-700 border-slate-300"
                    : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                }`}
              >
                未割当
              </button>
              {selectedResources.length > 0 && (
                <button
                  onClick={() => setSelectedResources([])}
                  className="px-2 py-1 rounded-full text-[10px] whitespace-nowrap font-medium border border-transparent text-slate-500 hover:text-slate-800 underline transition-colors"
                >
                  クリア
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0 relative">
          <div
            id="gantt-scroll-container"
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onKeyDown={handleKeyDown}
            className={`flex-1 overflow-auto bg-slate-50/20 relative ${isPanning ? "cursor-grabbing select-none" : ""}`}
            style={{ overflowAnchor: "none" }}
          >
            <div className="min-w-max">
              {/* Header */}
              <div className="flex items-center h-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-30 font-medium text-xs text-slate-500 backdrop-blur-sm">
                <div
                  className="shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-40 flex items-stretch shadow-[2px_0_4px_rgba(0,0,0,0.02)] h-full"
                  style={{ width: leftPaneWidth }}
                >
                  {columns
                    .filter((c) => c.visible)
                    .map((col, idx) => {
                      const isName = col.id === "name";
                      const alignClass =
                        col.id === "progress" || col.id === "expected" || col.id === "actual" || col.id === "remaining"
                          ? "justify-end pr-2"
                          : col.id === "status"
                            ? "justify-center"
                            : "justify-start pl-2";

                      return (
                        <div
                          key={col.id}
                          className={`relative flex items-center shrink-0 ${!isName ? "border-l border-slate-200" : ""} ${alignClass}`}
                          style={{ width: col.width }}
                        >
                          {col.label}
                          <div
                            className="w-2 absolute -right-1 top-0 bottom-0 cursor-col-resize hover:bg-slate-300/50 z-50 transition-colors"
                            onMouseDown={(e) =>
                              handleColumnResize(e, col.id, col.width, 40)
                            }
                          />
                        </div>
                      );
                    })}
                </div>
                {Array.from({ length: totalChartDays }).map((_, i) => {
                  const currentOffset = i - extraPastDays;
                  const date = new Date(projectStartDate);
                  date.setDate(date.getDate() + currentOffset);
                  const isSaturday = date.getDay() === 6;
                  const isSundayOrHoliday =
                    date.getDay() === 0 || !!JapaneseHolidays.isHoliday(date);

                  let bgClass = "";
                  if (isSundayOrHoliday) bgClass = "bg-rose-50/60";
                  else if (isSaturday) bgClass = "bg-blue-50/60";

                  let textClass = "text-slate-600";
                  if (isSundayOrHoliday)
                    textClass = "text-rose-400 font-medium";
                  else if (isSaturday) textClass = "text-blue-400 font-medium";

                  return (
                    <div
                      key={i}
                      style={{ width: DayWidth }}
                      className={`h-full shrink-0 border-r border-slate-200 flex flex-col items-center justify-center transition-colors ${bgClass}`}
                    >
                      <span
                        className={`text-[9px] leading-none mb-[1px] tracking-tighter ${textClass}`}
                      >
                        {date.getMonth() + 1}/{date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Timeline Grid & Tasks */}
              <div className="relative">
                {/* Vertical Grid background lines */}
                <div
                  className="absolute inset-0 flex pointer-events-none z-0"
                  style={{ marginLeft: leftPaneWidth }}
                >
                  {Array.from({ length: totalChartDays }).map((_, i) => {
                    const currentOffset = i - extraPastDays;
                    const date = new Date(projectStartDate);
                    date.setDate(date.getDate() + currentOffset);
                    const isSaturday = date.getDay() === 6;
                    const isSundayOrHoliday =
                      date.getDay() === 0 || !!JapaneseHolidays.isHoliday(date);

                    let bgClass = "border-slate-100/60";
                    if (isSundayOrHoliday) bgClass += " bg-rose-50/40";
                    else if (isSaturday) bgClass += " bg-blue-50/40";

                    return (
                      <div
                        key={i}
                        style={{ width: DayWidth }}
                        className={`shrink-0 border-r h-full transition-colors ${bgClass}`}
                      />
                    );
                  })}
                  {/* Today Marker */}
                  {todayOffset + extraPastDays >= 0 &&
                    todayOffset + extraPastDays < totalChartDays && (
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-red-500/70 z-10"
                        style={{
                          left:
                            (todayOffset + extraPastDays) * DayWidth +
                            DayWidth / 2, // Center of the current day
                        }}
                      />
                    )}
                </div>

                {/* SVG Depedency Lines */}
                <svg
                  id="gantt-svg-container"
                  className="absolute pointer-events-none z-[5]"
                  style={{
                    left: leftPaneWidth,
                    top: 0,
                    height: visibleTasks.length * RowHeight,
                    width: totalChartDays * DayWidth,
                    overflow: "hidden",
                  }}
                >
                  <defs>
                    <marker
                      id="arrow-normal"
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="arrow-critical"
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                    </marker>
                    <marker
                      id="arrow-drawing"
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                    </marker>
                  </defs>
                  {connections.map((conn) => {
                    let d = "";
                    const outX = conn.x1 + 12;
                    if (conn.x2 >= conn.x1 + 16) {
                      d = `M ${conn.x1} ${conn.y1} L ${outX} ${conn.y1} L ${outX} ${conn.y2} L ${conn.x2 - 2} ${conn.y2}`;
                    } else {
                      const dropY =
                        conn.y2 > conn.y1
                          ? conn.y1 + RowHeight / 2
                          : conn.y1 - RowHeight / 2;
                      const backX = conn.x2 - 16;
                      d = `M ${conn.x1} ${conn.y1} L ${outX} ${conn.y1} L ${outX} ${dropY} L ${backX} ${dropY} L ${backX} ${conn.y2} L ${conn.x2 - 2} ${conn.y2}`;
                    }
                    return (
                      <g
                        key={conn.id}
                        className="group/conn cursor-pointer pointer-events-auto"
                      >
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="16"
                          className="pointer-events-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setConfirmDeleteConn({
                              predId: conn.predId,
                              targetId: conn.targetId,
                            });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDeleteConn({
                              predId: conn.predId,
                              targetId: conn.targetId,
                            });
                          }}
                        >
                          <title>
                            クリック または 右クリックで依存関係を削除
                          </title>
                        </path>
                        <path
                          d={d}
                          fill="none"
                          stroke={conn.isCritical ? "#ef4444" : "#94a3b8"}
                          strokeWidth="1.5"
                          markerEnd={`url(#${conn.isCritical ? "arrow-critical" : "arrow-normal"})`}
                          className="pointer-events-none transition-all group-hover/conn:stroke-rose-500 group-hover/conn:stroke-[2.5]"
                        />
                      </g>
                    );
                  })}
                  {drawingConn &&
                    (() => {
                      const startIdx = visibleTasks.findIndex(
                        (t) => t.id === drawingConn.startId,
                      );
                      if (startIdx === -1) return null;
                      const pred = visibleTasks[startIdx];
                      const pStartOffset = pred.earlyStart
                        ? (pred.earlyStart.getTime() -
                            projectStartDate.getTime()) /
                          (24 * 60 * 60 * 1000)
                        : 0;

                      const safeProgress = pred.progress || 0;
                      const actual =
                        pred.actualDuration !== undefined
                          ? pred.actualDuration
                          : pred.duration * (safeProgress / 100);
                      const remaining =
                        pred.remainingDuration !== undefined
                          ? pred.remainingDuration
                          : Math.max(0, pred.duration - actual);
                      const isPredParent = tasks.some(
                        (t) => t.parentId === pred.id,
                      );
                      const expectedTotal = isPredParent
                        ? pred.duration
                        : actual + remaining;
                      const displayDuration =
                        pred.type === "project_buffer" &&
                        pred.originalBufferDuration !== undefined
                          ? pred.originalBufferDuration
                          : expectedTotal;

                      let predWidthPx = 0;
                      if (pred.earlyStart && pred.earlyFinish) {
                        predWidthPx =
                          ((pred.earlyFinish.getTime() -
                            pred.earlyStart.getTime()) /
                            (24 * 60 * 60 * 1000)) *
                          DayWidth;
                        if (predWidthPx === 0 && displayDuration > 0)
                          predWidthPx = (displayDuration / 8) * DayWidth;
                      } else {
                        predWidthPx = (displayDuration / 8) * DayWidth;
                      }
                      const startX =
                        (pStartOffset + extraPastDays) * DayWidth + predWidthPx;
                      const startY = startIdx * RowHeight + RowHeight / 2;

                      const d = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${drawingConn.currentX - 50} ${drawingConn.currentY}, ${drawingConn.currentX} ${drawingConn.currentY}`;

                      return (
                        <path
                          d={d}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          markerEnd="url(#arrow-drawing)"
                          className="pointer-events-none drop-shadow-md"
                        />
                      );
                    })()}
                </svg>

                {visibleTasks.map((task, index) => {
                  const startOffset = task.earlyStart
                    ? (task.earlyStart.getTime() - projectStartDate.getTime()) /
                      (24 * 60 * 60 * 1000)
                    : 0;

                  const isParent =
                    (task as any).isVirtualGroup ||
                    tasks.some((t) => t.parentId === task.id);
                  const isCollapsed = collapsedTasks.has(task.id);
                  const totals = taskTotals[task.id] || {
                    duration: task.duration,
                    actual: task.actualDuration || 0,
                    expected: task.duration,
                  };

                  const formatNum = (num: number | undefined) =>
                    num !== undefined ? Number(num.toFixed(2)) : "";

                  let dragClass = "";
                  if (dragOverId === task.id) {
                    if (dropPosition === "before")
                      dragClass = "border-t-2 border-t-blue-500";
                    else if (dropPosition === "after")
                      dragClass = "border-b-2 border-b-blue-500";
                    else if (dropPosition === "inside")
                      dragClass =
                        "bg-blue-100/40 outline outline-2 outline-blue-500 z-10";
                  }
                  if (draggingIds.includes(task.id)) {
                    dragClass += " opacity-50 bg-slate-100";
                  }

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center h-8 hover:bg-slate-50/50 relative group transition-colors box-border ${dragClass}`}
                      onDragOver={(e) => handleDragOver(e, task.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, task.id)}
                    >
                      <div
                        className="shrink-0 border-b border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-20 flex items-stretch text-sm shadow-[2px_0_4px_rgba(0,0,0,0.02)] transition-colors h-full"
                        style={{ width: leftPaneWidth }}
                      >
                        {columns.filter((c) => c.visible).map((col) => {
                          if (col.id === 'name') {
                            return (
                              <div
                                key={col.id}
                                className="flex flex-row shrink-0 overflow-hidden pr-1 items-center h-full"
                                style={{
                                  width: col.width,
                                  paddingLeft: task.parentId ? "1.5rem" : "0.5rem",
                                }}
                              >
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, task.id)}
                                  onDragEnd={handleDragEnd}
                                  className="w-4 flex shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500 mr-1"
                                  title="ドラッグして移動"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                {isParent ? (
                                  <div
                                    className="w-4 h-4 shrink-0 mr-1 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-700 transition-colors text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded"
                                    onClick={() => toggleCollapse(task.id)}
                                  >
                                    {isCollapsed ? "+" : "-"}
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 shrink-0 mr-1"></div>
                                )}
                                {editingCell?.r === index &&
                                editingCell?.c === "name" ? (
                                  <input
                                    type="text"
                                    data-row={index}
                                    data-col="name"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    value={task.name}
                                    onChange={(e) =>
                                      useStore
                                        .getState()
                                        .updateTask(task.id, { name: e.target.value })
                                    }
                                    onBlur={() => setEditingCell(null)}
                                    className={`w-0 flex-1 bg-white outline-none ring-1 ring-blue-500 rounded px-1 -ml-1 truncate text-sm transition-all min-w-0 ${isParent ? "font-bold text-slate-800" : "font-medium text-slate-700"}`}
                                  />
                                ) : (
                                  <div
                                    tabIndex={0}
                                    data-row={index}
                                    data-col="name"
                                    onMouseDown={() =>
                                      setSelectedCell({ r: index, c: "name" })
                                    }
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "name" })
                                    }
                                    className={`w-0 flex-1 bg-transparent outline-none rounded px-1 -ml-1 truncate text-sm transition-all min-w-0 h-full flex items-center relative ${isParent ? "font-bold text-slate-800" : "font-medium text-slate-700"} ${selectedCell?.r === index && selectedCell?.c === "name" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                  >
                                    {task.name}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'startDate') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden text-xs text-slate-600 font-mono"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "startDate" ? (
                                    <input
                                      type="date"
                                      autoFocus
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-[11px] text-slate-600 cursor-text rounded px-1 -mx-1 truncate"
                                      value={formatDate(
                                        task.manualStartDate ||
                                          task.earlyStart ||
                                          task.startDate,
                                      )}
                                      onChange={(e) => {
                                        const parsed = parseDateString(
                                          e.target.value,
                                        );
                                        if (parsed)
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualStartDate: parsed,
                                            });
                                        else
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualStartDate: undefined,
                                            });
                                      }}
                                      onBlur={() => setEditingCell(null)}
                                    />
                                  ) : (
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="startDate"
                                      onMouseDown={() =>
                                        setSelectedCell({
                                          r: index,
                                          c: "startDate",
                                        })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "startDate" })
                                      }
                                      className={`w-full truncate h-full flex items-center justify-center outline-none ${selectedCell?.r === index && selectedCell?.c === "startDate" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                    >
                                      {formatDate(
                                        task.manualStartDate ||
                                          task.earlyStart ||
                                          task.startDate,
                                      )}
                                    </div>
                                  ))}
                                {((task as any).isVirtualGroup || isParent) && (
                                  <div className="w-full truncate h-full flex items-center justify-center opacity-70">
                                    {formatDate(
                                      task.manualStartDate ||
                                        task.earlyStart ||
                                        task.startDate,
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'endDate') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden text-xs text-slate-600 font-mono"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "endDate" ? (
                                    <input
                                      type="date"
                                      autoFocus
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-[11px] text-slate-600 cursor-text rounded px-1 -mx-1 truncate"
                                      value={formatEndDate(
                                        task.manualEndDate ||
                                          task.earlyFinish ||
                                          task.endDate,
                                      )}
                                      onChange={(e) => {
                                        const parsed = parseEndDateString(
                                          e.target.value,
                                        );
                                        if (parsed)
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualEndDate: parsed,
                                            });
                                        else
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualEndDate: undefined,
                                            });
                                      }}
                                      onBlur={() => setEditingCell(null)}
                                    />
                                  ) : (
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="endDate"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "endDate" })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "endDate" })
                                      }
                                      className={`w-full truncate h-full flex items-center justify-center outline-none ${selectedCell?.r === index && selectedCell?.c === "endDate" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                    >
                                      {formatEndDate(
                                        task.manualEndDate ||
                                          task.earlyFinish ||
                                          task.endDate,
                                      )}
                                    </div>
                                  ))}
                                {((task as any).isVirtualGroup || isParent) && (
                                  <div className="w-full truncate h-full flex items-center justify-center opacity-70">
                                    {formatEndDate(
                                      task.manualEndDate ||
                                        task.earlyFinish ||
                                        task.endDate,
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'resource') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  task.type !== "project_buffer" &&
                                  task.type !== "feeding_buffer" &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "resource" ? (
                                    <select
                                      data-row={index}
                                      data-col="resource"
                                      autoFocus
                                      value={task.resourceId || ""}
                                      onChange={(e) =>
                                        useStore.getState().updateTask(task.id, {
                                          resourceId: e.target.value || undefined,
                                        })
                                      }
                                      onBlur={() => setEditingCell(null)}
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-xs text-slate-600 cursor-pointer rounded px-1 -mx-1 truncate"
                                    >
                                      <option value="">未割当</option>
                                      {resources.map((res) => (
                                        <option key={res.id} value={res.id}>
                                          {res.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="resource"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "resource" })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "resource" })
                                      }
                                      className={`w-full h-full flex items-center bg-transparent outline-none text-xs text-slate-600 rounded px-1 -mx-1 truncate relative ${selectedCell?.r === index && selectedCell?.c === "resource" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                    >
                                      {task.resourceId
                                        ? resources.find(
                                            (r) => r.id === task.resourceId,
                                          )?.name
                                        : "未割当"}
                                    </div>
                                  ))}
                              </div>
                            );
                          }
                          if (col.id === 'progress') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div
                                    className="flex items-center absolute inset-0 cursor-text group/input"
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "progress" })
                                    }
                                  >
                                    {editingCell?.r === index &&
                                    editingCell?.c === "progress" ? (
                                      <input
                                        type="number"
                                        data-row={index}
                                        data-col="progress"
                                        min={0}
                                        max={100}
                                        autoFocus
                                        onFocus={(e) => e.target.select()}
                                        value={
                                          formatNum(task.progress) !== ""
                                            ? formatNum(task.progress)
                                            : 0
                                        }
                                        onChange={(e) =>
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              progress:
                                                Number(e.target.value) || 0,
                                              status:
                                                Number(e.target.value) === 100
                                                  ? "done"
                                                  : Number(e.target.value) === 0
                                                    ? "todo"
                                                    : "in_progress",
                                            })
                                        }
                                        onBlur={() => setEditingCell(null)}
                                        className="w-full h-full bg-white ring-1 ring-blue-500 text-right font-mono text-xs outline-none px-1 py-1 min-w-0 transition-colors"
                                      />
                                    ) : (
                                      <div
                                        tabIndex={0}
                                        data-row={index}
                                        data-col="progress"
                                        onMouseDown={() =>
                                          setSelectedCell({
                                            r: index,
                                            c: "progress",
                                          })
                                        }
                                        className={`w-full h-full bg-transparent flex justify-end items-center font-mono text-xs outline-none px-1 py-1 min-w-0 transition-colors relative ${selectedCell?.r === index && selectedCell?.c === "progress" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                      >
                                        {formatNum(task.progress) !== ""
                                          ? formatNum(task.progress)
                                          : 0}
                                      </div>
                                    )}
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      %
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.progress!)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      %
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'expected') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="expected"
                                      onMouseDown={() =>
                                        setSelectedCell({
                                          r: index,
                                          c: "expected",
                                        })
                                      }
                                      className={`cursor-not-allowed w-full h-full bg-transparent flex justify-end items-center font-mono text-xs text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative ${selectedCell?.r === index && selectedCell?.c === "expected" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                    >
                                      {formatNum(task.duration) !== ""
                                        ? formatNum(task.duration)
                                        : 0}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.duration)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'actual') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-slate-50/50 border-l border-slate-100 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="actual"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "actual" })
                                      }
                                      className={`cursor-not-allowed w-full h-full bg-transparent flex justify-end items-center font-mono text-xs text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative ${selectedCell?.r === index && selectedCell?.c === "actual" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                    >
                                      {formatNum(task.actualDuration) !== ""
                                        ? formatNum(task.actualDuration)
                                        : 0}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-slate-50/50 border-l border-slate-100 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.actual)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'remaining') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-blue-50/30 border-l border-slate-100 relative shrink-0 text-blue-700"
                                  style={{ width: col.width }}
                                >
                                  <div
                                    className="flex items-center absolute inset-0 cursor-text group/input"
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "remaining" })
                                    }
                                  >
                                    {editingCell?.r === index &&
                                    editingCell?.c === "remaining" ? (
                                      <input
                                        type="number"
                                        data-row={index}
                                        data-col="remaining"
                                        min={0}
                                        step={0.5}
                                        autoFocus
                                        onFocus={(e) => e.target.select()}
                                        value={formatNum(
                                          task.remainingDuration !== undefined
                                            ? task.remainingDuration
                                            : Math.max(
                                                0,
                                                task.duration -
                                                  (task.actualDuration || 0),
                                              ),
                                        )}
                                        placeholder="0"
                                        onChange={(e) =>
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              remainingDuration:
                                                Number(e.target.value) || 0,
                                            })
                                        }
                                        onBlur={() => setEditingCell(null)}
                                        className="w-full h-full bg-white ring-1 ring-blue-500 text-right font-mono text-xs outline-none px-1 py-1 min-w-0 font-medium transition-colors text-inherit"
                                      />
                                    ) : (
                                      <div
                                        tabIndex={0}
                                        data-row={index}
                                        data-col="remaining"
                                        onMouseDown={() =>
                                          setSelectedCell({
                                            r: index,
                                            c: "remaining",
                                          })
                                        }
                                        className={`w-full h-full bg-transparent flex justify-end items-center font-mono text-xs outline-none px-1 py-1 min-w-0 font-medium transition-colors text-inherit relative ${selectedCell?.r === index && selectedCell?.c === "remaining" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}`}
                                      >
                                        {formatNum(
                                          task.remainingDuration !== undefined
                                            ? task.remainingDuration
                                            : Math.max(
                                                0,
                                                task.duration -
                                                  (task.actualDuration || 0),
                                              ),
                                        ) !== ""
                                          ? formatNum(
                                              task.remainingDuration !== undefined
                                                ? task.remainingDuration
                                                : Math.max(
                                                    0,
                                                    task.duration -
                                                      (task.actualDuration || 0),
                                                  ),
                                            )
                                          : 0}
                                      </div>
                                    )}
                                    <span className="text-[10px] text-blue-400/70 shrink-0 pointer-events-none pr-2">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-blue-50/30 border-l border-slate-100 relative shrink-0 text-blue-700"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold outline-none px-1 py-1 min-w-0 transition-colors relative text-inherit">
                                      {formatNum(totals.remaining)}
                                    </div>
                                    <span className="text-[10px] text-blue-400/70 shrink-0 pointer-events-none pr-2">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'status') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100 relative shrink-0 px-1"
                                  style={{ width: col.width }}
                                >
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      useStore.getState().updateTask(task.id, {
                                        status: e.target.value as any,
                                      })
                                    }
                                    className="w-full bg-transparent outline-none text-xs text-center"
                                  >
                                    <option value="todo">TODO</option>
                                    <option value="in_progress">進行中</option>
                                    <option value="done">完了</option>
                                  </select>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0 px-1"
                                  style={{ width: col.width }}
                                ></div>
                              );
                            }
                          }
                          if (col.id === 'predecessors') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100 relative shrink-0 px-2"
                                  style={{ width: col.width }}
                                >
                                  <div className="w-full truncate text-xs text-slate-600">
                                    {task.predecessors.length > 0
                                      ? task.predecessors
                                          .map(
                                            (id) =>
                                              tasks.find((t) => t.id === id)
                                                ?.name || "不明",
                                          )
                                          .join(", ")
                                      : "-"}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0 px-2"
                                  style={{ width: col.width }}
                                ></div>
                              );
                            }
                          }
                          return null;
                        })}
                      </div>
                      <div className="relative flex-1 h-full flex items-center border-b border-slate-100">
                        <DraggableTaskBar
                          task={task}
                          startOffset={startOffset}
                          extraPastDays={extraPastDays}
                          isParent={isParent}
                          progressOverride={totals?.progress}
                          isDrawingConnection={
                            !!drawingConn && drawingConn.startId !== task.id
                          }
                          onStartConnection={handleStartConnection}
                          onHoverConnection={(id) =>
                            setDrawingConn((prev) =>
                              prev ? { ...prev, endId: id } : prev,
                            )
                          }
                        />
                        {bufferConfig.feedingBufferMode === "edge" &&
                        task.calculatedFeedingBuffer &&
                        task.calculatedFeedingBuffer > 0
                          ? (() => {
                              const bufferDuration =
                                task.calculatedFeedingBuffer!;
                              const bufferWidthPx =
                                (bufferDuration / 8) * DayWidth;
                              const endOffset = task.earlyFinish
                                ? (task.earlyFinish.getTime() -
                                    projectStartDate.getTime()) /
                                  (24 * 60 * 60 * 1000)
                                : 0;
                              return (
                                <div
                                  className="absolute h-5 opacity-70 bg-amber-200 border border-amber-400 rounded shadow-sm pointer-events-none overflow-hidden z-0"
                                  style={{
                                    left: `${(endOffset + extraPastDays) * DayWidth}px`,
                                    width: `${bufferWidthPx}px`,
                                  }}
                                  title={`合流バッファ(案2): ${bufferDuration.toFixed(1)}h`}
                                >
                                  <div className="w-full h-full opacity-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,#f59e0b_4px,#f59e0b_8px)]" />
                                </div>
                              );
                            })()
                          : null}
                      </div>
                    </div>
                  );
                })}

                {/* Redundant Project Buffer Row logic Removed */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirm Modal for Dependency Deletion */}
      {confirmDeleteConn && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onMouseDown={(e) => {
            e.stopPropagation();
            setConfirmDeleteConn(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              依存関係の削除
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              本当にこの依存関係を削除しますか？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteConn(null)}
                className="px-4 py-2 rounded-md border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                title="キャンセル"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const state = useStore.getState();
                  const targetTask = state.tasks.find(
                    (t) => t.id === confirmDeleteConn.targetId,
                  );
                  if (targetTask) {
                    state.updateTask(targetTask.id, {
                      predecessors: targetTask.predecessors.filter(
                        (p) => p !== confirmDeleteConn.predId,
                      ),
                    });
                  }
                  setConfirmDeleteConn(null);
                }}
                className="px-4 py-2 rounded-md bg-rose-600 font-medium text-white hover:bg-rose-700 transition-colors shadow-sm"
                title="削除する"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
