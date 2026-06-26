"use client";
import { useState, useMemo, useEffect } from "react";
import * as JapaneseHolidays from "japanese-holidays";
import { useStore } from "@/lib/store";
import TimelineTaskRow from "./TimelineTaskRow";
import WeeklyCalendarView from "./WeeklyCalendarView";
import {
  List,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export default function TimesheetView() {
  const {
    tasks,
    resources,
    dailyLogs,
    taskStatusLogs,
    updateDailyLog,
    addDailyLog,
    updateDailyLogById,
    removeDailyLogById,
    updateTask,
    currentUser,
    setCurrentUser,
  } = useStore();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [viewMode, setViewMode] = useState<"list" | "timeline" | "calendar">(
    "list",
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    currentUser || "all",
  );
  const [selectedStatus, setSelectedStatus] = useState<string | "all">("all");
  const [isOtherCollapsed, setIsOtherCollapsed] = useState(true);

  // Sync from currentUser
  useEffect(() => {
    if (currentUser && currentUser !== selectedResourceId && currentUser !== "Local User") {
      setSelectedResourceId(currentUser);
    }
  }, [currentUser]);

  // selectedResourceIdが空だったり存在しないidになった場合、最初の担当者にする
  useMemo(() => {
    if (resources.length > 0 && selectedResourceId !== "all" && selectedResourceId !== "unassigned" && !resources.some((r) => r.id === selectedResourceId)) {
      setSelectedResourceId("all");
    }
  }, [resources, selectedResourceId]);

  // Calculate the week days for the selected date (Monday start)
  const currentWeekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay(); // 0 is Sunday
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return {
        dateStr: d.toISOString().split("T")[0],
        shortName: ["日", "月", "火", "水", "木", "金", "土"][d.getDay()],
        dayStr: `${d.getMonth() + 1}/${d.getDate()}`,
        isHoliday: !!JapaneseHolidays.isHoliday(d),
      };
    });
  }, [selectedDate]);

  // Filter tasks that are leaf nodes
  const leafTasks = useMemo(() => {
    return tasks.filter((t) => {
      const isLeaf = !tasks.some((p) => p.parentId === t.id);
      return (
        isLeaf && t.type !== "project_buffer" && t.type !== "feeding_buffer"
      );
    });
  }, [tasks]);

  const activeTasks = useMemo(() => {
    const currentWeekDates = currentWeekDays.map((w) => w.dateStr);
    return leafTasks.filter((t) => {
      // ステータスフィルター
      if (selectedStatus !== "all") {
        if (t.status !== selectedStatus) return false;
        return true;
      }

      const isDone = t.status === "done";
      const hasLogThisWeek = dailyLogs.some(
        (l) => l.taskId === t.id && currentWeekDates.includes(l.date),
      );
      return !isDone || hasLogThisWeek;
    });
  }, [
    leafTasks,
    dailyLogs,
    currentWeekDays,
    selectedResourceId,
    viewMode,
    selectedStatus,
  ]);

  const getLogsForDate = (taskId: string, date: string) => {
    return dailyLogs.filter((l) => l.taskId === taskId && l.date === date);
  };

  const getRemainingForDate = (task: any, date: string) => {
    const pastLogs = taskStatusLogs
      .filter((l) => l.taskId === task.id && l.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date));
    const taskDailyLogs = dailyLogs.filter(
      (l) => l.taskId === task.id && l.date <= date,
    );

    if (pastLogs.length > 0) {
      const latestStatusDate = pastLogs[0].date;
      const baseRem = pastLogs[0].remainingDuration;
      const consumedAfterStatus = taskDailyLogs
        .filter((l) => l.date > latestStatusDate)
        .reduce((sum, l) => sum + l.hours, 0);
      return Math.max(0, baseRem - consumedAfterStatus);
    } else {
      const actual = taskDailyLogs.reduce((sum, l) => sum + l.hours, 0);
      return Math.max(0, task.duration - actual);
    }
  };

  const getRemaining = (task: any) => {
    return getRemainingForDate(task, selectedDate);
  };

  // For timeline view, group active tasks by resource
  const tasksByResource = useMemo(() => {
    const grouped: Record<string, typeof activeTasks> = {};
    activeTasks.forEach((task) => {
      let resId = task.resourceId || "unassigned";
      if (resId !== selectedResourceId) {
        resId = "other";
      }
      if (!grouped[resId]) grouped[resId] = [];
      grouped[resId].push(task);
    });
    return grouped;
  }, [activeTasks, selectedResourceId]);

  const adjustWeek = (direction: 1 | -1) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + direction * 7);
    setSelectedDate(curr.toISOString().split("T")[0]);
  };

  const renderToolbar = () => {
    return (
      <>
        <div className="flex justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60 shadow-sm">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "calendar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CalendarDays className="w-4 h-4" />
              カレンダー
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "timeline" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CalendarClock className="w-4 h-4" />
              タイムライン
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <List className="w-4 h-4" />
              リスト
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedResourceId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedResourceId(val);
                if (val !== "all" && val !== "unassigned") {
                  setCurrentUser(val);
                }
              }}
              className="border border-slate-200 rounded-md text-sm bg-white px-3 h-10 shadow-sm text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              <option value="unassigned">担当者未設定</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-slate-200 rounded-md text-sm bg-white px-3 h-10 shadow-sm text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">すべてのステータス</option>
              <option value="todo">未着手</option>
              <option value="in_progress">進行中</option>
              <option value="done">完了</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustWeek(-1)}
              className="p-2 border border-slate-200 bg-white rounded-md hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1 h-10 bg-white border border-slate-200 rounded-lg p-1 shadow-sm w-[350px]">
              {currentWeekDays.map((wd) => {
                const isSelected = selectedDate === wd.dateStr;
                const isSaturday = wd.shortName === "土";
                const isSundayOrHoliday = wd.shortName === "日" || wd.isHoliday;

                let btnClass = "hover:bg-slate-50 text-slate-600";
                let shortNameClass = "text-slate-400";

                if (isSundayOrHoliday) {
                  btnClass = isSelected ? "bg-slate-200 shadow-sm text-rose-600" : "hover:bg-slate-50 text-rose-500";
                  shortNameClass = isSelected ? "text-rose-500" : "text-rose-400";
                } else if (isSaturday) {
                  btnClass = isSelected ? "bg-slate-200 shadow-sm text-blue-600" : "hover:bg-slate-50 text-blue-500";
                  shortNameClass = isSelected ? "text-blue-500" : "text-blue-400";
                } else if (isSelected) {
                  btnClass = "bg-slate-200 shadow-sm text-slate-900";
                  shortNameClass = "text-slate-500";
                }

                return (
                  <button
                    key={wd.dateStr}
                    onClick={() => setSelectedDate(wd.dateStr)}
                    className={`flex-1 flex flex-col items-center justify-center rounded-md transition-colors ${btnClass}`}
                  >
                    <span
                      className={`text-[9px] leading-tight ${shortNameClass}`}
                    >
                      {wd.shortName}
                    </span>
                    <span className="text-xs font-semibold">{wd.dayStr}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => adjustWeek(1)}
              className="p-2 border border-slate-200 bg-white rounded-md hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="ml-2 border border-slate-200 rounded-md font-mono text-sm bg-white p-2 h-10 shadow-sm text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white select-none relative overflow-hidden">
      <div className="flex flex-col gap-4 shrink-0 p-4 sm:px-6 border-b border-slate-200 z-10">
        {renderToolbar()}
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative bg-slate-50/50">
          {viewMode === "list" && (
            <div className="w-full h-full min-h-0 flex-1 overflow-auto p-4 sm:p-6 pb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full h-full flex flex-col">
                <div className="overflow-auto flex-1 hide-scrollbar">
                  <div className="min-w-[1000px] w-full inline-block align-top">
                    <table className="min-w-full w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm sticky top-0 z-40 backdrop-blur-md">
                        <th className="p-3 pl-6 min-w-[250px] font-semibold">タスク</th>
                        <th className="p-3 w-16 text-center border-l border-slate-300 font-semibold">予定</th>
                        {currentWeekDays.map((wd) => {
                          const isSelected = selectedDate === wd.dateStr;
                          const isSaturday = wd.shortName === "土";
                          const isSundayOrHoliday = wd.shortName === "日" || wd.isHoliday;
                          
                          let bgClass = "";
                          if (isSelected) bgClass = "bg-slate-200";
                          else if (isSundayOrHoliday) bgClass = "bg-rose-50/60";
                          else if (isSaturday) bgClass = "bg-blue-50/60";

                          let textClass = "text-slate-700";
                          if (isSundayOrHoliday) textClass = "text-rose-500";
                          else if (isSaturday) textClass = "text-blue-500";
                          else if (isSelected) textClass = "text-slate-900";

                          return (
                          <th
                            key={wd.dateStr}
                            className={`p-2 w-16 text-center border-l border-slate-300 ${bgClass} ${textClass}`}
                          >
                            <div className="text-[10px] font-medium leading-tight opacity-70">{wd.shortName}</div>
                            <div className="text-sm font-semibold mt-0.5 mb-1">{wd.dayStr}</div>
                          </th>
                        )})}
                        <th className="p-3 w-20 text-center border-l border-slate-300 font-semibold">
                          <div className="text-[10px] text-slate-400 mb-0.5 font-normal leading-tight">全累計/最新</div>
                          <div className="text-xs">実績 / 残</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {(() => {
                        const assigned: typeof activeTasks = [];
                        const unassigned: typeof activeTasks = [];
                        if (selectedResourceId === "all") {
                          assigned.push(...activeTasks);
                        } else {
                          activeTasks.forEach((t) => {
                            const resId = t.resourceId || "unassigned";
                            if (resId === selectedResourceId) {
                              assigned.push(t);
                            } else {
                              unassigned.push(t);
                            }
                          });
                        }

                        const renderTaskRow = (task: typeof activeTasks[0]) => {
                          const overallLatestRemaining = Math.max(0, task.remainingDuration ?? 0);

                          return (
                            <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="p-4 pl-6 border-b border-slate-300">
                                <div className="font-medium text-sm text-slate-800 leading-tight">{task.name}</div>
                                <div className="flex gap-2 mt-2 items-center flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                                      task.status === "in_progress"
                                        ? "bg-blue-100 text-blue-700"
                                        : task.status === "done"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {task.status === "in_progress" ? "進行中" : task.status === "done" ? "完了" : "未着手"}
                                  </span>
                                  {task.resourceId ? (
                                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                                      {resources.find((r) => r.id === task.resourceId)?.name || "未設定"}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-orange-50 px-1.5 py-0.5 rounded text-orange-600 border border-orange-100 font-medium">
                                      未アサイン
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 font-mono text-slate-500 text-center text-sm border-l border-b border-slate-300">
                                {task.duration}
                                <span className="text-[10px] text-slate-400 ml-0.5">h</span>
                              </td>
                              {currentWeekDays.map((wd) => {
                                const dayLogs = getLogsForDate(task.id, wd.dateStr);
                                const totalHours = dayLogs.reduce((acc, l) => acc + l.hours, 0);
                                const hoursStr = totalHours > 0 ? totalHours : "";
                                const isSelected = selectedDate === wd.dateStr;
                                const isSaturday = wd.shortName === "土";
                                const isSundayOrHoliday = wd.shortName === "日" || wd.isHoliday;
                                let bgClass = "bg-transparent";
                                if (isSelected) bgClass = "bg-slate-100";
                                else if (isSundayOrHoliday) bgClass = "bg-rose-50/40";
                                else if (isSaturday) bgClass = "bg-blue-50/40";
                                return (
                                  <td
                                    key={wd.dateStr}
                                    className={`p-0 border-l border-b border-slate-300 h-[64px] ${bgClass}`}
                                  >
                                    <div className="flex flex-col h-full relative group/cell">
                                      <input
                                        title="実績工数"
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={hoursStr}
                                        placeholder="-"
                                        onChange={(e) => {
                                          const valStr = e.target.value;
                                          const valNum = Number(valStr) || 0;
                                          const startTime = dayLogs.length > 0 ? dayLogs[0].startTime : undefined;
                                          const targetResourceId =
                                            selectedResourceId !== "all" && selectedResourceId !== "unassigned" ? selectedResourceId : task.resourceId;
                                          updateDailyLog(task.id, wd.dateStr, valStr === "" ? 0 : valNum, startTime, targetResourceId);
                                        }}
                                        className="flex-1 w-full bg-transparent hover:bg-black/5 focus:bg-white text-center font-mono text-sm font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 transition-all border-b border-dashed border-slate-300 placeholder:text-slate-300"
                                      />
                                      <input
                                        title="残工数"
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={getRemainingForDate(task, wd.dateStr) > 0 ? getRemainingForDate(task, wd.dateStr) : ""}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const valStr = e.target.value;
                                          const valNum = Number(valStr) || 0;
                                          updateTask(task.id, {
                                            remainingDuration: valStr === "" ? 0 : valNum,
                                            asOfDate: wd.dateStr,
                                          });
                                        }}
                                        className="flex-1 w-full bg-transparent hover:bg-black/5 focus:bg-white text-center font-mono text-xs font-medium text-blue-600 outline-none focus:ring-1 focus:ring-blue-400 transition-all placeholder:text-blue-300/50"
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="p-0 border-l border-b border-slate-300 bg-slate-50/30 h-[64px]">
                                <div className="flex flex-col h-full">
                                  <div className="flex-1 flex items-center justify-center font-mono text-sm font-semibold text-slate-700 border-b border-dashed border-slate-300">
                                    {task.actualDuration || 0}
                                  </div>
                                  <div className="flex-1 flex items-center justify-center font-mono text-xs font-semibold text-blue-700 bg-blue-50/50">
                                    {overallLatestRemaining}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        };

                        return (
                          <>
                            {assigned.map(renderTaskRow)}
                            {unassigned.length > 0 && selectedResourceId !== "all" && (
                              <>
                                <tr>
                                  <td colSpan={10} className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-y border-slate-200 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider relative transition-colors" onClick={() => setIsOtherCollapsed(!isOtherCollapsed)}>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
                                    <div className="px-6 pr-4 flex items-center justify-start gap-2">
                                      <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${!isOtherCollapsed ? "rotate-90" : ""}`} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {selectedResourceId !== "unassigned" ? `${resources.find(r => r.id === selectedResourceId)?.name || "担当者"} 以外 (未アサイン)` : "指定なし・その他"}
                                        <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{unassigned.length}</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                {!isOtherCollapsed && unassigned.map(renderTaskRow)}
                              </>
                            )}
                            {activeTasks.length === 0 && (
                              <tr>
                                <td colSpan={10} className="p-8 text-center text-slate-400">
                                  該当するタスクがありません
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          )}

          {viewMode === "calendar" && (
            <div className="w-full h-full min-h-0 flex-1 overflow-auto p-4">
              <WeeklyCalendarView
                tasks={activeTasks}
                logs={dailyLogs}
                resources={resources}
                currentWeekDays={currentWeekDays}
                selectedResourceId={selectedResourceId}
                addDailyLog={addDailyLog}
                updateDailyLogById={updateDailyLogById}
                removeDailyLogById={removeDailyLogById}
              />
            </div>
          )}

          {viewMode === "timeline" && (
            <div className="flex-1 overflow-auto bg-slate-50/20 pt-6 px-6 w-full h-full">
              <div className="flex flex-col gap-6 w-full min-w-[800px] pb-10 h-full">
                
                {Object.keys(tasksByResource).length === 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
                    該当するタスクがありません
                  </div>
                )}

                {Object.keys(tasksByResource)
                  .sort((a, b) => {
                    if (a === selectedResourceId) return -1;
                    if (b === selectedResourceId) return 1;
                    return 0;
                  })
                  .map((resId) => {
                  const resName = resId === "other"
                    ? `${resources.find(r => r.id === selectedResourceId)?.name || "担当者"} 以外 (未アサイン)`
                    : resId === "unassigned" 
                      ? "担当者未設定" 
                      : resources.find((r) => r.id === resId)?.name || "不明な担当者";
                  const rTasks = tasksByResource[resId];
                  const rTaskIds = rTasks.map((t) => t.id);
                  const rLogs = dailyLogs.filter((l) => l.date === selectedDate && rTaskIds.includes(l.taskId));

                  if (rTasks.length === 0) return null;

                  const isOtherGroup = resId === "other";

                  return (
                    <div key={resId} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                      <div 
                        className={`font-bold text-slate-700 flex items-center justify-between ${isOtherGroup ? "cursor-pointer hover:text-slate-900" : "mb-4 border-b border-slate-100 pb-3"}`}
                        onClick={() => isOtherGroup && setIsOtherCollapsed(!isOtherCollapsed)}
                      >
                        <div className="flex items-center gap-2">
                          {isOtherGroup && (
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                              <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${!isOtherCollapsed ? "rotate-90" : ""}`} />
                            </div>
                          )}
                          <span>{resName}</span>
                          {isOtherGroup && (
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs font-medium">
                              {rTasks.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {!isOtherGroup && (
                            <span className="text-xs font-normal text-slate-500 font-mono">
                              タスク数: {rTasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {(!isOtherGroup || !isOtherCollapsed) && (
                        <div className={`flex flex-col animate-in fade-in slide-in-from-top-2 duration-300 ${isOtherGroup ? "mt-4 border-t border-slate-100 pt-3" : ""}`}>
                          {rTasks.map((task) => {
                            const otherLogs = rLogs.filter((l) => l.taskId !== task.id);
                            const targetResId = resId === "unassigned" ? undefined : resId;
                            return (
                              <TimelineTaskRow
                                key={task.id}
                                task={task}
                                logs={getLogsForDate(task.id, selectedDate)}
                                otherLogs={otherLogs}
                                taskStatusLogs={taskStatusLogs}
                                allDailyLogs={dailyLogs}
                                selectedDate={selectedDate}
                                addDailyLog={addDailyLog}
                                updateDailyLogById={updateDailyLogById}
                                removeDailyLogById={removeDailyLogById}
                                updateTask={updateTask}
                                resourceId={targetResId}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-xs text-slate-400 mt-4 text-center">
                  空のタイムラインをクリックして実績を追加 / バーの端をドラッグして時間を調整
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
