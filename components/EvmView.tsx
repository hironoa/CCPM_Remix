"use client";
import { useStore, isWorkingDay, getWorkingHoursDiff } from "@/lib/store";
import { useMemo, useState } from "react";
import * as JapaneseHolidays from "japanese-holidays";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

export default function EvmView() {
  const { tasks, projectStartDate, feverHistory, dailyLogs, taskStatusLogs, resources } = useStore();
  const [selectedResource, setSelectedResource] = useState<string>("all");

  const evmData = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    // Total project budget = sum of all leaf task durations
    const rootParents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    let leafTasks = tasks.filter(
      (t) =>
        !rootParents.has(t.id) &&
        t.type !== "project_buffer" &&
        t.type !== "feeding_buffer",
    );

    if (selectedResource !== "all") {
      leafTasks = leafTasks.filter((t) => t.resourceId === selectedResource);
    }

    // Using 8 for hours per day. Let's make it more generic or hardcoded if workingHoursPerDay isn't used here.
    const maxEndDay = leafTasks.reduce((max, task) => {
      const baseFinish = (task as any).baselineEarlyFinish || task.earlyFinish;
      if (!baseFinish) {
        const startOffset = task.earlyStart
          ? Math.floor(
              (task.earlyStart.getTime() - projectStartDate.getTime()) /
                (24 * 60 * 60 * 1000),
            )
          : 0;
        return Math.max(max, startOffset + task.duration / 8);
      }
      const offset = Math.floor(
        (baseFinish.getTime() - projectStartDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      return Math.max(max, offset);
    }, 0);

    const minStartDay = leafTasks.reduce((min, task) => {
      const baseStart = (task as any).baselineEarlyStart || task.earlyStart;
      if (!baseStart) return min;
      const offset = Math.floor(
        (baseStart.getTime() - projectStartDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      return Math.min(min, offset);
    }, 0);

    const todayOrig = new Date();
    todayOrig.setHours(0, 0, 0, 0);

    const today = new Date(todayOrig);
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayStr = today.toISOString().split("T")[0];

    const data = [];
    const historyMap = new Map((feverHistory || []).map((h) => [h.date, h]));
    let lastEV = 0;
    let lastAC = 0;

    let endLoopDay = Math.max(
      maxEndDay + 2,
      Math.floor(
        (todayOrig.getTime() - projectStartDate.getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 2,
    );

    let startLoopDay = Math.min(-1, minStartDay - 1);

    for (let day = startLoopDay; day <= endLoopDay; day++) {
      const currentDate = new Date(projectStartDate);
      currentDate.setDate(currentDate.getDate() + day);
      const localDate = new Date(currentDate);
      localDate.setMinutes(
        localDate.getMinutes() - localDate.getTimezoneOffset(),
      );
      const dateStr = localDate.toISOString().split("T")[0];
      const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

      let pv = 0;
      leafTasks.forEach((t) => {
        const targetDateMs = currentDate.getTime() + 24 * 60 * 60 * 1000; // End of the current day
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
      });

      const isSat = currentDate.getDay() === 6;
      const isSunOrHol =
        currentDate.getDay() === 0 || !!JapaneseHolidays.isHoliday(currentDate);

      const point: any = {
        day: dateStr,
        label: formattedDate,
        isSaturday: isSat && !isSunOrHol,
        isSundayOrHoliday: isSunOrHol,
        pv: Math.round(pv),
      };

      // Use history if available, else pull forward until today
      let evLocal = 0;
      let acLocal = 0;

      if (dateStr <= todayStr) {
        if (selectedResource === "all") {
          const historyRecord = historyMap.get(dateStr);
          if (historyRecord) {
            lastEV = historyRecord.ev || 0;
            lastAC = historyRecord.ac || 0;
          }
          if (day === -1) {
            evLocal = 0;
            acLocal = 0;
          } else {
            evLocal = lastEV;
            acLocal = lastAC;
          }
        } else {
          if (day === -1) {
            evLocal = 0;
            acLocal = 0;
          } else {
            leafTasks.forEach(t => {
              const taskDailyLogs = dailyLogs.filter(
                (l) => l.taskId === t.id && l.date <= dateStr,
              );
              const actual = taskDailyLogs.reduce((sum, l) => sum + l.hours, 0);

              const taskStatusLogsUpToDate = taskStatusLogs
                .filter((l) => l.taskId === t.id && l.date <= dateStr)
                .sort((a, b) => b.date.localeCompare(a.date));
              const latestStatus = taskStatusLogsUpToDate.length > 0 ? taskStatusLogsUpToDate[0] : null;
              const remaining = latestStatus
                ? latestStatus.remainingDuration
                : Math.max(0, t.duration - actual);

              let progress = 0;
              const expected = actual + remaining;
              if (t.status === "done") {
                progress = 100;
              } else if (expected > 0) {
                progress = (actual / expected) * 100;
              }

              evLocal += t.duration * (progress / 100);
              acLocal += actual;
            });
          }
        }

        point.ev = Math.round(evLocal);
        point.ac = Math.round(acLocal);

        point.spi = point.pv
          ? Number((point.ev / point.pv).toFixed(2))
          : point.ev
            ? 1
            : null;
        point.cpi = point.ac
          ? Number((point.ev / point.ac).toFixed(2))
          : point.ev
            ? 1
            : null;
      }

      data.push(point);
    }
    return data;
  }, [tasks, projectStartDate, feverHistory, selectedResource, dailyLogs, taskStatusLogs]);

  const holidayAreas = useMemo(() => {
    const areas: {
      start: string;
      end: string;
      type: "saturday" | "sundayOrHoliday";
    }[] = [];
    let satStartIdx = -1;
    let sunStartIdx = -1;

    for (let i = 0; i < evmData.length; i++) {
      // Saturday logic
      if (evmData[i].isSaturday) {
        if (satStartIdx === -1) satStartIdx = i;
      } else {
        if (satStartIdx !== -1) {
          areas.push({
            start: evmData[Math.max(0, satStartIdx - 1)].label,
            end: evmData[i - 1].label,
            type: "saturday",
          });
          satStartIdx = -1;
        }
      }

      // Sunday/Holiday logic
      if (evmData[i].isSundayOrHoliday) {
        if (sunStartIdx === -1) sunStartIdx = i;
      } else {
        if (sunStartIdx !== -1) {
          areas.push({
            start: evmData[Math.max(0, sunStartIdx - 1)].label,
            end: evmData[i - 1].label,
            type: "sundayOrHoliday",
          });
          sunStartIdx = -1;
        }
      }
    }

    if (satStartIdx !== -1) {
      areas.push({
        start: evmData[Math.max(0, satStartIdx - 1)].label,
        end: evmData[evmData.length - 1].label,
        type: "saturday",
      });
    }
    if (sunStartIdx !== -1) {
      areas.push({
        start: evmData[Math.max(0, sunStartIdx - 1)].label,
        end: evmData[evmData.length - 1].label,
        type: "sundayOrHoliday",
      });
    }

    return areas;
  }, [evmData]);

  const latestMetrics = useMemo(() => {
    if (evmData.length === 0) return null;

    // Find the current point (most recent past date up to today with ev and ac)
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayStr = today.toISOString().split("T")[0];

    let currentPoint =
      evmData.find((d) => d.day === todayStr) || evmData[evmData.length - 1];

    const pv = currentPoint.pv;
    const ev = currentPoint.ev || 0;
    const ac = currentPoint.ac || 0;
    const bac = evmData[evmData.length - 1].pv;

    const cv = ev - ac; // Cost Variance
    const sv = ev - pv; // Schedule Variance
    const cpi = ac !== 0 ? (ev / ac).toFixed(2) : 0; // Cost Performance Index
    const spi = pv !== 0 ? (ev / pv).toFixed(2) : 0; // Schedule Performance Index

    return { pv, ev, ac, cv, sv, cpi, spi, bac };
  }, [evmData]);

  return (
    <div className="flex flex-col h-full bg-slate-50/30 select-none">
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col gap-6">
        <div className="flex justify-between items-end shrink-0">
          <div className="text-sm font-semibold text-slate-700 mt-2">表示対象:
            <select
              className="ml-2 border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-700 bg-white"
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
            >
              <option value="all">すべてのタスク</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
        {latestMetrics && (
          <div className="grid grid-cols-5 gap-4 shrink-0">
            <div className="p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <div className="text-xs text-slate-500 font-medium mb-1">
                BAC (完成時総予算)
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {latestMetrics.bac}h
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <div className="text-xs text-slate-500 font-medium mb-1">
                PV (計画予算)
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {latestMetrics.pv}h
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <div className="text-xs text-slate-500 font-medium mb-1">
                EV (出来高)
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {latestMetrics.ev}h
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <div className="text-xs text-slate-500 font-medium mb-1">
                AC (実コスト)
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {latestMetrics.ac}h
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm">
              <div className="text-xs text-slate-500 font-medium mb-1">
                SPI / CPI
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div
                    className={`text-xl font-bold ${Number(latestMetrics.spi) >= 1 ? "text-green-600" : "text-red-500"}`}
                  >
                    {latestMetrics.spi}
                  </div>
                  <div className="text-[10px] text-slate-400">Schedule</div>
                </div>
                <div className="flex-1">
                  <div
                    className={`text-xl font-bold ${Number(latestMetrics.cpi) >= 1 ? "text-green-600" : "text-red-500"}`}
                  >
                    {latestMetrics.cpi}
                  </div>
                  <div className="text-[10px] text-slate-400">Cost</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col gap-6 shrink-0">
          <div className="h-[300px] shrink-0 bg-white border border-slate-200/60 rounded-xl shadow-sm p-4 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={evmData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              syncId="evmCharts"
            >
              {holidayAreas.map((area, i) => (
                <ReferenceArea
                  key={i}
                  x1={area.start}
                  x2={area.end}
                  fill={area.type === "saturday" ? "#eff6ff" : "#fff1f2"}
                />
              ))}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                dx={-10}
                label={{
                  value: "工数 (h)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -10,
                  fill: "#64748b",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload) {
                    return `${payload[0].payload.day} (${label})`;
                  }
                  return label;
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              {latestMetrics && (
                <ReferenceLine
                  y={latestMetrics.bac}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  label={{ position: 'top', value: `BAC (${latestMetrics.bac}h)`, fill: '#64748b', fontSize: 12 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="pv"
                name="PV (Planned Value)"
                stroke="#94a3b8"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ev"
                name="EV (Earned Value)"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ac"
                name="AC (Actual Cost)"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[250px] shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm p-4 relative">
          <div className="text-sm font-semibold text-slate-700 mb-2 pl-4">
            SPI / CPI 推移
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={evmData}
              margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
              syncId="evmCharts"
            >
              {holidayAreas.map((area, i) => (
                <ReferenceArea
                  key={i}
                  x1={area.start}
                  x2={area.end}
                  fill={area.type === "saturday" ? "#eff6ff" : "#fff1f2"}
                />
              ))}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                dx={-10}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload) {
                    return `${payload[0].payload.day} (${label})`;
                  }
                  return label;
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <ReferenceLine y={1.0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="spi"
                name="SPI (Schedule)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="cpi"
                name="CPI (Cost)"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[250px] overflow-auto shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
              <tr>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b">
                  日付
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  PV (h)
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  EV (h)
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  AC (h)
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  SPI
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  CPI
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  CC進捗率(%)
                </th>
                <th className="py-2 px-4 font-semibold text-slate-600 border-b text-right">
                  バッファ消費(%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evmData && evmData.some(d => d.ev !== undefined) ? (
                [...evmData]
                  .filter(d => d.ev !== undefined)
                  .sort((a, b) => b.day.localeCompare(a.day))
                  .map((r, i) => {
                    const spi = r.pv ? (r.ev || 0) / r.pv : 0;
                    const cpi = r.ac ? (r.ev || 0) / r.ac : 0;
                    const historyRecord = selectedResource === "all" ? feverHistory.find(h => h.date === r.day) : null;
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-4 text-slate-700 font-mono text-xs">
                          {r.day || "-"}
                        </td>
                        <td className="py-2 px-4 text-slate-700 text-right font-mono">
                          {r.pv !== undefined ? r.pv.toFixed(1) : "-"}
                        </td>
                        <td className="py-2 px-4 text-slate-700 text-right font-mono">
                          {r.ev !== undefined ? r.ev.toFixed(1) : "-"}
                        </td>
                        <td className="py-2 px-4 text-slate-700 text-right font-mono">
                          {r.ac !== undefined ? r.ac.toFixed(1) : "-"}
                        </td>
                        <td
                          className={`py-2 px-4 text-right font-mono font-medium ${spi >= 1 ? "text-green-600" : "text-red-500"}`}
                        >
                          {spi.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-4 text-right font-mono font-medium ${cpi >= 1 ? "text-green-600" : "text-red-500"}`}
                        >
                          {cpi.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 text-slate-700 text-right font-mono">
                          {historyRecord && historyRecord.ccProgress !== undefined
                            ? historyRecord.ccProgress.toFixed(1)
                            : "-"}
                        </td>
                        <td className="py-2 px-4 text-slate-700 text-right font-mono">
                          {historyRecord && historyRecord.bufferConsumption !== undefined
                            ? historyRecord.bufferConsumption.toFixed(1)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    実績ログの記録がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
