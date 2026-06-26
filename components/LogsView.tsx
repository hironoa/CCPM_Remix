"use client";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { History, FileText } from "lucide-react";

export default function LogsView() {
  const { feverHistory, dailyLogs, tasks, resources, projectStartDate } =
    useStore();
  const [activeTab, setActiveTab] = useState<"project" | "tasks" | "json">(
    "project",
  );

  const detailedDailyLogs = useMemo(() => {
    return (dailyLogs || [])
      .map((log) => {
        const t = tasks.find((tsk) => tsk.id === log.taskId);
        const r = resources.find((res) => res.id === log.resourceId);
        return {
          ...log,
          taskName: t ? t.name : "Unknown Task",
          resourceName: r
            ? r.name
            : log.resourceId
              ? "削除されたリソース"
              : "未割り当て",
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Descending
  }, [dailyLogs, tasks, resources]);

  const sortedFeverHistory = useMemo(() => {
    return [...(feverHistory || [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [feverHistory]);

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <div className="flex justify-end p-4 sm:p-6 shrink-0 bg-slate-50/30">
        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200/60 shadow-sm bg-white">
          <button
            onClick={() => setActiveTab("project")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "project"
                ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            プロジェクト日次スナップショット (EVM / CCPM)
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "tasks"
                ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            日々の作業ログ (タイムシート実績)
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "json"
                ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            JSONデータ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30 p-4 sm:p-6">
        <div className="flex-1 overflow-auto bg-white border border-slate-200/60 rounded-xl shadow-sm">
        {activeTab === "project" && (
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-md">
              <tr>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b">
                  記録日
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  PV (h)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  EV (h)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  AC (h)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  SPI
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  CPI
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  クリティカルパス (進捗%)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  Pバッファ (消費%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFeverHistory.length > 0 ? (
                sortedFeverHistory.map((r, i) => {
                  const spi = r.pv ? (r.ev || 0) / r.pv : 0;
                  const cpi = r.ac ? (r.ev || 0) / r.ac : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 text-slate-800 font-mono text-sm">
                        {r.date || "-"}
                      </td>
                      <td className="py-3 px-6 text-slate-700 text-right font-mono">
                        {r.pv !== undefined ? r.pv.toFixed(1) : "-"}
                      </td>
                      <td className="py-3 px-6 text-slate-700 text-right font-mono">
                        {r.ev !== undefined ? r.ev.toFixed(1) : "-"}
                      </td>
                      <td className="py-3 px-6 text-slate-700 text-right font-mono">
                        {r.ac !== undefined ? r.ac.toFixed(1) : "-"}
                      </td>
                      <td
                        className={`py-3 px-6 text-right font-mono font-medium ${spi >= 1 ? "text-green-600" : "text-red-500"}`}
                      >
                        {spi.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-6 text-right font-mono font-medium ${cpi >= 1 ? "text-green-600" : "text-red-500"}`}
                      >
                        {cpi.toFixed(2)}
                      </td>
                      <td className="py-3 px-6 text-slate-700 text-right font-mono">
                        {r.ccProgress !== undefined
                          ? r.ccProgress.toFixed(1)
                          : "-"}
                      </td>
                      <td className="py-3 px-6 text-slate-700 text-right font-mono">
                        {r.bufferConsumption !== undefined
                          ? r.bufferConsumption.toFixed(1)
                          : "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    プロジェクト追跡のログがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "tasks" && (
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-md">
              <tr>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b">
                  日付
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b">
                  タスク
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b">
                  リソース (担当者)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  開始時刻 (h)
                </th>
                <th className="py-3 px-6 font-semibold text-slate-700 border-b text-right">
                  作業工数 (h)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailedDailyLogs.length > 0 ? (
                detailedDailyLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-6 text-slate-800 font-mono text-sm">
                      {log.date}
                    </td>
                    <td className="py-3 px-6 text-slate-800 font-medium">
                      {log.taskName}
                    </td>
                    <td className="py-3 px-6 text-slate-600">
                      {log.resourceName}
                    </td>
                    <td className="py-3 px-6 text-slate-600 text-right font-mono">
                      {log.startTime !== undefined
                        ? `${log.startTime}:00`
                        : "-"}
                    </td>
                    <td className="py-3 px-6 text-slate-800 text-right font-mono font-medium">
                      {log.hours.toFixed(1)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    タスクの作業ログがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "json" && (
          <div className="p-4 bg-slate-50 min-h-full">
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all overflow-auto">
              {JSON.stringify(
                {
                  projectStartDate,
                  tasks,
                  resources,
                  dailyLogs,
                  feverHistory,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
