"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Task, DailyLog, Resource } from "@/lib/store";
import { Clock, X, ChevronRight, ChevronDown } from "lucide-react";

const HOURS_START = 8;
const HOURS_END = 24;
const HOURS_TOTAL = HOURS_END - HOURS_START;
const HOUR_HEIGHT = 60; // px per hour

export default function WeeklyCalendarView({
  tasks,
  logs,
  resources = [],
  currentWeekDays,
  selectedResourceId,
  addDailyLog,
  updateDailyLogById,
  removeDailyLogById,
}: {
  tasks: Task[];
  logs: DailyLog[];
  resources?: Resource[];
  currentWeekDays: { dateStr: string; shortName: string; dayStr: string; isHoliday?: boolean }[];
  selectedResourceId: string | "all" | "unassigned";
  addDailyLog: (
    taskId: string,
    date: string,
    hours: number,
    startTime: number,
    resourceId?: string,
  ) => void;
  updateDailyLogById: (logId: string, hours: number, startTime: number) => void;
  removeDailyLogById: (logId: string) => void;
}) {
  const [isOtherCollapsed, setIsOtherCollapsed] = useState(true);
  const [dragPreview, setDragPreview] = useState<{
    date: string;
    hour: number;
    taskId: string;
    taskName: string;
    duration: number;
  } | null>(null);
  const draggingTaskIdRef = useRef<string | null>(null);

  const { assignedTasks, unassignedTasks } = useMemo(() => {
    let assigned: Task[] = [];
    let unassigned: Task[] = [];

    tasks.forEach((t) => {
      const resId = t.resourceId || "unassigned";
      if (selectedResourceId === "all") {
        assigned.push(t);
      } else if (resId === selectedResourceId) {
        assigned.push(t);
      } else {
        unassigned.push(t);
      }
    });

    return { assignedTasks: assigned, unassignedTasks: unassigned };
  }, [tasks, selectedResourceId]);

  const logsByDate = useMemo(() => {
    const acc: Record<string, DailyLog[]> = {};
    currentWeekDays.forEach((wd) => (acc[wd.dateStr] = []));

    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    logs.forEach((log) => {
      const task = taskMap.get(log.taskId);
      // Show log if explicitly logged by this selected resource,
      // or if it lacks a resource ID but the task belongs to the selected resource.
      let belongsToSelected = false;
      if (selectedResourceId === "all") {
        belongsToSelected = true;
      } else if (selectedResourceId === "unassigned") {
        belongsToSelected = !log.resourceId;
      } else {
        belongsToSelected =
          log.resourceId === selectedResourceId ||
          (!log.resourceId && task?.resourceId === selectedResourceId);
      }

      if (acc[log.date] && belongsToSelected) {
        acc[log.date].push(log);
      }
    });
    return acc;
  }, [logs, currentWeekDays, tasks, selectedResourceId]);

  const snapToQuarterHour = (val: number) => Math.round(val * 4) / 4;

  const handleDrop = (dateStr: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const durationStr = e.dataTransfer.getData("taskDuration");
    if (!taskId) return;

    const duration = parseFloat(durationStr) || 1;

    const rect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    let droppedHour = HOURS_START + snapToQuarterHour(dropY / HOUR_HEIGHT);
    droppedHour = Math.min(
      HOURS_END - duration,
      Math.max(HOURS_START, droppedHour),
    );

    // Determine the resource to assign the time log to
    let targetResourceId: string | undefined = undefined;
    if (selectedResourceId !== "all" && selectedResourceId !== "unassigned") {
      targetResourceId = selectedResourceId;
    } else {
      const task = tasks.find((t) => t.id === taskId);
      targetResourceId = task?.resourceId;
    }

    addDailyLog(taskId, dateStr, duration, droppedHour, targetResourceId);
    setDragPreview(null);
  };

  const handleDragOver = (
    dateStr: string,
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    let hoveredHour = HOURS_START + snapToQuarterHour(dropY / HOUR_HEIGHT);

    let taskName = "配置...";
    let duration = 1;

    if (draggingTaskIdRef.current) {
      const draggedTask = tasks.find((t) => t.id === draggingTaskIdRef.current);
      if (draggedTask) {
        taskName = draggedTask.name;
        // You could calculate remaining duration here if you wanted dynamically:
        // duration = Math.min(HOURS_END - HOURS_START, Math.max(0.5, draggedTask.duration - (draggedTask.actualDuration || 0)));
      }
    }

    hoveredHour = Math.min(
      HOURS_END - duration,
      Math.max(HOURS_START, hoveredHour),
    );

    setDragPreview({
      date: dateStr,
      hour: hoveredHour,
      taskId: draggingTaskIdRef.current || "",
      taskName,
      duration,
    });
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setDragPreview(null);
  };

  return (
    <div className="flex gap-6 h-full flex-1 w-full min-w-[1000px] min-h-0">
      {/* Sidebar (Task selection) */}
      <div className="w-64 shrink-0 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-sm whitespace-nowrap">
              {selectedResourceId === "all"
                ? "すべてのタスク"
                : selectedResourceId === "unassigned"
                  ? "担当者未設定のタスク"
                  : `${resources.find((r) => r.id === selectedResourceId)?.name || ""} のタスク`}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-tight">
            タスクを右側のカレンダーにドラッグ＆ドロップして配置します
          </p>
        </div>
        <div className="flex-1 overflow-y-scroll p-2 flex flex-col gap-2 min-h-0" style={{ scrollbarGutter: "stable" }}>
          {assignedTasks.length > 0 && (
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 pt-1">
              {selectedResourceId === "all" ||
              selectedResourceId === "unassigned"
                ? "タスク一覧"
                : "アサイン済み"}
            </div>
          )}

          {assignedTasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("taskId", task.id);
                draggingTaskIdRef.current = task.id;
              }}
              onDragEnd={() => {
                draggingTaskIdRef.current = null;
                setDragPreview(null);
              }}
              className="text-left p-3 rounded-lg border border-slate-200 bg-white text-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-300 flex flex-col shadow-sm text-slate-700"
            >
              <div className="font-medium leading-tight">{task.name}</div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                </div>
                <span>見積: {task.duration}h</span>
                <span className="text-slate-300">|</span>
                <span>実績: {task.actualDuration || 0}h</span>
              </div>
            </div>
          ))}

          {unassignedTasks.length > 0 && selectedResourceId !== "all" && (
            <>
              <div className="my-2 border-t border-slate-200 border-dashed" />
              <div 
                className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2 flex items-center justify-start gap-1 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => setIsOtherCollapsed(!isOtherCollapsed)}
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${!isOtherCollapsed ? "rotate-90" : ""}`} />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span>
                    {selectedResourceId !== "unassigned"
                      ? "未アサイン・他担当"
                      : "未アサイン"}
                  </span>
                  <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{unassignedTasks.length}</span>
                </div>
              </div>
            </>
          )}

          {assignedTasks.length === 0 && unassignedTasks.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">
              タスクがありません
            </div>
          )}

          {!isOtherCollapsed && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-2">
              {unassignedTasks.map((task) => (
                <div
                  key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("taskId", task.id);
                draggingTaskIdRef.current = task.id;
              }}
              onDragEnd={() => {
                draggingTaskIdRef.current = null;
                setDragPreview(null);
              }}
              className="text-left p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-300 flex flex-col opacity-80 hover:opacity-100 shadow-sm text-slate-700"
            >
              <div className="font-medium leading-tight">{task.name}</div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                </div>
                <span>見積: {task.duration}h</span>
                <span className="text-slate-300">|</span>
                <span>実績: {task.actualDuration || 0}h</span>
              </div>
            </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm h-full flex flex-col min-h-0">
        {/* Header */}
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20 shadow-sm shrink-0">
          <div className="w-16 border-r border-slate-200 shrink-0 bg-slate-50" />
          <div className="flex flex-1">
            {currentWeekDays.map((wd) => {
              const isSaturday = wd.shortName === "土";
              const isSundayOrHoliday = wd.shortName === "日" || wd.isHoliday;
              let bgClass = "";
              if (isSundayOrHoliday) bgClass = "bg-rose-50/60";
              else if (isSaturday) bgClass = "bg-blue-50/60";

              let textClass = "text-slate-500";
              let dateTextClass = "text-slate-800";
              if (isSundayOrHoliday) {
                textClass = "text-rose-400";
                dateTextClass = "text-rose-500";
              } else if (isSaturday) {
                textClass = "text-blue-400";
                dateTextClass = "text-blue-500";
              }

              return (
                <div
                  key={wd.dateStr}
                  className={`flex-1 flex flex-col items-center py-3 border-r border-slate-100 last:border-r-0 ${bgClass}`}
                >
                  <span
                    className={`text-xs font-medium ${textClass}`}
                  >
                    {wd.shortName}
                  </span>
                  <span className={`text-lg font-bold ${dateTextClass}`}>
                    {wd.dayStr.split("/")[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Grid Area */}
        <div className="flex flex-1 overflow-y-auto relative bg-slate-50/30">
          {/* Time scale */}
          <div className="w-16 shrink-0 border-r border-slate-200 bg-white sticky left-0 z-10">
            {Array.from({ length: HOURS_TOTAL }).map((_, i) => (
              <div
                key={i}
                className="relative text-[10px] font-mono text-slate-400 text-right pr-2"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">
                  {HOURS_START + i}:00
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-1 relative">
            {currentWeekDays.map((wd) => {
              const isSaturday = wd.shortName === "土";
              const isSundayOrHoliday = wd.shortName === "日" || wd.isHoliday;
              let bgClass = "";
              if (isSundayOrHoliday) bgClass = "bg-rose-50/40";
              else if (isSaturday) bgClass = "bg-blue-50/40";

              return (
              <div
                key={wd.dateStr}
                className={`calendar-column flex-1 relative border-r border-slate-100 last:border-r-0 group hover:bg-slate-50 transition-colors ${bgClass}`}
                onDrop={(e) => handleDrop(wd.dateStr, e)}
                onDragOver={(e) => handleDragOver(wd.dateStr, e)}
              >
                {/* Horizontal grid lines */}
                {Array.from({ length: HOURS_TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    className="border-b border-slate-100 pointer-events-none"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Blocks */}
                {logsByDate[wd.dateStr]?.map((log) => {
                  const task = tasks.find((t) => t.id === log.taskId);
                  const isConflicting = logsByDate[wd.dateStr].some(
                    (oLog) =>
                      oLog.id !== log.id &&
                      Math.max(
                        0,
                        Math.min(
                          (log.startTime || 8) + log.hours,
                          (oLog.startTime || 8) + oLog.hours,
                        ) - Math.max(log.startTime || 8, oLog.startTime || 8),
                      ) > 0,
                  );

                  return (
                    <CalendarBlock
                      key={log.id}
                      log={log}
                      taskName={task?.name || "Unknown"}
                      isConflicting={isConflicting}
                      updateDailyLogById={updateDailyLogById}
                      removeDailyLogById={removeDailyLogById}
                    />
                  );
                })}

                {/* Drag Ghost */}
                {dragPreview?.date === wd.dateStr && (
                  <div
                    className="absolute left-1 right-1 rounded border-2 border-dashed shadow-sm flex flex-col z-20 transition-colors bg-blue-100/60 border-blue-500 text-blue-900 pointer-events-none"
                    style={{
                      top: (dragPreview.hour - HOURS_START) * HOUR_HEIGHT,
                      height: dragPreview.duration * HOUR_HEIGHT,
                    }}
                  >
                    <div className="flex-1 overflow-hidden px-1 py-1 text-[11px] leading-tight font-bold opacity-80 flex items-center justify-center text-center bg-white/30 backdrop-blur-sm">
                      ここに配置
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarBlock({
  log,
  taskName,
  isConflicting,
  updateDailyLogById,
  removeDailyLogById,
}: {
  log: DailyLog;
  taskName: string;
  isConflicting: boolean;
  updateDailyLogById: (logId: string, hours: number, startTime: number) => void;
  removeDailyLogById: (logId: string) => void;
}) {
  const [localStart, setLocalStart] = useState(log.startTime || 8);
  const [localHours, setLocalHours] = useState(log.hours || 1);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setLocalStart(log.startTime || 8);
    setLocalHours(log.hours || 1);
  }, [log]);

  const snapToQuarterHour = (val: number) => Math.round(val * 4) / 4;

  const formatTime = (hourNum: number) => {
    const h = Math.floor(hourNum);
    const m = Math.round((hourNum % 1) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const handlePointerDown = (
    type: "top" | "bottom" | "move",
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    const startY = e.clientY;
    const initialStart = localStart;
    const initialHours = localHours;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaY = ev.clientY - startY;
      const deltaHrs = snapToQuarterHour(deltaY / HOUR_HEIGHT);

      if (type === "move") {
        let newStart = initialStart + deltaHrs;
        newStart = Math.max(
          HOURS_START,
          Math.min(HOURS_END - initialHours, newStart),
        );
        setLocalStart(newStart);
      } else if (type === "bottom") {
        const newHours = Math.max(
          0.25,
          Math.min(HOURS_END - initialStart, initialHours + deltaHrs),
        );
        setLocalHours(newHours);
      } else if (type === "top") {
        const newStart = Math.max(
          HOURS_START,
          Math.min(initialStart + initialHours - 0.25, initialStart + deltaHrs),
        );
        const newHours = initialHours - (newStart - initialStart);
        setLocalStart(newStart);
        setLocalHours(Math.max(0.25, newHours));
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  useEffect(() => {
    const onGlobalUp = () => {
      if ((log.startTime || 8) !== localStart || log.hours !== localHours) {
        if (localHours !== log.hours || localStart !== (log.startTime || 8)) {
          updateDailyLogById(log.id, localHours, localStart);
        }
      }
    };
    window.addEventListener("pointerup", onGlobalUp);
    return () => window.removeEventListener("pointerup", onGlobalUp);
  }, [localStart, localHours, updateDailyLogById, log]);

  const topPx = (localStart - HOURS_START) * HOUR_HEIGHT;
  const heightPx = localHours * HOUR_HEIGHT;

  const bgClass = isConflicting
    ? "bg-red-100 border-red-300 text-red-900"
    : "bg-blue-100 border-blue-300 text-blue-900";

  return (
    <div
      className={`absolute left-1 right-1 rounded border shadow-sm flex flex-col transition-colors ${bgClass} ${isHovered ? "z-30 shadow-md ring-1 ring-blue-400" : "z-10"}`}
      style={{ top: topPx, height: heightPx }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => handlePointerDown("move", e)}
    >
      <div
        className="h-2 w-full cursor-ns-resize shrink-0 flex justify-center items-center group"
        onPointerDown={(e) => handlePointerDown("top", e)}
      >
        <div className="w-8 h-1 rounded-full bg-black/10 group-hover:bg-black/20" />
      </div>

      <div className="flex-1 overflow-hidden px-1.5 py-0 cursor-move pointer-events-none select-none text-[10px] leading-tight font-medium">
        {taskName}
        {localHours >= 0.5 && (
          <div className="opacity-70 text-[9px] mt-0.5">
            {localHours.toFixed(1)}h
          </div>
        )}
      </div>

      <div
        className="h-2 w-full cursor-ns-resize shrink-0 flex justify-center items-center group"
        onPointerDown={(e) => handlePointerDown("bottom", e)}
      >
        <div className="w-8 h-1 rounded-full bg-black/10 group-hover:bg-black/20" />
      </div>

      {isHovered && (
        <>
          <button
            className="absolute -top-2 -right-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-red-500 border border-slate-200 rounded-full p-0.5 shadow-sm z-50 pointer-events-auto cursor-pointer transition-colors"
            onPointerDown={(e) => {
              e.stopPropagation();
              removeDailyLogById(log.id);
            }}
          >
            <X className="w-3 h-3" />
          </button>

          {/* Tooltip / Expanded view */}
          <div className="absolute top-1/2 left-[calc(100%+8px)] -translate-y-1/2 p-2.5 bg-slate-800 text-white shadow-xl rounded-md z-50 pointer-events-none min-w-[140px] max-w-[220px] text-xs">
            <div className="font-semibold text-slate-50 leading-tight">
              {taskName}
            </div>
            <div className="text-slate-300 mt-1 font-mono text-[11px]">
              {formatTime(localStart)}〜{formatTime(localStart + localHours)}{" "}
              {localHours}h
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
          </div>
        </>
      )}
    </div>
  );
}
