"use client";
import { useState, useRef, useEffect } from "react";
import { Task, DailyLog } from "@/lib/store";

const HOURS_START = 8;
const HOURS_TOTAL = 16; // 08:00 to 24:00

function TimelineTaskBlock({
  log,
  otherLogs,
  updateDailyLogById,
  removeDailyLogById,
  containerRef,
}: {
  log: DailyLog;
  otherLogs: DailyLog[];
  updateDailyLogById: (logId: string, hours: number, startTime: number) => void;
  removeDailyLogById: (logId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [localStart, setLocalStart] = useState<number>(
    log.startTime !== undefined ? log.startTime : HOURS_START,
  );
  const [localHours, setLocalHours] = useState<number>(log.hours || 0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setLocalStart(log.startTime !== undefined ? log.startTime : HOURS_START);
    setLocalHours(log.hours || 0);
  }, [log]);

  const snapToQuarterHour = (val: number) => Math.round(val * 4) / 4;

  const handlePointerDown = (
    type: "left" | "right" | "move",
    e: React.PointerEvent,
  ) => {
    if (localHours === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const initialStart = localStart;
    const initialHours = localHours;

    const onPointerMove = (ev: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pxPerHour = rect.width / HOURS_TOTAL;
      const deltaPx = ev.clientX - startX;
      const deltaHrs = snapToQuarterHour(deltaPx / pxPerHour);

      if (type === "left") {
        const newStart = Math.max(
          HOURS_START,
          Math.min(initialStart + initialHours - 0.25, initialStart + deltaHrs),
        );
        const newHours = initialHours - (newStart - initialStart);
        setLocalStart(newStart);
        setLocalHours(Math.max(0.25, newHours));
      } else if (type === "right") {
        const newHours = Math.max(
          0.25,
          Math.min(
            HOURS_START + HOURS_TOTAL - initialStart,
            initialHours + deltaHrs,
          ),
        );
        setLocalHours(newHours);
      } else if (type === "move") {
        let newStart = initialStart + deltaHrs;
        newStart = Math.max(
          HOURS_START,
          Math.min(HOURS_START + HOURS_TOTAL - initialHours, newStart),
        );
        setLocalStart(newStart);
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
      if (log.startTime !== localStart || log.hours !== localHours) {
        if (localHours !== log.hours || localStart !== log.startTime) {
          updateDailyLogById(log.id, localHours, localStart);
        }
      }
    };
    window.addEventListener("pointerup", onGlobalUp);
    return () => window.removeEventListener("pointerup", onGlobalUp);
  }, [localStart, localHours, updateDailyLogById, log]);

  if (localHours <= 0) return null;

  const isConflicting = otherLogs.some(
    (o) =>
      Math.max(
        0,
        Math.min(
          localStart + localHours,
          (o.startTime || HOURS_START) + o.hours,
        ) - Math.max(localStart, o.startTime || HOURS_START),
      ) > 0,
  );

  const blockColor = isConflicting
    ? "bg-red-500 border-red-600 hover:bg-red-400"
    : "bg-blue-500 border-blue-600 hover:bg-blue-400";

  return (
    <div
      className={`absolute top-1 bottom-1 rounded shadow-sm border flex items-center justify-between overflow-visible z-10 transition-colors ${blockColor}`}
      style={{
        left: `${((localStart - HOURS_START) / HOURS_TOTAL) * 100}%`,
        width: `${(localHours / HOURS_TOTAL) * 100}%`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="w-3 h-full cursor-col-resize flex items-center justify-center shrink-0 z-20 group/handle"
        onPointerDown={(e) => handlePointerDown("left", e)}
      >
        <div className="w-0.5 h-4 bg-white/50 group-hover/handle:bg-white rounded-full transition-colors" />
      </div>

      <div
        className="flex-1 h-full flex items-center justify-center text-white text-xs font-bold font-mono cursor-move z-10 select-none pb-0.5"
        onPointerDown={(e) => handlePointerDown("move", e)}
      >
        {localHours}h
      </div>

      <div
        className="w-3 h-full cursor-col-resize flex items-center justify-center shrink-0 z-20 group/handle"
        onPointerDown={(e) => handlePointerDown("right", e)}
      >
        <div className="w-0.5 h-4 bg-white/50 group-hover/handle:bg-white rounded-full transition-colors" />
      </div>

      {isHovered && (
        <button
          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] z-30 opacity-80 hover:opacity-100 shadow-md"
          onPointerDown={(e) => {
            e.stopPropagation();
            removeDailyLogById(log.id);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function TimelineTaskRow({
  task,
  logs,
  otherLogs = [],
  taskStatusLogs = [],
  allDailyLogs = [],
  selectedDate,
  addDailyLog,
  updateDailyLogById,
  removeDailyLogById,
  updateTask,
  resourceId,
}: {
  task: Task;
  logs: DailyLog[];
  otherLogs?: DailyLog[];
  taskStatusLogs?: any[];
  allDailyLogs?: DailyLog[];
  selectedDate: string;
  addDailyLog: (
    taskId: string,
    date: string,
    hours: number,
    startTime: number,
    resourceId?: string,
  ) => void;
  updateDailyLogById: (logId: string, hours: number, startTime: number) => void;
  removeDailyLogById: (logId: string) => void;
  updateTask: (
    id: string,
    updates: Partial<Task> & { asOfDate?: string },
  ) => void;
  resourceId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [creationPreview, setCreationPreview] = useState<{ start: number; hours: number } | null>(null);

  const snapToQuarterHour = (val: number) => Math.round(val * 4) / 4;

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    
    // ignore if clicked on empty space that is not the track itself
    if (e.button !== 0) return; // only left click

    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const pxPerHour = rect.width / HOURS_TOTAL;
    const startPx = e.clientX - rect.left;
    const clickedHour = snapToQuarterHour(startPx / pxPerHour);

    const startAbsHour = Math.max(
      HOURS_START,
      Math.min(HOURS_START + HOURS_TOTAL - 0.25, HOURS_START + clickedHour),
    );

    setCreationPreview({ start: startAbsHour, hours: 0.25 });

    let currentPreview = { start: startAbsHour, hours: 0.25 };
    let hasMoved = false;

    const onPointerMove = (ev: PointerEvent) => {
      hasMoved = true;
      const currentPx = ev.clientX - rect.left;
      const currentHour = snapToQuarterHour(currentPx / pxPerHour);
      const endAbsHour = Math.max(
        HOURS_START,
        Math.min(HOURS_START + HOURS_TOTAL, HOURS_START + currentHour),
      );

      let newStart = startAbsHour;
      let newHours = endAbsHour - startAbsHour;

      if (newHours < 0) {
        newStart = endAbsHour;
        newHours = startAbsHour - endAbsHour;
      }

      newHours = Math.max(0.25, newHours);
      currentPreview = { start: newStart, hours: newHours };
      setCreationPreview(currentPreview);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      let finalStart = currentPreview.start;
      let finalHours = currentPreview.hours;

      if (!hasMoved) {
        finalHours = 1;
        finalStart = Math.max(
          HOURS_START,
          Math.min(HOURS_START + HOURS_TOTAL - 1, startAbsHour),
        );
      }

      addDailyLog(
        task.id,
        selectedDate,
        finalHours,
        finalStart,
        resourceId,
      );
      setCreationPreview(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const totalHoursForDay = logs.reduce((acc, log) => acc + log.hours, 0);

  const remaining = (() => {
    const historicalLogs = taskStatusLogs
      .filter((l) => l.taskId === task.id && l.date <= selectedDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestStatusDate =
      historicalLogs.length > 0 ? historicalLogs[0].date : null;

    const allRelevantLogs = allDailyLogs.filter(
      (l) => l.taskId === task.id && l.date <= selectedDate,
    );

    if (latestStatusDate) {
      const baseRem = historicalLogs[0].remainingDuration;
      const laterLogs = allRelevantLogs.filter(
        (l) => l.date > latestStatusDate,
      );
      const consumedAfterStatus = laterLogs.reduce(
        (sum, l) => sum + l.hours,
        0,
      );
      return Math.max(0, baseRem - consumedAfterStatus);
    } else {
      const actual = allRelevantLogs.reduce((sum, l) => sum + l.hours, 0);
      return Math.max(0, task.duration - actual);
    }
  })();

  return (
    <div className="flex items-center py-2 border-b border-slate-200 group">
      <div className="w-64 shrink-0 px-4">
        <div
          className="font-medium text-sm text-slate-800 leading-tight truncate"
          title={task.name}
        >
          {task.name}
        </div>
        <div className="flex gap-2 items-center mt-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium leading-none ${
              task.status === "in_progress"
                ? "bg-blue-100 text-blue-700"
                : task.status === "done"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {" "}
            {task.status === "in_progress"
              ? "進行中"
              : task.status === "done"
                ? "完了"
                : "未着手"}{" "}
          </span>
          <div className="text-[10px] font-mono text-slate-500">
            見積: <span className="font-bold">{task.duration}</span>h / 実績:{" "}
            {task.actualDuration || 0}h
          </div>
        </div>
      </div>

      <div
        className="flex-1 h-10 relative rounded-md cursor-pointer border border-slate-200/50 bg-slate-50 hover:bg-slate-100 transition-colors"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, transparent, transparent calc(${100 / HOURS_TOTAL}% - 1px), #edf2f7 calc(${100 / HOURS_TOTAL}% - 1px), #edf2f7 ${100 / HOURS_TOTAL}%)`,
        }}
        ref={containerRef}
        onPointerDown={handleTrackPointerDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="absolute top-0 bottom-0 left-0 right-0 flex pointer-events-none">
          {Array.from({ length: HOURS_TOTAL }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-slate-200/50">
              <span className="text-[9px] text-slate-400 pl-1 select-none">
                {i + HOURS_START}:00
              </span>
            </div>
          ))}
        </div>

        {creationPreview && (
          <div
            className="absolute top-1 bottom-1 rounded shadow-sm border flex items-center justify-center bg-blue-500/50 border-blue-600/50 overflow-visible z-20 pointer-events-none"
            style={{
              left: `${((creationPreview.start - HOURS_START) / HOURS_TOTAL) * 100}%`,
              width: `${(creationPreview.hours / HOURS_TOTAL) * 100}%`,
            }}
          >
            <div className="text-white text-xs font-bold font-mono pb-0.5">
              {creationPreview.hours}h
            </div>
          </div>
        )}

        {/* Other task logs background indicators */}
        {otherLogs.map((oLog) => (
          <div
            key={oLog.id}
            className="absolute top-1 bottom-1 bg-slate-200/70 border-x border-slate-300 rounded pointer-events-none"
            style={{
              left: `${(((oLog.startTime || HOURS_START) - HOURS_START) / HOURS_TOTAL) * 100}%`,
              width: `${(oLog.hours / HOURS_TOTAL) * 100}%`,
            }}
          />
        ))}

        {logs.map((log) => (
          <TimelineTaskBlock
            key={log.id}
            log={log}
            otherLogs={otherLogs}
            updateDailyLogById={updateDailyLogById}
            removeDailyLogById={removeDailyLogById}
            containerRef={containerRef}
          />
        ))}
      </div>

      <div className="w-48 shrink-0 flex items-center justify-end px-4 gap-4">
        <div className="text-right">
          <div className="text-[10px] text-slate-400 mb-0.5 font-normal leading-none">
            本日合計
          </div>
          <div className="font-mono text-sm leading-none">
            {totalHoursForDay > 0 ? (
              <span className="text-blue-600 font-bold">
                {totalHoursForDay}h
              </span>
            ) : (
              <span className="text-slate-300">0h</span>
            )}
          </div>
        </div>

        <div className="text-right bg-slate-50/50 p-1.5 rounded-lg border border-slate-100">
          <div className="text-[10px] text-slate-400 mb-1 font-normal leading-none text-center">
            現在残(h)
          </div>
          <input
            type="number"
            min={0}
            step={0.25}
            value={remaining}
            placeholder="0"
            onChange={(e) => {
              const valStr = e.target.value;
              const valNum = Number(valStr) || 0;
              updateTask(task.id, {
                remainingDuration: valStr === "" ? 0 : valNum,
                asOfDate: selectedDate,
              });
            }}
            className="w-16 border border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 bg-white text-blue-700 rounded px-1 py-0.5 font-mono font-medium text-center text-sm transition-all outline-none"
          />
        </div>
      </div>
    </div>
  );
}
