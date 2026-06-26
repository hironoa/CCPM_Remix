"use client";
import { useStore } from "@/lib/store";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  ReferenceDot,
} from "recharts";

export default function FeverView() {
  const {
    tasks,
    bufferConfig,
    setBufferConfig,
    getProjectBufferHours,
    feverZones,
    setFeverZones,
    dailyLogs,
    taskStatusLogs,
  } = useStore();

  const leafTasks = tasks.filter(
    (t) => !tasks.some((p) => p.parentId === t.id),
  );
  const criticalTasks = leafTasks.filter(
    (t) => t.isCritical && t.type === "regular",
  );

  // CCPM Project Buffer is based on configured ratio (default 50%)
  const totalCriticalDuration = criticalTasks.reduce(
    (acc, t) => acc + t.duration,
    0,
  );
  const projectBuffer = getProjectBufferHours();

  // Calculate Progress and Buffer Consumption
  let completedCritical = 0;
  let delay = 0;

  leafTasks.forEach((t) => {
    if (t.isCritical && t.type === "regular") {
      completedCritical += t.duration * ((t.progress || 0) / 100);

      const actual =
        t.actualDuration !== undefined
          ? t.actualDuration
          : t.duration * ((t.progress || 0) / 100);
      const remaining =
        t.remainingDuration !== undefined
          ? t.remainingDuration
          : Math.max(0, t.duration - actual);
      const expectedTotal = actual + remaining;
      const taskDelay = expectedTotal - t.duration;

      if (taskDelay > 0) delay += taskDelay;
    }
  });

  const ccProgress =
    totalCriticalDuration > 0
      ? (completedCritical / totalCriticalDuration) * 100
      : 0;
  const bufferConsumption =
    projectBuffer > 0 ? (delay / projectBuffer) * 100 : 0;

  const getYValues = (x: number) => {
    const f = x / 100;
    const greenY =
      feverZones.startYellow +
      (feverZones.endYellow - feverZones.startYellow) * f;
    const warningY =
      feverZones.startRed + (feverZones.endRed - feverZones.startRed) * f;

    return {
      x,
      yGreen: greenY,
      yYellow: Math.max(0, warningY - greenY),
      yRed: Math.max(0, 100 - warningY),
    };
  };

  const chartData = [
    getYValues(0),
    getYValues(20),
    getYValues(50),
    getYValues(100),
  ];

  // Dynamically calculate history data per day based on historical logs
  const allDates = Array.from(
    new Set([
      ...dailyLogs.map((l) => l.date),
      ...taskStatusLogs.map((l) => l.date),
    ]),
  ).sort();

  const historyData = allDates.map((dateStr) => {
    let histCompletedCritical = 0;
    let histDelay = 0;

    leafTasks.forEach((t) => {
      if (t.isCritical && t.type === "regular") {
        const taskDailyLogs = dailyLogs.filter(
          (l) => l.taskId === t.id && l.date <= dateStr,
        );
        const actual = taskDailyLogs.reduce((acc, l) => acc + l.hours, 0);

        const pastStatusLogs = taskStatusLogs
          .filter((l) => l.taskId === t.id && l.date <= dateStr)
          .sort((a, b) => b.date.localeCompare(a.date));

        let remaining = 0;
        if (pastStatusLogs.length > 0) {
          const latestStatusDate = pastStatusLogs[0].date;
          const consumedAfterStatus = taskDailyLogs
            .filter((l) => l.date > latestStatusDate)
            .reduce((acc, l) => acc + l.hours, 0);
          remaining = Math.max(
            0,
            pastStatusLogs[0].remainingDuration - consumedAfterStatus,
          );
        } else {
          remaining = Math.max(0, t.duration - actual);
        }

        const expectedTotal = actual + remaining;
        const progressPct = expectedTotal > 0 ? actual / expectedTotal : 0;

        histCompletedCritical += t.duration * progressPct;

        const taskDelay = expectedTotal - t.duration;
        if (taskDelay > 0) histDelay += taskDelay;
      }
    });

    const histCcProgress =
      totalCriticalDuration > 0
        ? (histCompletedCritical / totalCriticalDuration) * 100
        : 0;
    const histBufferConsumption =
      projectBuffer > 0 ? (histDelay / projectBuffer) * 100 : 0;

    return {
      x: histCcProgress,
      y: histBufferConsumption,
      date: dateStr,
    };
  });

  const remainingBuffer = projectBuffer - delay;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-6 flex flex-col gap-6 h-full min-h-0">
        {/* KPI Metrics & Zone Settings */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-800">プロジェクトサマリー</h2>
            {/* Zone Settings */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">ゾーン設定:</span>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-slate-600">開始</span>
                <input
                  type="number"
                  value={feverZones.startRed}
                  onChange={(e) =>
                    setFeverZones({ startRed: Number(e.target.value) || 0 })
                  }
                  className="w-10 text-right outline-none font-mono text-slate-800 bg-transparent border-b border-transparent focus:border-slate-400 transition-colors"
                  min="0"
                />
                <span className="text-slate-500">% 完了</span>
                <input
                  type="number"
                  value={feverZones.endRed}
                  onChange={(e) =>
                    setFeverZones({ endRed: Number(e.target.value) || 0 })
                  }
                  className="w-10 text-right outline-none font-mono text-slate-800 bg-transparent border-b border-transparent focus:border-slate-400 transition-colors"
                  min="0"
                />
                <span className="text-slate-500">%</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-slate-600">開始</span>
                <input
                  type="number"
                  value={feverZones.startYellow}
                  onChange={(e) =>
                    setFeverZones({ startYellow: Number(e.target.value) || 0 })
                  }
                  className="w-10 text-right outline-none font-mono text-slate-800 bg-transparent border-b border-transparent focus:border-slate-400 transition-colors"
                  min="0"
                />
                <span className="text-slate-500">% 完了</span>
                <input
                  type="number"
                  value={feverZones.endYellow}
                  onChange={(e) =>
                    setFeverZones({ endYellow: Number(e.target.value) || 0 })
                  }
                  className="w-10 text-right outline-none font-mono text-slate-800 bg-transparent border-b border-transparent focus:border-slate-400 transition-colors"
                  min="0"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium mb-1">クリティカルチェーン進捗</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {ccProgress.toFixed(1)}<span className="text-sm font-normal text-slate-500 ml-1">%</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium mb-1">バッファ消費</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {bufferConsumption.toFixed(1)}<span className="text-sm font-normal text-slate-500 ml-1">%</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium mb-1">残バッファ / プロジェクトバッファ</div>
              <div className="text-2xl font-bold text-slate-800 font-mono flex items-baseline gap-1">
                <span className={remainingBuffer < 0 ? "text-red-600" : "text-blue-600"}>{remainingBuffer.toFixed(1)}</span>
                <span className="text-base text-slate-400">/</span>
                <span className="text-lg text-slate-600">{projectBuffer.toFixed(1)}</span>
                <span className="text-sm font-normal text-slate-500">h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="flex-1 min-h-0 bg-white border border-slate-200/60 rounded-xl shadow-sm p-4 md:p-6 flex flex-col gap-2">
          <div className="flex justify-center w-full shrink-0 ml-8">
            {/* Graph Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>安全 (Green)</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>注意 (Yellow)</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>危険 (Red)</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <span>現在位置</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-3 h-0.5 bg-slate-400"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 -ml-2.5"></div>
                <span className="ml-1">履歴</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 100]}
                label={{
                  value: "クリティカルチェーン進捗 (%)",
                  position: "bottom",
                  offset: 0,
                }}
              />
              <YAxis
                type="number"
                domain={[0, 100]}
                label={{
                  value: "バッファ消費 (%)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 5,
                  style: { textAnchor: "middle", fill: "#475569", fontSize: "14px" }
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: any, name: any, props: any) => {
                  if (name === "消費")
                    return [`${Number(value).toFixed(1)}%`, "バッファ消費"];
                  return [`${Number(value).toFixed(1)}%`, name];
                }}
                labelFormatter={(label, payload) => {
                  if (
                    payload &&
                    payload.length > 0 &&
                    payload[0].payload.date
                  ) {
                    return `進捗: ${Number(label).toFixed(1)}% (${payload[0].payload.date})`;
                  }
                  return `進捗: ${Number(label).toFixed(1)}%`;
                }}
              />

              {/* Stacked areas to form the background zones */}
              <Area
                data={chartData}
                type="monotone"
                dataKey="yGreen"
                stackId="1"
                stroke="none"
                fill="#22c55e"
                fillOpacity={0.2}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                data={chartData}
                type="monotone"
                dataKey="yYellow"
                stackId="1"
                stroke="none"
                fill="#eab308"
                fillOpacity={0.2}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                data={chartData}
                type="monotone"
                dataKey="yRed"
                stackId="1"
                stroke="none"
                fill="#ef4444"
                fillOpacity={0.2}
                activeDot={false}
                isAnimationActive={false}
              />

              {historyData.length > 0 && (
                <Scatter
                  data={historyData}
                  name="消費"
                  line={{ stroke: "#2563eb", strokeWidth: 2 }}
                  shape="circle"
                  fill="#2563eb"
                />
              )}

              <ReferenceDot
                x={ccProgress}
                y={bufferConsumption}
                r={6}
                fill="#eab308"
                stroke="#ffffff"
                strokeWidth={2}
              />
              <ReferenceDot
                x={ccProgress}
                y={bufferConsumption}
                r={12}
                fill="#eab308"
                fillOpacity={0.3}
                stroke="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
  );
}
