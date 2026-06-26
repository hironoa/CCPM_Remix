"use client";
import { useStore, Task, Resource } from "@/lib/store";
import { Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

const TaskCard = ({ task, isOverlay }: { task: Task; isOverlay?: boolean }) => (
  <div
    className={`bg-white border text-left border-slate-200 rounded-lg p-3 shadow-sm hover:border-slate-300 transition-colors cursor-grab active:cursor-grabbing ${isOverlay ? "shadow-lg scale-105 rotate-2" : "hover:shadow-md"}`}
  >
    <div className="flex flex-col items-start gap-1.5 mb-2">
      {task.isCritical && task.status !== "done" && (
        <span className="flex shrink-0 text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[10px] items-center font-bold uppercase">
          <Flame className="w-3 h-3 mr-1" /> CC
        </span>
      )}
      <h4 className="font-semibold text-sm text-slate-800 break-words leading-tight">
        {task.name}
      </h4>
    </div>

    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
          予定: {task.duration}h
        </span>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[10px]">実績:</span>
            <span className="font-mono text-slate-700">
              {task.actualDuration || 0}h
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[10px]">残:</span>
            <span className="font-mono text-blue-600 font-medium">
              {task.remainingDuration !== undefined
                ? task.remainingDuration
                : Math.max(0, task.duration - (task.actualDuration || 0))}
              h
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DraggableTask = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none" as const,
      }
    : { touchAction: "none" as const };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
};

const DroppableCell = ({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver
          ? "bg-blue-50 ring-2 ring-blue-500 ring-inset shadow-md"
          : ""
      }`}
    >
      {isOver && (
        <div className="absolute inset-0 bg-blue-500/10 z-10 pointer-events-none rounded-[inherit]" />
      )}
      {children}
    </div>
  );
};

export default function DailyScrumView() {
  const { tasks, resources, updateTask } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const swimlanes = useMemo(() => {
    return resources.map((r) => ({
      resource: r,
      tasks: tasks.filter(
        (t) =>
          t.resourceId === r.id &&
          t.type !== "project_buffer" &&
          t.type !== "feeding_buffer" &&
          !tasks.some((p) => p.parentId === t.id),
      ),
    }));
  }, [tasks, resources]);

  const unassignedTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        !t.resourceId &&
        (!t.type ||
          (t.type !== "project_buffer" && t.type !== "feeding_buffer")) &&
        !tasks.some((p) => p.parentId === t.id),
    );
  }, [tasks]);

  const handleDragStart = (e: any) => {
    const { active } = e;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (e: any) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const overId = over.id as string; // backlog-todo, or swimlane-{resourceId}-{status}
    const taskId = active.id as string;

    if (overId === "backlog-todo") {
      updateTask(taskId, {
        status: "todo",
        resourceId: undefined, // ensure it's removed from resource
        progress: 0,
      });
    } else if (overId.startsWith("swimlane-")) {
      const parts = overId.replace("swimlane-", "").split("-");
      // since resourceId might have hyphens, we pop the last element which is the status
      const status = parts.pop() as "todo" | "in_progress" | "done";
      const resourceId = parts.join("-");

      updateTask(taskId, {
        status,
        resourceId,
        progress: status === "done" ? 100 : status === "todo" ? 0 : 50,
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-hidden flex gap-6 bg-slate-50/30 p-4 sm:p-6">
          {/* Unassigned Backlog (Left Pane) */}
          <div
            className={`bg-slate-100 border border-slate-200 rounded-lg flex flex-col shrink-0 shadow-inner transition-[width,transform] duration-300 ease-in-out relative ${isBacklogCollapsed ? "w-12" : "w-64"}`}
          >
            {/* Header */}
            <div className="h-12 border-b border-slate-200 bg-slate-50 flex items-center z-10 shrink-0 shadow-sm relative overflow-hidden">
              <div
                className={`flex items-center absolute left-3 transition-opacity duration-300 whitespace-nowrap ${isBacklogCollapsed ? "opacity-0" : "opacity-100"}`}
              >
                <span className="font-bold text-slate-700 text-sm">
                  未割り当て
                </span>
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-1.5">
                  {unassignedTasks.length}
                </span>
              </div>
              <button
                onClick={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
                className={`absolute p-1.5 hover:bg-slate-200 rounded text-slate-500 flex items-center justify-center transition-all duration-300 ${isBacklogCollapsed ? "left-1/2 -translate-x-1/2" : "right-1"}`}
                title={isBacklogCollapsed ? "展開する" : "閉じる"}
              >
                {isBacklogCollapsed ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <ChevronLeft className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Vertical layout when collapsed */}
            <div
              className={`absolute top-12 left-0 right-0 bottom-0 py-4 flex flex-col items-center cursor-pointer hover:bg-slate-200/50 transition-all duration-300 ${isBacklogCollapsed ? "opacity-100 z-10" : "opacity-0 pointer-events-none -translate-x-4"}`}
              onClick={() => setIsBacklogCollapsed(false)}
            >
              <div className="flex flex-col gap-1 items-center text-slate-500 font-bold text-xs mb-4">
                <span>未</span>
                <span>割</span>
                <span>り</span>
                <span>当</span>
                <span>て</span>
              </div>
              <span className="bg-white border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                {unassignedTasks.length}
              </span>
            </div>

            {/* Droppable Area when expanded */}
            <div
              className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${isBacklogCollapsed ? "opacity-0 pointer-events-none translate-x-4" : "opacity-100"}`}
            >
              <DroppableCell
                id="backlog-todo"
                className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-2 relative bg-slate-100/50"
              >
                {/* Fixed width inner container to prevent reflow while animating width */}
                <div className="w-[238px]">
                  {unassignedTasks.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 text-sm">
                      なし
                    </div>
                  ) : (
                    unassignedTasks.map((t) => (
                      <DraggableTask key={t.id} task={t} />
                    ))
                  )}
                </div>
              </DroppableCell>
            </div>
          </div>

          {/* User Swimlanes (Right Pane) */}
          <div className="flex-1 overflow-hidden bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col min-w-0">
            <div className="grid grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 border-b border-slate-200 sticky top-0 z-10 font-bold text-slate-700 text-sm shadow-sm">
              <div className="p-4 border-r border-slate-200">担当者</div>
              <div className="p-4 border-r border-slate-200">To Do (未着手)</div>
              <div className="p-4 border-r border-slate-200">
                In Progress (進行中)
              </div>
              <div className="p-4">Done (完了)</div>
            </div>

            <div className="overflow-y-auto flex-1 h-0 flex flex-col">
              {swimlanes.map(({ resource, tasks: userTasks }) => (
                <div
                  key={resource.id}
                  className="grid grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] border-b-2 border-slate-200 group min-h-[80px] shrink-0"
                >
                  <div className="p-4 border-r-2 border-slate-200 bg-slate-50/50 flex flex-col justify-center shrink-0">
                    <div className="font-semibold text-slate-800">
                      {resource.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {resource.role}
                    </div>
                  </div>

                  {(["todo", "in_progress", "done"] as const).map((status) => {
                    const columnTasks = userTasks.filter(
                      (t) => t.status === status,
                    );
                    return (
                      <DroppableCell
                        key={status}
                        id={`swimlane-${resource.id}-${status}`}
                        className="p-3 border-r border-slate-200 last:border-r-0 bg-white hover:bg-blue-50/10 transition-colors flex flex-col gap-2 relative min-h-full"
                      >
                        {columnTasks.map((t) => (
                          <DraggableTask key={t.id} task={t} />
                        ))}
                        {columnTasks.length === 0 && (
                          <div className="absolute inset-2 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400/50 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            ここにドロップ
                          </div>
                        )}
                      </DroppableCell>
                    );
                  })}
                </div>
              ))}
              {swimlanes.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
                  担当者が登録されていません。リソースビューで追加してください。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
