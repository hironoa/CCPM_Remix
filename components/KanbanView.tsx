"use client";
import { useStore, TaskStatus, Task } from "@/lib/store";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Flame } from "lucide-react";

const statuses: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "未着手", color: "bg-slate-100 border-slate-200" },
  { id: "in_progress", title: "進行中", color: "bg-blue-50 border-blue-200" },
  { id: "done", title: "完了", color: "bg-green-50 border-green-200" },
];

function TaskCard({
  task,
  parentTaskName,
  isOverlay,
}: {
  task: Task;
  parentTaskName?: string;
  isOverlay?: boolean;
}) {
  const estimatedRemaining =
    task.remainingDuration !== undefined
      ? task.remainingDuration
      : Math.max(0, task.duration - (task.actualDuration || 0));

  return (
    <div
      className={`p-3 bg-white border border-slate-200 rounded-lg shadow-sm mb-3 group relative ${task.isCritical ? "border-l-4 border-l-red-500" : "border-l-4 border-l-blue-500"} ${isOverlay ? "scale-105 shadow-xl rotate-2 cursor-grabbing" : "hover:border-blue-400 cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex flex-col items-start gap-1.5 mb-2">
        {task.isCritical && (
          <span className="flex items-center bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0">
            <Flame className="w-3 h-3 mr-0.5" /> CC
          </span>
        )}
        {parentTaskName && (
          <div className="text-[10px] text-slate-400 truncate w-full">
            {parentTaskName}
          </div>
        )}
        <div className="font-medium text-sm text-slate-800 leading-tight">
          {task.name}
        </div>
      </div>

      <div className="flex flex-col mt-3 pt-3 border-t border-slate-100 gap-2">
        <div className="flex justify-between items-center">
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">実績:</span>
              <span className="font-mono text-slate-700">
                {task.actualDuration || 0}h
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">残:</span>
              <span className="font-mono text-blue-600 font-medium">
                {estimatedRemaining}h
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
              予定: {task.duration}h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableTask({
  task,
  parentTaskName,
}: {
  task: Task;
  parentTaskName?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none" as React.CSSProperties["touchAction"],
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} parentTaskName={parentTaskName} />
    </div>
  );
}

function Column({
  status,
  tasks,
}: {
  status: (typeof statuses)[0];
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const allTasks = useStore((state) => state.tasks);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-80 shrink-0 rounded-xl border ${status.color} ${isOver ? "ring-2 ring-blue-400 ring-inset" : ""}`}
    >
      <div className="p-4 font-bold border-b border-inherit text-slate-700 flex justify-between items-center bg-white/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${status.id === "todo" ? "bg-slate-400" : status.id === "in_progress" ? "bg-blue-500" : "bg-green-500"}`}
          />
          {status.title}
        </div>
        <span className="bg-white/60 px-2 py-0.5 rounded-full text-xs text-slate-500 font-mono shadow-sm">
          {tasks.length}
        </span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto min-h-[150px]">
        <SortableContext
          id={status.id}
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => {
            const parent = task.parentId
              ? allTasks.find((t) => t.id === task.parentId)
              : undefined;
            return (
              <SortableTask
                key={task.id}
                task={task}
                parentTaskName={parent?.name}
              />
            );
          })}
          {tasks.length === 0 && (
            <div className="h-full min-h-[100px] border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-sm opacity-50">
              ドロップして移動
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanView() {
  const { tasks, updateTask } = useStore();

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const getTasksByStatus = (statusId: TaskStatus) => {
    // Only show leaf tasks (no children) in Kanban for simplicity, or all if we want
    const parentTaskIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    return tasks.filter(
      (t) =>
        t.status === statusId &&
        !parentTaskIds.has(t.id) &&
        t.type !== "project_buffer" &&
        t.type !== "feeding_buffer",
    );
  };

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: any) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if moving to a specific column container directly
    const statusOver = statuses.find((s) => s.id === overId)?.id;
    if (statusOver) {
      if (activeTask.status !== statusOver) {
        updateTask(activeId, { status: statusOver });
      }
      return;
    }

    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      if (activeTask.status !== overTask.status) {
        updateTask(activeId, { status: overTask.status });
      }
      // Always call reorder to update the array position
      useStore.getState().reorderTasks(activeId, overId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none relative">
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 bg-slate-50/30">
        <div className="flex gap-6 h-full items-start">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {statuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              tasks={getTasksByStatus(status.id)}
            />
          ))}
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
        </div>
      </div>
    </div>
  );
}
