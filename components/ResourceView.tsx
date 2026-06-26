"use client";
import { useStore, Resource, isWorkingDay } from "@/lib/store";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import * as JapaneseHolidays from "japanese-holidays";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, startOfWeek } from "date-fns";

export default function ResourceView() {
  const {
    resources,
    tasks,
    dailyLogs,
    addResource,
    updateResource,
    deleteResource,
    updateTask,
  } = useStore();
  const [newResName, setNewResName] = useState("");
  const [newResCap, setNewResCap] = useState(8);
  const [newResProd, setNewResProd] = useState("1.0");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const [activeMainTab, setActiveMainTab] = useState<"manage" | "load">("load");

  const handleAdd = () => {
    const prodVal = Number(newResProd) || 1.0;
    if (newResName.trim()) {
      addResource({
        name: newResName,
        capacity: newResCap,
        productivity: prodVal,
      });
      setNewResName("");
      setNewResCap(8);
      setNewResProd("1.0");
    }
  };

  // Setup date range for timeline
  let minTime = Infinity;
  let maxTime = -Infinity;
  tasks.forEach((t) => {
    if (t.startDate)
      minTime = Math.min(minTime, new Date(t.startDate).getTime());
    if (t.endDate) maxTime = Math.max(maxTime, new Date(t.endDate).getTime());
  });
  if (minTime === Infinity) minTime = Date.now();
  if (maxTime === -Infinity) maxTime = Date.now() + 7 * 24 * 60 * 60 * 1000;

  let currentD = new Date(minTime);
  currentD.setHours(0, 0, 0, 0);
  const endD = new Date(maxTime);
  endD.setHours(23, 59, 59, 999);

  const maxDays = Math.min(
    180,
    Math.ceil((endD.getTime() - currentD.getTime()) / (24 * 60 * 60 * 1000)) +
      1,
  );

  const dailyDates: Date[] = [];
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(currentD.getTime() + i * 24 * 60 * 60 * 1000);
    dailyDates.push(d);
  }

  // Calculate daily load
  const resourceDailyLoad = new Map<string, number[]>();
  const resourceDailyActual = new Map<string, number[]>();
  resources.forEach((res) => {
    resourceDailyLoad.set(res.id, new Array(dailyDates.length).fill(0));
    resourceDailyActual.set(res.id, new Array(dailyDates.length).fill(0));
  });

  tasks.forEach((task) => {
    if (
      task.status === "done" ||
      !task.resourceId ||
      !resourceDailyLoad.has(task.resourceId)
    )
      return;
    if (!task.startDate || !task.endDate) return;

    const tStart = new Date(task.startDate).getTime();
    const tEnd = new Date(task.endDate).getTime();

    // Find matching working days
    const taskWorkingDaysIndices: number[] = [];
    dailyDates.forEach((d, idx) => {
      const dTime = d.getTime();
      const dEnd = d.getTime() + 24 * 60 * 60 * 1000 - 1;
      if (dEnd >= tStart && dTime < tEnd) {
        if (isWorkingDay(d)) {
          taskWorkingDaysIndices.push(idx);
        }
      }
    });

    if (taskWorkingDaysIndices.length > 0) {
      const res = resources.find((r) => r.id === task.resourceId);
      const prod = res?.productivity || 1.0;

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
      const requiredEffort = expectedDuration / prod;

      const dailyEffort = requiredEffort / taskWorkingDaysIndices.length;
      const loads = resourceDailyLoad.get(task.resourceId)!;
      taskWorkingDaysIndices.forEach((idx) => {
        loads[idx] += dailyEffort;
      });
    }
  });

  // Calculate actuals from dailyLogs
  dailyLogs.forEach((log) => {
    // Find index in dailyDates
    const dIndex = dailyDates.findIndex(
      (d) => format(d, "yyyy-MM-dd") === log.date,
    );
    if (dIndex !== -1) {
      const resId = log.resourceId; // log contains resourceId, but might be empty if unassigned?
      // wait, dailyLogs has resourceId for the log. Or if not, we use task.resourceId.
      const t = tasks.find((t) => t.id === log.taskId);
      const targetResId = resId || (t ? t.resourceId : undefined);

      if (targetResId && resourceDailyActual.has(targetResId)) {
        resourceDailyActual.get(targetResId)![dIndex] += log.hours;
      }
    }
  });

  // Calculate weekly load
  const weekList: { label: string; startIndex: number; endIndex: number }[] =
    [];
  let currentWeekLabel = "";
  let curWkStartIdx = -1;
  dailyDates.forEach((d, idx) => {
    const wkStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday start
    const label = format(wkStart, "M/d(月)〜");
    if (label !== currentWeekLabel) {
      if (curWkStartIdx !== -1) {
        weekList[weekList.length - 1].endIndex = idx - 1;
      }
      weekList.push({ label, startIndex: idx, endIndex: idx });
      currentWeekLabel = label;
      curWkStartIdx = idx;
    } else {
      weekList[weekList.length - 1].endIndex = idx;
    }
  });

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <div className="flex border-b border-slate-200/60 shrink-0 px-4 sm:px-6">
        <button
          onClick={() => setActiveMainTab("load")}
          className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 ${activeMainTab === "load" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          リソース負荷状況
        </button>
        <button
          onClick={() => setActiveMainTab("manage")}
          className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 ${activeMainTab === "manage" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          リソース管理
        </button>
      </div>

      <div
        className="flex-1 overflow-auto bg-slate-50/30 p-4 sm:p-6"
        style={{ display: activeMainTab === "manage" ? "block" : "none" }}
      >
        {/* Resource Management Form */}
        <div className="w-full bg-white p-6 border border-slate-200/60 rounded-xl shadow-sm max-w-3xl mx-auto">
          <div className="flex flex-col gap-4 mb-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b pb-2 mb-2">新しいリソースを追加</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  既存のユーザーから選択
                </label>
                <select
                  value={newResName}
                  onChange={(e) => {
                    setNewResName(e.target.value);
                    const user = useStore.getState().globalUsers.find(u => u.name === e.target.value);
                    if (user && user.defaultCapacity) setNewResCap(user.defaultCapacity);
                  }}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- 新規作成するか選択 --</option>
                  {useStore.getState().globalUsers
                    .filter(u => !resources.find(r => r.name === u.name))
                    .map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  または新規リソース名を入力
                </label>
                <input
                  type="text"
                  value={newResName}
                  onChange={(e) => setNewResName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="例: 山田太郎"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  このプロジェクトでの稼働時間/日 (h)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newResCap}
                  onChange={(e) => setNewResCap(Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label
                  className="block text-sm font-medium text-slate-700 mb-1"
                  title="1より大きいと生産性が高い"
                >
                  このプロジェクトでの生産性(倍率)
                </label>
                <input
                  type="text"
                  value={newResProd}
                  onChange={(e) => setNewResProd(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="1.0"
                />
              </div>
            </div>
            <button
              onClick={() => {
                // Ensure user exists in global users
                const state = useStore.getState();
                const existsGlobally = state.globalUsers.find(u => u.name === newResName.trim());
                if (!existsGlobally && newResName.trim()) {
                  state.addGlobalUser({ name: newResName.trim(), defaultCapacity: newResCap });
                }
                handleAdd();
              }}
              className="mt-2 bg-blue-600 text-white flex items-center justify-center gap-2 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              追加
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b pb-2">
              プロジェクト参加中のリソース
            </h3>
            {resources.map((res) => (
              <div
                key={res.id}
                className="flex flex-col gap-2 p-3 bg-slate-50 rounded border border-slate-100 group"
              >
                <div className="flex justify-between items-center gap-2">
                  <input
                    type="text"
                    value={res.name}
                    onChange={(e) =>
                      updateResource(res.id, { name: e.target.value })
                    }
                    className="font-medium text-slate-800 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-2 py-1 outline-none w-full transition-all"
                  />
                  <button
                    onClick={() => deleteResource(res.id)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                    title="リソースを削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center gap-2 mt-1">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-slate-500">稼働時間/日:</span>
                    <input
                      type="number"
                      min={1}
                      value={res.capacity}
                      onChange={(e) =>
                        updateResource(res.id, {
                          capacity: Number(e.target.value) || 1,
                        })
                      }
                      className="w-16 bg-white px-2 py-1 rounded shadow-sm border border-slate-200 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-slate-500">生産性:</span>
                    <input
                      type="text"
                      value={res.productivity || 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateResource(res.id, {
                          productivity: isNaN(val) ? 1.0 : val,
                        });
                      }}
                      className="w-16 bg-white px-2 py-1 rounded shadow-sm border border-slate-200 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>
            ))}
            {resources.length === 0 && (
              <p className="text-sm text-slate-400">
                リソースが登録されていません
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Load Display (Timeline) */}
      <div
        className="flex-1 flex flex-col bg-white overflow-hidden"
        style={{ display: activeMainTab === "load" ? "flex" : "none" }}
      >
        <div className="flex justify-end p-4 sm:p-6 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-md shadow-sm border border-slate-200/60">
              <button
                onClick={() => setActiveTab("daily")}
                className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                日ごとのアサイン
              </button>
              <button
                onClick={() => setActiveTab("weekly")}
                className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === "weekly" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                週ごとのアサイン
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-4 sm:px-6 pb-8 min-h-0 flex flex-col relative w-full">
            <div className="flex-1 overflow-auto hide-scrollbar border border-slate-200 rounded-lg">
              <div className="min-w-[800px] w-full inline-block align-top">
                {activeTab === "daily" && (
                    <table className="min-w-full w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 sticky top-0 z-10 shadow-sm text-slate-600 text-sm">
                    <th className="p-3 text-left font-bold border-b border-slate-200 min-w-[120px] sticky left-0 bg-slate-100">
                      リソース
                    </th>
                    {dailyDates.map((d, i) => {
                      const isSaturday = d.getDay() === 6;
                      const isSundayOrHoliday =
                        d.getDay() === 0 || !!JapaneseHolidays.isHoliday(d);

                      let headerBg = "";
                      let headerText = "text-slate-600";
                      let subText = "text-slate-400";
                      
                      if (isSundayOrHoliday) {
                        headerBg = "bg-rose-50/60";
                        headerText = "text-rose-600";
                        subText = "text-rose-400";
                      } else if (isSaturday) {
                        headerBg = "bg-blue-50/60";
                        headerText = "text-blue-600";
                        subText = "text-blue-400";
                      }
                      
                      return (
                        <th
                          key={i}
                          className={`p-2 text-center font-medium border-b border-l border-slate-200 min-w-[50px] ${headerBg} ${headerText}`}
                        >
                          <div className={`text-[10px] ${subText}`}>
                            {format(d, "M/d")}
                          </div>
                          <div className="text-xs">{format(d, "E")}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((res) => {
                    const loads = resourceDailyLoad.get(res.id) || [];
                    const actuals = resourceDailyActual.get(res.id) || [];
                    return (
                      <tr
                        key={res.id}
                        className="border-b border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium text-slate-800 text-sm sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] truncate max-w-[150px]">
                          {res.name}
                        </td>
                        {loads.map((load, i) => {
                          const act = actuals[i];
                          const isOverload = load > res.capacity;
                          const d = dailyDates[i];
                          const isSaturday = d.getDay() === 6;
                          const isSundayOrHoliday = d.getDay() === 0 || !!JapaneseHolidays.isHoliday(d);
                          
                          let cellBg = "";
                          if (isSundayOrHoliday) cellBg = "bg-rose-50/20";
                          else if (isSaturday) cellBg = "bg-blue-50/20";

                          return (
                            <td
                              key={i}
                              className={`p-1.5 border-l border-slate-200 align-top min-w-[60px] ${cellBg}`}
                            >
                              <div className="flex flex-col gap-1 w-full text-[10px]">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-slate-400">予</span>
                                  <span
                                    className={`font-bold ${isOverload ? "text-red-500" : "text-slate-600"}`}
                                  >
                                    {load > 0
                                      ? (Math.round(load * 10) / 10).toFixed(1)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  {load > 0 && (
                                    <div
                                      className={`h-full ${isOverload ? "bg-red-400" : "bg-blue-300"}`}
                                      style={{
                                        width: `${Math.min(100, (load / res.capacity) * 100)}%`,
                                      }}
                                    ></div>
                                  )}
                                </div>
                                <div className="flex justify-between items-center px-1 mt-0.5">
                                  <span className="text-slate-400">実</span>
                                  <span className="font-bold text-slate-700">
                                    {act > 0
                                      ? (Math.round(act * 10) / 10).toFixed(1)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  {act > 0 && (
                                    <div
                                      className="h-full bg-blue-600"
                                      style={{
                                        width: `${Math.min(100, (act / res.capacity) * 100)}%`,
                                      }}
                                    ></div>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {resources.length === 0 && (
                    <tr>
                      <td
                        colSpan={dailyDates.length + 1}
                        className="p-8 text-center text-slate-400"
                      >
                        リソースが登録されていません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "weekly" && (
              <table className="min-w-full w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 sticky top-0 z-10 shadow-sm text-slate-600 text-sm">
                    <th className="p-3 text-left font-bold border-b border-slate-200 min-w-[120px]">
                      リソース
                    </th>
                    {weekList.map((wk, i) => (
                      <th
                        key={i}
                        className="p-2 text-center font-medium border-b border-l border-slate-200"
                      >
                        {wk.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((res) => {
                    const loads = resourceDailyLoad.get(res.id) || [];
                    const actuals = resourceDailyActual.get(res.id) || [];
                    return (
                      <tr
                        key={res.id}
                        className="border-b border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium text-slate-800 text-sm sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] truncate max-w-[150px]">
                          {res.name}
                        </td>
                        {weekList.map((wk, i) => {
                          let weekLoad = 0;
                          let weekActual = 0;
                          let workingDays = 0;
                          for (let d = wk.startIndex; d <= wk.endIndex; d++) {
                            weekLoad += loads[d];
                            weekActual += actuals[d];
                            if (isWorkingDay(dailyDates[d])) {
                              workingDays++;
                            }
                          }
                          const weekCap = res.capacity * workingDays;
                          const isOverload = weekCap > 0 && weekLoad > weekCap;

                          return (
                            <td
                              key={i}
                              className="p-2 border-l border-slate-200 align-top min-w-[80px]"
                            >
                              <div className="flex flex-col gap-1 w-full text-xs">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-slate-400">予:</span>
                                  <span
                                    className={`font-bold ${isOverload ? "text-red-500" : "text-slate-600"}`}
                                  >
                                    {weekLoad > 0
                                      ? (
                                          Math.round(weekLoad * 10) / 10
                                        ).toFixed(1)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  {weekLoad > 0 && (
                                    <div
                                      className={`h-full ${isOverload ? "bg-red-400" : "bg-blue-300"}`}
                                      style={{
                                        width: `${Math.min(100, (weekLoad / weekCap) * 100)}%`,
                                      }}
                                    ></div>
                                  )}
                                </div>

                                <div className="flex justify-between items-center px-1 mt-1">
                                  <span className="text-slate-400">実:</span>
                                  <span className="font-bold text-slate-700">
                                    {weekActual > 0
                                      ? (
                                          Math.round(weekActual * 10) / 10
                                        ).toFixed(1)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  {weekActual > 0 && (
                                    <div
                                      className="h-full bg-blue-600"
                                      style={{
                                        width: `${Math.min(100, (weekActual / weekCap) * 100)}%`,
                                      }}
                                    ></div>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 text-right mt-1">
                                  上限: {weekCap}h
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {resources.length === 0 && (
                    <tr>
                      <td
                        colSpan={weekList.length + 1}
                        className="p-8 text-center text-slate-400"
                      >
                        リソースが登録されていません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
                </div>
              </div>
            </div>
      </div>
    </div>
  );
}
