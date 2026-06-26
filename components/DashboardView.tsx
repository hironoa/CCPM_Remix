"use client";
import { useStore, Task } from "@/lib/store";
import { BarChart3, CheckCircle2, Clock, PlayCircle, Flame } from "lucide-react";
import { useMemo } from "react";

export default function DashboardView() {
  const { tasks, resources, loadSampleData, workingHoursPerDay } = useStore();

  const metrics = useMemo(() => {
    const regularTasks = tasks.filter(
      (t) => t.type !== "project_buffer" && t.type !== "feeding_buffer",
    );
    const totalTasks = regularTasks.length;
    const completedTasks = regularTasks.filter(
      (t) => t.status === "done",
    ).length;
    const inProgressTasks = regularTasks.filter(
      (t) => t.status === "in_progress",
    ).length;

    // Overall Progress (Task Count based)
    const completionRate =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Critical Chain calculation
    const leafTasks = tasks.filter(
      (t) => !tasks.some((p) => p.parentId === t.id),
    );
    const criticalTasks = leafTasks.filter(
      (t) => t.isCritical && t.type === "regular",
    );

    let completedCritical = 0;
    let delay = 0;

    let totalEstimate = 0;
    let totalActual = 0;
    let totalRemaining = 0;

    leafTasks.forEach((t) => {
      if (t.type === "regular") {
        const estimate = t.duration;
        totalEstimate += estimate;

        const actual =
          t.actualDuration !== undefined
            ? t.actualDuration
            : t.duration * (t.progress / 100);
        const remaining =
          t.remainingDuration !== undefined
            ? t.remainingDuration
            : Math.max(0, t.duration - actual);

        totalActual += actual;
        totalRemaining += remaining;

        if (t.isCritical) {
          completedCritical += t.duration * (t.progress / 100);
        }

        const expectedTotal = actual + remaining;
        const taskDelay = expectedTotal - t.duration;

        if (taskDelay > 0) delay += taskDelay;
      }
    });

    const workExpected = totalActual + totalRemaining;
    const workProgress =
      workExpected > 0 ? Math.round((totalActual / workExpected) * 100) : 0;

    const totalCriticalDuration = criticalTasks.reduce(
      (acc, t) => acc + t.duration,
      0,
    );
    const ccProgress =
      totalCriticalDuration > 0
        ? Math.round((completedCritical / totalCriticalDuration) * 100)
        : 0;

    const projectBuffer = useStore.getState().getProjectBufferHours();
    const bufferConsumptionRaw =
      projectBuffer > 0 ? (delay / projectBuffer) * 100 : 0;
    const bufferConsumption = Math.round(bufferConsumptionRaw);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      completionRate,
      ccProgress,
      bufferConsumption,
      workProgress,
      totalEstimateH: Math.round(totalEstimate * 10) / 10,
      totalActualH: Math.round(totalActual * 10) / 10,
      totalRemainingH: Math.round(totalRemaining * 10) / 10,
    };
  }, [tasks, workingHoursPerDay]);

  return (
    <div className="flex flex-col h-full bg-slate-50/30 overflow-y-auto w-full p-4 sm:p-6 gap-6 relative">
      <button
        onClick={loadSampleData}
        className="absolute top-4 right-4 bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition font-medium text-xs z-10 shadow-sm"
      >
        サンプルデータを読み込む
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {/* Metric Cards */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-slate-600">
              プロジェクト進捗
            </h3>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.completionRate}%
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-slate-600">CC進捗</h3>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.ccProgress}%
            </span>
            <span className="text-sm text-slate-500 mb-1">達成</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-slate-600">完了タスク</h3>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.completedTasks}
            </span>
            <span className="text-sm text-slate-500 mb-1">
              / {metrics.totalTasks}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <PlayCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-slate-600">進行中タスク</h3>
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span className="text-3xl font-bold text-slate-800">
              {metrics.inProgressTasks}
            </span>
          </div>
        </div>
      </div>

      {/* Work Metrics Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800">全体工数状況</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              工数進捗率
            </span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-800">
                {metrics.workProgress}%
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              総見積工数
            </span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-800">
                {metrics.totalEstimateH}
              </span>
              <span className="text-sm font-medium text-slate-500 mb-1">h</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              総実績工数
            </span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-800">
                {metrics.totalActualH}
              </span>
              <span className="text-sm font-medium text-slate-500 mb-1">h</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              総残工数
            </span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-800">
                {metrics.totalRemainingH}
              </span>
              <span className="text-sm font-medium text-slate-500 mb-1">h</span>
            </div>
          </div>
        </div>
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mt-2 flex">
          <div
            className="h-full bg-indigo-500 transition-all font-bold text-[10px] text-white flex items-center justify-center leading-none"
            style={{ width: `${metrics.workProgress}%` }}
          >
            {metrics.workProgress > 5 ? `${metrics.workProgress}%` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative flex-1 min-h-[300px]">
        {/* Recent Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">
              進行中・直近のタスク
            </h3>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            <ul className="divide-y divide-slate-100">
              {tasks
                .filter(
                  (t) =>
                    t.status !== "done" &&
                    !tasks.some((p) => p.parentId === t.id) &&
                    t.type !== "project_buffer" &&
                    t.type !== "feeding_buffer",
                )
                .slice(0, 5)
                .map((task) => (
                  <li
                    key={task.id}
                    className="p-3 hover:bg-slate-50 flex justify-between items-start gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-800 leading-tight">
                          {task.name}
                        </span>
                        {task.isCritical && (
                          <span className="flex bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 items-center">
                            <Flame className="w-3 h-3 mr-0.5" /> CC
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                            task.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {task.status === "in_progress" ? "進行中" : "未着手"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100/50">
                        <div className="flex justify-between items-center">
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            予定: {task.duration}h
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">
                                累計実績:
                              </span>
                              <span className="font-mono">
                                {task.actualDuration || 0}h
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">
                                残:
                              </span>
                              <span className="font-mono text-blue-600 font-medium">
                                {task.remainingDuration !== undefined
                                  ? task.remainingDuration
                                  : Math.max(
                                      0,
                                      task.duration -
                                        (task.actualDuration || 0),
                                    )}
                                h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              {tasks.length === 0 && (
                <li className="p-6 text-center text-slate-400 text-sm">
                  タスクが存在しません
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Mini Fever Chart Idea */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">
              簡易フィーバー状況
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center justify-center relative">
            {tasks.length > 0 ? (
              <div className="w-full max-w-sm space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">
                      クリティカルチェーン進捗
                    </span>
                    <span className="font-bold">{metrics.ccProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${Math.min(100, metrics.ccProgress)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">
                      バッファ消費
                    </span>
                    <span
                      className={`font-bold ${metrics.bufferConsumption > 100 ? "text-red-600" : metrics.bufferConsumption > 66 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {metrics.bufferConsumption}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex relative">
                    <div className="absolute top-0 bottom-0 left-[33%] w-px bg-slate-300 z-10" />
                    <div className="absolute top-0 bottom-0 left-[66%] w-px bg-slate-300 z-10" />
                    <div
                      className={`h-full transition-all ${metrics.bufferConsumption > 100 ? "bg-red-500" : metrics.bufferConsumption > 66 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{
                        width: `${Math.min(100, metrics.bufferConsumption)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 text-center">
                  <p
                    className={`text-sm font-medium rounded-lg p-3 border ${
                      metrics.bufferConsumption > 100
                        ? "bg-red-50 text-red-700 border-red-200"
                        : metrics.bufferConsumption > 66
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-green-50 text-green-700 border-green-200"
                    }`}
                  >
                    現在のプロジェクトは「
                    {metrics.bufferConsumption > 100
                      ? "超過"
                      : metrics.bufferConsumption > 66
                        ? "注意"
                        : "安全"}
                    」領域にあります。
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm">
                データがありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
