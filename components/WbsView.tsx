"use client";
import { useStore, Task } from "@/lib/store";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ListPlus,
  Indent,
  Outdent,
  GripVertical,
  Columns,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";

const formatDate = (date?: Date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatEndDate = (date?: Date) => {
  if (!date) return "";
  const d = new Date(date);
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateString = (val: string) => {
  if (!val) return undefined;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseEndDateString = (val: string) => {
  if (!val) return undefined;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
};

type ColumnId =
  | "name"
  | "duration"
  | "actualDuration"
  | "remainingDuration"
  | "assignee"
  | "predecessors"
  | "startDate"
  | "endDate"
  | "progress"
  | "status"
  | "actions";

interface ColumnDef {
  id: ColumnId;
  label: string;
  width: number;
  visible: boolean;
}

const defaultColumns: ColumnDef[] = [
  { id: "name", label: "タスク名", width: 260, visible: true },
  { id: "duration", label: "見積(h)", width: 70, visible: true },
  { id: "actualDuration", label: "実績(h)", width: 70, visible: true },
  { id: "remainingDuration", label: "残(h)", width: 70, visible: true },
  { id: "predecessors", label: "先行タスク", width: 100, visible: true },
  { id: "assignee", label: "担当", width: 90, visible: true },
  { id: "startDate", label: "開始日", width: 110, visible: true },
  { id: "endDate", label: "終了日", width: 110, visible: true },
  { id: "progress", label: "進捗", width: 120, visible: true },
  { id: "status", label: "状態", width: 80, visible: true },
  { id: "actions", label: "操作", width: 100, visible: true },
];

export default function WbsView() {
  const { tasks, resources, addTask, addTasks, updateTask, deleteTask } =
    useStore();
  const [newTaskName, setNewTaskName] = useState("");
  const [targetParentId, setTargetParentId] = useState<string | undefined>(
    undefined,
  );

  const [columns, setColumns] = useState<ColumnDef[]>(defaultColumns);
  const [showColSettings, setShowColSettings] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutsideColMenu = (e: MouseEvent) => {
      if (
        colMenuRef.current &&
        !colMenuRef.current.contains(e.target as Node)
      ) {
        setShowColSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideColMenu);
    return () => document.removeEventListener("mousedown", handleClickOutsideColMenu);
  }, []);

  // Calculate WBS numbers for all tasks
  const wbsNumbers = useMemo(() => {
    const numbers = new Map<string, string>();
    const getChildren = (parentId: string | undefined) =>
      tasks.filter(
        (t) =>
          t.parentId === parentId &&
          t.type !== "project_buffer" &&
          t.type !== "feeding_buffer",
      );

    const traverse = (parentId: string | undefined, prefix: string) => {
      const children = getChildren(parentId);
      children.forEach((child, index) => {
        const num = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        numbers.set(child.id, num);
        traverse(child.id, num);
      });
    };
    traverse(undefined, "");
    return numbers;
  }, [tasks]);

  const taskIdByWbsNo = useMemo(() => {
    const map = new Map<string, string>();
    wbsNumbers.forEach((wbs, id) => map.set(wbs, id));
    return map;
  }, [wbsNumbers]);

  // Column Resizing State
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const [resizingStartX, setResizingStartX] = useState(0);
  const [resizingStartWidth, setResizingStartWidth] = useState(0);

  const handleColResizeStart = (
    e: React.MouseEvent,
    colId: string,
    currentWidth: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColId(colId);
    setResizingStartX(e.clientX);
    setResizingStartWidth(currentWidth);
  };

  React.useEffect(() => {
    if (resizingColId) {
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const delta = e.clientX - resizingStartX;
        setColumns((prev) =>
          prev.map((c) =>
            c.id === resizingColId
              ? { ...c, width: Math.max(50, resizingStartWidth + delta) }
              : c,
          ),
        );
      };
      const handleMouseUp = () => setResizingColId(null);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [resizingColId, resizingStartX, resizingStartWidth]);

  // Column Drag and Drop State
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDragOverColId(colId), 0);
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    if (!draggedColId) return;
    e.preventDefault();
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleColDrop = (e: React.DragEvent, dropColId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    if (!draggedColId || draggedColId === dropColId) {
      setDraggedColId(null);
      return;
    }
    const newCols = [...columns];
    const fromIndex = newCols.findIndex((c) => c.id === draggedColId);
    const toIndex = newCols.findIndex((c) => c.id === dropColId);
    if (fromIndex >= 0 && toIndex >= 0) {
      const [removed] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, removed);
      setColumns(newCols);
    }
    setDraggedColId(null);
  };

  const handleColDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === columns.length - 1)
    )
      return;
    const newCols = [...columns];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newCols[index], newCols[targetIndex]] = [
      newCols[targetIndex],
      newCols[index],
    ];
    setColumns(newCols);
  };

  // Determine sticky column positions
  const stickyColumns = useMemo(() => {
    const visibleCols = columns.filter((c) => c.visible);
    const nameIndex = visibleCols.findIndex((c) => c.id === "name");
    
    let currentLeft = 48; // No. column width
    const styles = new Map<string, { isSticky: boolean; left: number }>();
    
    visibleCols.forEach((col, index) => {
      const isSticky = index <= nameIndex;
      styles.set(col.id, { isSticky, left: currentLeft });
      if (isSticky) {
        currentLeft += col.width - 1; // overlap by 1px to prevent sub-pixel gaps
      }
    });
    
    return styles;
  }, [columns]);

  // Excel-like selection state
  const [selectionStart, setSelectionStart] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{
    r: number;
    c: number;
  } | null>(null);

  const activeRect = useMemo(() => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      top: Math.min(selectionStart.r, selectionEnd.r),
      bottom: Math.max(selectionStart.r, selectionEnd.r),
      left: Math.min(selectionStart.c, selectionEnd.c),
      right: Math.max(selectionStart.c, selectionEnd.c),
    };
  }, [selectionStart, selectionEnd]);

  useEffect(() => {
    const handleMouseUp = () => {
      /* keep selection */
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".wbs-table-container")) {
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    };
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    const target = e.target as HTMLElement;
    if (target.closest("[draggable]")) {
      return;
    }
    if (
      target.tagName !== "INPUT" &&
      target.tagName !== "SELECT" &&
      e.detail === 1
    ) {
      e.preventDefault();
    }
    if (e.shiftKey) {
      if (!selectionStart) setSelectionStart({ r, c });
      setSelectionEnd({ r, c });
    } else {
      setSelectionStart({ r, c });
      setSelectionEnd({ r, c });
    }
  };

  const handleCellMouseEnter = (e: React.MouseEvent, r: number, c: number) => {
    if (e.buttons === 1 && selectionStart) {
      e.preventDefault();
      setSelectionEnd({ r, c });
    }
  };

  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<
    "before" | "after" | "inside" | null
  >(null);

  const handleDragStart = (
    e: React.DragEvent<HTMLElement>,
    id: string,
    rowIndex: number,
  ) => {
    let idsToDrag = [id];

    if (
      activeRect &&
      rowIndex >= activeRect.top &&
      rowIndex <= activeRect.bottom
    ) {
      const selectedIds = [];
      for (let r = activeRect.top; r <= activeRect.bottom; r++) {
        const t = visibleTasks[r];
        if (t) selectedIds.push(t.task.id);
      }
      if (selectedIds.includes(id)) {
        idsToDrag = selectedIds;
      }
    }

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "task", ids: idsToDrag }),
    );
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDraggingIds(idsToDrag), 0);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLTableRowElement>,
    id: string,
  ) => {
    e.preventDefault();
    if (draggingIds.length === 0 || draggingIds.includes(id)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    let pos: "before" | "after" | "inside" = "inside";
    if (y < rect.height * 0.25) pos = "before";
    else if (y > rect.height * 0.75) pos = "after";

    // Check if target is an expanded parent
    const state = useStore.getState();
    const targetTask = state.tasks.find((t) => t.id === id);
    const hasChildren = state.tasks.some((t) => t.parentId === id);
    if (targetTask?.isExpanded && hasChildren && pos === "after") {
      pos = "inside";
    }

    if (dragOverId !== id || dropPosition !== pos) {
      setDragOverId(id);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    e.preventDefault();
    setDragOverId(null);
    setDropPosition(null);

    if (draggingIds.length === 0 || draggingIds.includes(id) || !dropPosition) {
      setDraggingIds([]);
      return;
    }

    if (draggingIds.length === 1) {
      useStore.getState().reorderTask(draggingIds[0], id, dropPosition);
    } else {
      useStore.getState().reorderTasksMulti(draggingIds, id, dropPosition);
    }
    setDraggingIds([]);
  };

  const handleDragEnd = () => {
    setDraggingIds([]);
    setDragOverId(null);
    setDropPosition(null);
  };

  // Flatten the tree for excel-like indexing
  const visibleTasks = useMemo(() => {
    const result: { task: Task; depth: number; index: number }[] = [];
    let counter = 0;

    const traverse = (parentId: string | undefined, depth: number) => {
      const children = tasks.filter(
        (t) =>
          t.parentId === parentId &&
          t.type !== "project_buffer" &&
          t.type !== "feeding_buffer",
      );
      for (const child of children) {
        result.push({ task: child, depth, index: counter++ });
        if (child.isExpanded) {
          traverse(child.id, depth + 1);
        }
      }
    };
    traverse(undefined, 0);
    return result;
  }, [tasks]);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<Task>) => {
      updateTask(id, updates);
    },
    [updateTask],
  );

  const handleIndent = (task: Task) => {
    const siblings = tasks.filter((t) => t.parentId === task.parentId);
    const myIndex = siblings.findIndex((t) => t.id === task.id);
    if (myIndex > 0) {
      const prevSibling = siblings[myIndex - 1];
      updateTask(task.id, { parentId: prevSibling.id });
      updateTask(prevSibling.id, { isExpanded: true });
    }
  };

  const handleOutdent = (task: Task) => {
    if (task.parentId) {
      const parent = tasks.find((t) => t.id === task.parentId);
      if (parent) {
        updateTask(task.id, { parentId: parent.parentId });
      }
    }
  };

  const [editingCell, setEditingCell] = useState<{
    r: number;
    c: number;
  } | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    const closest = target.closest("[data-row][data-col]") as HTMLElement;
    if (!closest) return;
    const rowStr = closest.dataset.row;
    const colStr = closest.dataset.col;
    if (!rowStr || !colStr) return;

    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    const isEditing = editingCell?.r === row && editingCell?.c === col;

    if (isEditing) {
      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        setEditingCell(null);
        const nextRow = row + 1;
        setSelectionStart({ r: nextRow, c: col });
        setSelectionEnd({ r: nextRow, c: col });
        setTimeout(() => {
          const nextEl = document.querySelector(
            `[data-row="${nextRow}"][data-col="${col}"]`,
          ) as HTMLElement;
          if (nextEl) {
            nextEl.focus({ preventScroll: true });
            const scrollContainer = nextEl.closest(
              ".overflow-auto",
            ) as HTMLElement;
            if (scrollContainer) {
              const rect = nextEl.getBoundingClientRect();
              const containerRect = scrollContainer.getBoundingClientRect();
              const headerHeight = 50;
              const footerHeight = 50;
              if (rect.top < containerRect.top + headerHeight) {
                scrollContainer.scrollTop -=
                  containerRect.top + headerHeight - rect.top;
              } else if (rect.bottom > containerRect.bottom - footerHeight) {
                scrollContainer.scrollTop +=
                  rect.bottom - (containerRect.bottom - footerHeight);
              }
            }
          }
        }, 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
        setTimeout(() => {
          const el = document.querySelector(
            `[data-row="${row}"][data-col="${col}"]`,
          ) as HTMLElement;
          if (el) el.focus();
        }, 0);
      }
      return;
    }

    let nextRow = row;
    let nextCol = col;
    let handled = false;

    if (e.key === "ArrowDown") {
      nextRow = row + 1;
      handled = true;
    } else if (e.key === "ArrowUp") {
      nextRow = Math.max(0, row - 1);
      handled = true;
    } else if (e.key === "ArrowRight") {
      nextCol = col + 1;
      handled = true;
    } else if (e.key === "ArrowLeft") {
      nextCol = Math.max(0, col - 1);
      handled = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const visibleCols = columns.filter((c) => c.visible);
      const taskObj = visibleTasks[row]?.task;
      const isParentRow = taskObj
        ? tasks.some((t) => t.parentId === taskObj.id)
        : false;
      const colId = visibleCols[col]?.id;
      if (colId !== "actualDuration" && (!isParentRow || colId === "name")) {
        setEditingCell({ r: row, c: col });
      }
      return;
    } else if (e.key === "Tab") {
      if (e.shiftKey) {
        nextCol = Math.max(0, col - 1);
      } else {
        nextCol = col + 1;
      }
      handled = true;
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const visibleCols = columns.filter((c) => c.visible);
      const taskObj = visibleTasks[row]?.task;
      const isParentRow = taskObj
        ? tasks.some((t) => t.parentId === taskObj.id)
        : false;
      const colId = visibleCols[col]?.id;
      if (colId !== "actualDuration" && (!isParentRow || colId === "name")) {
        setEditingCell({ r: row, c: col });
      }
      return; // allow the keydown to propagate and perhaps type the character (may require deeper wiring, but mostly works)
    }

    if (handled) {
      e.preventDefault();
      if (e.shiftKey && e.key.startsWith("Arrow")) {
        setSelectionEnd({ r: nextRow, c: nextCol });
        if (!selectionStart) setSelectionStart({ r: row, c: col });
      } else {
        setSelectionStart({ r: nextRow, c: nextCol });
        setSelectionEnd({ r: nextRow, c: nextCol });
      }
      setTimeout(() => {
        let actualNextRow = nextRow;
        // Skip over rows that might not have the focusable element rendered (very rare if we make all focusable, but safe)
        let nextEl = document.querySelector(
          `[data-row="${actualNextRow}"][data-col="${nextCol}"]`,
        ) as HTMLElement;
        while (!nextEl && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          if (e.key === "ArrowDown") actualNextRow++;
          else actualNextRow--;
          if (actualNextRow < 0 || actualNextRow > visibleTasks.length + 10)
            break;
          nextEl = document.querySelector(
            `[data-row="${actualNextRow}"][data-col="${nextCol}"]`,
          ) as HTMLElement;
        }
        if (nextEl) {
          nextEl.focus({ preventScroll: true });
          const scrollContainer = nextEl.closest(
            ".overflow-auto",
          ) as HTMLElement;
          if (scrollContainer) {
            const rect = nextEl.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const headerHeight = 50;
            const footerHeight = 50;
            if (rect.top < containerRect.top + headerHeight) {
              scrollContainer.scrollTop -=
                containerRect.top + headerHeight - rect.top;
            } else if (rect.bottom > containerRect.bottom - footerHeight) {
              scrollContainer.scrollTop +=
                rect.bottom - (containerRect.bottom - footerHeight);
            }
          }
        }
      }, 0);
    }
  };

  const parsePastedValue = (
    colId: string,
    valStr: string,
    updates: Partial<Task>,
  ) => {
    if (!valStr && valStr !== "") return;
    switch (colId) {
      case "name":
        updates.name = valStr;
        break;
      case "duration":
        updates.duration = Number(valStr) || 1;
        break;
      case "actualDuration":
        updates.actualDuration = valStr === "" ? undefined : Number(valStr);
        break;
      case "remainingDuration":
        updates.remainingDuration = valStr === "" ? undefined : Number(valStr);
        break;
      case "startDate":
        updates.manualStartDate = parseDateString(valStr);
        break;
      case "endDate":
        updates.manualEndDate = parseEndDateString(valStr);
        break;
      case "predecessors":
        if (valStr) {
          const parts = valStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const ids = parts
            .map((p) => taskIdByWbsNo.get(p))
            .filter(Boolean) as string[];
          updates.predecessors = ids;
        } else {
          updates.predecessors = [];
        }
        break;
      case "progress":
        updates.progress = Number(valStr) || 0;
        break;
      case "status":
        const s =
          valStr === "完了"
            ? "done"
            : valStr === "未着手"
              ? "todo"
              : "in_progress";
        updates.status = s;
        if (valStr)
          updates.progress = s === "done" ? 100 : s === "todo" ? 0 : 50;
        break;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;

    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      const text = e.clipboardData.getData("text");
      // If it's a single cell value without tabs or newlines, let native paste handle it
      if (text && !text.includes("\n") && !text.includes("\t")) {
        return;
      }
    }

    let rowStr = target.dataset.row;
    let colStr = target.dataset.col;
    if (!rowStr && activeRect) {
      rowStr = String(activeRect.top);
      colStr = String(activeRect.left);
    }
    if (!rowStr) return;

    const currentRowIndex = parseInt(rowStr, 10);
    const currentColIndex = parseInt(colStr || "0", 10);

    const text = e.clipboardData.getData("text");
    if (!text) return;

    let rows = text.split("\n").map((r) => r.split("\t"));
    if (
      rows.length > 0 &&
      rows[rows.length - 1].length === 1 &&
      rows[rows.length - 1][0] === ""
    ) {
      rows.pop();
    }

    const visibleCols = columns.filter((c) => c.visible);

    if (
      rows.length === 1 &&
      rows[0].length === 1 &&
      activeRect &&
      (activeRect.bottom > activeRect.top || activeRect.right > activeRect.left)
    ) {
      e.preventDefault();
      const valTrimmed = rows[0][0].trim();
      for (let r = activeRect.top; r <= activeRect.bottom; r++) {
        const task = visibleTasks[r]?.task;
        if (!task || tasks.some((t) => t.parentId === task.id)) continue;
        const updates: Partial<Task> = {};
        for (let c = activeRect.left; c <= activeRect.right; c++) {
          const colId = visibleCols[c]?.id;
          if (colId) parsePastedValue(colId, valTrimmed, updates);
        }
        if (Object.keys(updates).length > 0) updateTask(task.id, updates);
      }
      return;
    }

    e.preventDefault();

    const parentId = visibleTasks[currentRowIndex]?.task?.parentId;
    const newTasksToAdd: Partial<Task>[] = [];

    rows.forEach((cols, rIndex) => {
      if (
        !cols ||
        cols.length === 0 ||
        (cols.length === 1 && cols[0].trim() === "")
      )
        return;

      const targetWbsRow = visibleTasks[currentRowIndex + rIndex];

      if (targetWbsRow) {
        const task = targetWbsRow.task;
        if (tasks.some((t) => t.parentId === task.id)) return;
        const updates: Partial<Task> = {};

        cols.forEach((val, cIndex) => {
          const valTrimmed = val.trim();
          const actualCol = currentColIndex + cIndex;
          const colId = visibleCols[actualCol]?.id;
          if (colId) parsePastedValue(colId, valTrimmed, updates);
        });

        if (Object.keys(updates).length > 0) {
          updateTask(task.id, updates);
        }
      } else {
        const updates: Partial<Task> = { name: "新規タスク", duration: 8 };

        cols.forEach((val, cIndex) => {
          let valTrimmed = val.trim();
          const actualCol = currentColIndex + cIndex;
          const colId = visibleCols[actualCol]?.id;
          if (colId) parsePastedValue(colId, valTrimmed, updates);
        });

        newTasksToAdd.push({ ...updates, type: "regular", parentId });
      }
    });

    if (newTasksToAdd.length > 0) {
      addTasks(newTasksToAdd);
    }
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    if (activeRect) {
      e.preventDefault();
      const visibleCols = columns.filter((c) => c.visible);
      let text = "";
      for (let r = activeRect.top; r <= activeRect.bottom; r++) {
        const rowData = [];
        const task = visibleTasks[r]?.task;
        if (!task) continue;
        for (let c = activeRect.left; c <= activeRect.right; c++) {
          const colId = visibleCols[c]?.id;
          let val = "";
          switch (colId) {
            case "name":
              val = task.name;
              break;
            case "duration":
              val = String(task.duration);
              break;
            case "actualDuration":
              val =
                task.actualDuration !== undefined
                  ? String(task.actualDuration)
                  : "";
              break;
            case "predecessors":
              val =
                task.predecessors
                  ?.map((pid) => wbsNumbers.get(pid))
                  .filter(Boolean)
                  .join(", ") || "";
              break;
            case "startDate":
              val = formatDate(
                task.manualStartDate || task.earlyStart || task.startDate,
              );
              break;
            case "endDate":
              val = formatEndDate(
                task.manualEndDate || task.earlyFinish || task.endDate,
              );
              break;
            case "progress":
              val = String(task.progress || 0);
              break;
            case "status":
              val =
                task.status === "done"
                  ? "完了"
                  : task.status === "todo"
                    ? "未着手"
                    : "進行中";
              break;
            case "assignee":
              const assignee = resources.find(
                (rx) => rx.id === task.resourceId,
              );
              val = assignee ? assignee.name : "";
              break;
          }
          rowData.push(val);
        }
        text += rowData.join("\t") + "\n";
      }
      e.clipboardData.setData("text/plain", text);
    }
  };

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      addTask({
        name: newTaskName,
        duration: 8,
        type: "regular",
        parentId: targetParentId,
      });
      setNewTaskName("");
      setTargetParentId(undefined); // Reset

      if (targetParentId) {
        updateTask(targetParentId, { isExpanded: true });
      }
    }
  };

  const targetParentTask = targetParentId
    ? tasks.find((t) => t.id === targetParentId)
    : null;

  // Calculate Overall Totals
  const leafTasks = tasks.filter(
    (t) => t.type === "regular" && !tasks.some((p) => p.parentId === t.id),
  );
  const totalDuration = leafTasks.reduce((acc, t) => acc + t.duration, 0);
  const totalActual = leafTasks.reduce((acc, t) => {
    const act =
      t.actualDuration !== undefined
        ? t.actualDuration
        : t.duration * ((t.progress || 0) / 100);
    return acc + act;
  }, 0);
  const totalExpected = leafTasks.reduce((acc, t) => {
    const act =
      t.actualDuration !== undefined
        ? t.actualDuration
        : t.duration * ((t.progress || 0) / 100);
    const rem =
      t.remainingDuration !== undefined
        ? t.remainingDuration
        : Math.max(0, t.duration - act);
    return acc + act + rem;
  }, 0);
  const totalRemaining = leafTasks.reduce((acc, t) => {
    const act =
      t.actualDuration !== undefined
        ? t.actualDuration
        : t.duration * ((t.progress || 0) / 100);
    const rem =
      t.remainingDuration !== undefined
        ? t.remainingDuration
        : Math.max(0, t.duration - act);
    return acc + rem;
  }, 0);
  
  const overallProgress = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-white select-none relative">
      <div
        className={`flex-1 bg-slate-50/50 p-4 sm:p-6 pb-8 relative flex flex-col min-h-0 ${resizingColId ? "select-none pointer-events-none" : ""}`}
      >
        <div className="flex flex-col gap-3 relative z-[100] shrink-0 mb-3">
          {targetParentTask && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-md text-sm flex justify-between items-center">
              <span>
                「<strong>{targetParentTask.name}</strong>」のサブタスクを追加中
              </span>
              <button
                onClick={() => setTargetParentId(undefined)}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                キャンセル
              </button>
            </div>
          )}
          
          <div className="flex justify-between items-end w-full">
            <div className="flex gap-4 items-end">
              <div className="w-[300px]">
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <span>タスク一括追加</span>
                  <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    複数セルのコピペにも対応してます
                  </span>
                </label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="新しいタスク名 (Enterで追加)..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTask();
                  }}
                />
              </div>
              <button
                onClick={handleAddTask}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-xs font-medium shrink-0 h-[32px]"
              >
                <Plus className="w-4 h-4" /> 追加
              </button>
            </div>

            <div className="relative shrink-0" ref={colMenuRef}>
              <button
                onClick={() => setShowColSettings(!showColSettings)}
                className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-medium"
                title="表示項目の設定"
              >
                <Columns className="w-3.5 h-3.5" /> 表示項目
              </button>
              {showColSettings && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg z-[100] p-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-800">項目の設定</h3>
                    <button
                      onClick={() => setShowColSettings(false)}
                      className="text-slate-400 hover:text-slate-600 rounded-md p-1 hover:bg-slate-100 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
                    {columns.map((col, idx) => (
                      <div
                      key={col.id}
                      className={`flex items-center justify-between group p-1 rounded border border-transparent cursor-grab active:cursor-grabbing ${dragOverColId === col.id ? "bg-blue-50 border-blue-200 shadow-sm" : "hover:bg-slate-50"}`}
                      draggable
                      onDragStart={(e) => handleColDragStart(e, col.id)}
                      onDragOver={(e) => handleColDragOver(e, col.id)}
                      onDrop={(e) => handleColDrop(e, col.id)}
                      onDragEnter={(e) => {
                        if (draggedColId) {
                          e.preventDefault();
                          setDragOverColId(col.id);
                        }
                      }}
                      onDragEnd={handleColDragEnd}
                    >
                      <div className="flex items-center gap-1.5 flex-1">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={(e) => {
                              const newCols = [...columns];
                              newCols[idx].visible = e.target.checked;
                              setColumns(newCols);
                            }}
                            disabled={col.id === "name"}
                            className="accent-blue-500 rounded cursor-pointer"
                          />
                          <span
                            className={`text-sm select-none ${col.id === "name" ? "text-slate-400" : "text-slate-700"}`}
                          >
                            {col.label}
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveColumn(idx, "up")}
                          className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={idx === columns.length - 1}
                          onClick={() => moveColumn(idx, "down")}
                          className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto hide-scrollbar relative">
            <div className="inline-block min-w-full align-top">
              <table
                className="text-left border-separate border-spacing-0 min-w-full table-fixed wbs-table-container select-none"
                style={{ width: "max-content" }}
              >
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold sticky top-0 z-[60]">
              <th className="p-0 border-r border-slate-200 sticky left-0 z-[70] bg-slate-100 w-12 min-w-[48px] max-w-[48px] shadow-[1px_0_0_0_#e2e8f0]">
                <div className="px-2 py-2 text-center">No.</div>
              </th>
              {columns
                .filter((c) => c.visible)
                .map((col) => {
                  const stickyInfo = stickyColumns.get(col.id);
                  return (
                  <th
                    key={col.id}
                    className={`p-0 border-r border-slate-200 ${dragOverColId === col.id ? "bg-blue-100 border-l-2 border-l-blue-400" : ""} ${stickyInfo?.isSticky ? "sticky z-[60] bg-slate-100 shadow-[1px_0_0_0_#e2e8f0]" : "relative"}`}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      maxWidth: col.width,
                      left: stickyInfo?.isSticky ? stickyInfo.left : undefined,
                    }}
                  >
                    <div
                      draggable
                      onDragStart={(e) => handleColDragStart(e, col.id)}
                      onDragOver={(e) => handleColDragOver(e, col.id)}
                      onDrop={(e) => handleColDrop(e, col.id)}
                      onDragEnter={(e) => {
                        if (draggedColId) {
                          e.preventDefault();
                          setDragOverColId(col.id);
                        }
                      }}
                      onDragEnd={handleColDragEnd}
                      className="flex justify-between items-center w-full h-full p-2 px-3 cursor-grab active:cursor-grabbing group/th"
                    >
                      <span
                        className={`truncate flex-1 ${["duration", "actualDuration"].includes(col.id) ? "text-right" : "text-center"}`}
                      >
                        {col.label}
                      </span>
                    </div>
                    <div
                      onMouseDown={(e) =>
                        handleColResizeStart(e, col.id, col.width)
                      }
                      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-blue-400 active:bg-blue-600 z-30"
                      style={{ transform: "translateX(2px)" }}
                    />
                  </th>
                  );
                })}
              <th className="p-0 border-b border-slate-200 w-full min-w-[40px]" />
            </tr>
          </thead>
          <tbody
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCopy={handleCopy}
            className={resizingColId ? "pointer-events-auto" : ""}
          >
            {visibleTasks.map(({ task, depth, index }) => {
              const children = tasks.filter((t) => t.parentId === task.id);
              const isParent = children.length > 0;

              // Can indent if it has a previous sibling
              const siblings = tasks.filter(
                (t) => t.parentId === task.parentId,
              );
              const myIndex = siblings.findIndex((t) => t.id === task.id);
              const canIndent = myIndex > 0;
              const canOutdent = !!task.parentId;

              let dragClass = "";
              if (dragOverId === task.id) {
                if (dropPosition === "before")
                  dragClass = "border-t-2 border-t-blue-500";
                else if (dropPosition === "after")
                  dragClass = "border-b-2 border-b-blue-500";
                else if (dropPosition === "inside")
                  dragClass =
                    "bg-blue-100/40 outline outline-2 outline-blue-500 z-10 relative";
              }
              if (draggingIds.includes(task.id)) {
                dragClass += " opacity-50 bg-slate-100";
              }

              return (
                <tr
                  key={`${task.id}-${index}`}
                  className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors group ${isParent ? "bg-slate-50/60" : ""} ${dragClass} ${activeRect && index >= activeRect.top && index <= activeRect.bottom ? "bg-blue-50/20" : ""}`}
                  onDragOver={(e) => handleDragOver(e, task.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, task.id)}
                >
                  <td className={`p-0 border-r border-slate-100 sticky left-0 z-[55] ${isParent ? "bg-slate-50" : "bg-white"} group-hover:bg-blue-50 text-center text-xs text-slate-400 font-mono shadow-[1px_0_0_0_#f1f5f9]`}>
                    {wbsNumbers.get(task.id)}
                  </td>
                  {columns
                    .filter((c) => c.visible)
                    .map((col, cIndex) => {
                      const stickyInfo = stickyColumns.get(col.id);
                      const bgClass = isParent ? "bg-slate-50" : "bg-white";
                      const isSticky = stickyInfo?.isSticky;
                      const stickyClass = isSticky 
                        ? `sticky ${bgClass} group-hover:bg-blue-50 shadow-[1px_0_0_0_#f1f5f9]` 
                        : "relative bg-transparent";
                      const isSelected =
                        activeRect &&
                        index >= activeRect.top &&
                        index <= activeRect.bottom &&
                        cIndex >= activeRect.left &&
                        cIndex <= activeRect.right;
                      const baseZ = isSticky ? (isSelected ? "z-[45]" : "z-40") : (isSelected ? "z-20" : "");
                      const cellClass = `p-0 border-r border-slate-100 ${stickyClass} ${baseZ} ${isSelected ? "bg-blue-100/40 ring-2 ring-inset ring-blue-500/60" : ""}`;
                      const cellStyle = { left: isSticky ? stickyInfo.left : undefined };
                      switch (col.id) {
                        case "name":
                          return (
                            <td
                              key={col.id}
                              className={cellClass}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isParent || col.id === "name")
                                  setEditingCell({ r: index, c: cIndex });
                              }}
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              <div
                                className="flex items-center w-full h-full min-h-[30px]"
                                style={{ paddingLeft: `${depth * 20}px` }}
                              >
                                <div
                                  draggable
                                  onDragStart={(e) =>
                                    handleDragStart(e, task.id, index)
                                  }
                                  onDragEnd={handleDragEnd}
                                  className="w-5 flex shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500 pr-1"
                                  title="ドラッグして移動"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <div className="w-5 flex shrink-0 justify-center h-full items-center">
                                  {isParent ? (
                                    <button
                                      onClick={() =>
                                        handleUpdate(task.id, {
                                          isExpanded: !task.isExpanded,
                                        })
                                      }
                                      className="p-0.5 text-slate-400 hover:text-slate-800 rounded transition-colors"
                                      tabIndex={-1}
                                    >
                                      {task.isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-1 h-1 rounded-full bg-slate-300 mr-2" />
                                  )}
                                </div>
                                {editingCell?.r === index &&
                                editingCell?.c === cIndex ? (
                                  <input
                                    type="text"
                                    data-row={index}
                                    data-col={cIndex}
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    className={`bg-white ring-1 ring-blue-500 outline-none px-1.5 py-1 min-h-[30px] h-full w-full flex-1 transition-all ${isParent ? "font-bold text-slate-800 text-sm" : "font-medium text-slate-600 text-sm"}`}
                                    value={task.name}
                                    onChange={(e) =>
                                      handleUpdate(task.id, {
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                ) : (
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className={`bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-1.5 py-1 min-h-[30px] flex items-center w-full flex-1 truncate select-none ${isParent ? "font-bold text-slate-800 text-sm" : "font-medium text-slate-600 text-sm"}`}
                                  >
                                    {task.name}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        case "duration":
                          return (
                            <td
                              key={col.id}
                              className={cellClass}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              <div className="flex justify-end w-full h-full min-h-[30px]">
                                {!isParent ? (
                                  editingCell?.r === index &&
                                  editingCell?.c === cIndex ? (
                                    <input
                                      type="number"
                                      min={1}
                                      data-row={index}
                                      data-col={cIndex}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                      className="w-full h-full min-h-[30px] bg-white ring-1 ring-blue-500 outline-none px-2 py-1 text-right font-mono text-sm text-slate-600"
                                      value={task.duration}
                                      onChange={(e) =>
                                        handleUpdate(task.id, {
                                          duration: Number(e.target.value) || 1,
                                        })
                                      }
                                    />
                                  ) : (
                                    <div
                                      data-row={index}
                                      data-col={cIndex}
                                      tabIndex={0}
                                      className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-right font-mono text-sm text-slate-600 truncate"
                                    >
                                      {task.duration}
                                    </div>
                                  )
                                ) : (
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className="w-full outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 text-right px-2 py-1 font-mono text-sm text-slate-600 font-bold"
                                  >
                                    {task.duration}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        case "actualDuration":
                          return (
                            <td
                              key={col.id}
                              className={cellClass}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() => {
                                /* noop for actualDuration */
                              }}
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              <div className="flex justify-end w-full h-full min-h-[30px]">
                                {
                                  /* Read-only actualDuration */
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className="w-full h-full min-h-[30px] bg-slate-50/50 outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-right font-mono text-sm text-slate-600 truncate cursor-not-allowed"
                                  >
                                    {task.actualDuration === undefined &&
                                    !isParent
                                      ? ""
                                      : Math.round(
                                          (task.actualDuration !== undefined
                                            ? task.actualDuration
                                            : 0) * 10,
                                        ) / 10}
                                  </div>
                                }
                              </div>
                            </td>
                          );
                        case "remainingDuration":
                          return (
                            <td
                              key={col.id}
                              className={cellClass}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isParent)
                                  setEditingCell({ r: index, c: cIndex });
                              }}
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              <div className="flex justify-end w-full h-full min-h-[30px]">
                                {!isParent ? (
                                  editingCell?.r === index &&
                                  editingCell?.c === cIndex ? (
                                    <input
                                      type="number"
                                      min={0}
                                      data-row={index}
                                      data-col={cIndex}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                      className="w-full h-full min-h-[30px] bg-white ring-1 ring-blue-500 outline-none px-2 py-1 text-right font-mono text-sm text-slate-600"
                                      value={
                                        task.remainingDuration !== undefined
                                          ? task.remainingDuration
                                          : Math.max(
                                              0,
                                              task.duration -
                                                (task.actualDuration || 0),
                                            )
                                      }
                                      onChange={(e) =>
                                        handleUpdate(task.id, {
                                          remainingDuration:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  ) : (
                                    <div
                                      data-row={index}
                                      data-col={cIndex}
                                      tabIndex={0}
                                      className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-right font-mono text-sm text-slate-600 truncate"
                                    >
                                      {task.remainingDuration !== undefined
                                        ? task.remainingDuration
                                        : Math.max(
                                            0,
                                            task.duration -
                                              (task.actualDuration || 0),
                                          )}
                                    </div>
                                  )
                                ) : (
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className="w-full outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 text-right px-2 py-1 font-mono text-sm text-slate-600 font-bold"
                                  >
                                    {task.remainingDuration !== undefined
                                      ? task.remainingDuration
                                      : Math.max(
                                          0,
                                          task.duration -
                                            (task.actualDuration || 0),
                                        )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        case "predecessors":
                          const predsStr =
                            task.predecessors
                              ?.map((pid) => wbsNumbers.get(pid))
                              .filter(Boolean)
                              .join(", ") || "";
                          return (
                            <td
                              key={col.id}
                              className={
                                cellClass + " text-center font-mono text-xs"
                              }
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {!isParent ? (
                                editingCell?.r === index &&
                                editingCell?.c === cIndex ? (
                                  <input
                                    type="text"
                                    data-row={index}
                                    data-col={cIndex}
                                    autoFocus
                                    className="bg-white ring-1 ring-blue-500 outline-none w-full h-full min-h-[30px] px-2 py-1 text-slate-800 text-[11px] font-mono text-left"
                                    defaultValue={predsStr}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    onBlur={(e) => {
                                      setEditingCell(null);
                                      const parts = e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean);
                                      const ids = parts
                                        .map((p) => taskIdByWbsNo.get(p))
                                        .filter(Boolean) as string[];
                                      handleUpdate(task.id, {
                                        predecessors: ids,
                                      });
                                    }}
                                  />
                                ) : (
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 flex items-center justify-center text-slate-600 text-[11px] font-mono truncate cursor-pointer"
                                  >
                                    {predsStr}
                                  </div>
                                )
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className="w-full h-full flex items-center justify-center outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                                >
                                  <span className="text-slate-400 block py-1">
                                    -
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        case "assignee":
                          return (
                            <td
                              key={col.id}
                              className={
                                cellClass + " text-center font-mono text-xs"
                              }
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {!isParent ? (
                                editingCell?.r === index &&
                                editingCell?.c === cIndex ? (
                                  <select
                                    data-row={index}
                                    data-col={cIndex}
                                    autoFocus
                                    className="appearance-none bg-white ring-1 ring-blue-500 outline-none w-full h-full min-h-[30px] px-2 py-1 text-slate-600 text-[11px] cursor-pointer"
                                    value={task.resourceId || ""}
                                    onChange={(e) =>
                                      handleUpdate(task.id, {
                                        resourceId: e.target.value || undefined,
                                      })
                                    }
                                    onBlur={() => setEditingCell(null)}
                                  >
                                    <option value="">未割当</option>
                                    {resources.map((res) => (
                                      <option key={res.id} value={res.id}>
                                        {res.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div
                                    data-row={index}
                                    data-col={cIndex}
                                    tabIndex={0}
                                    className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-slate-600 text-[11px] truncate flex items-center justify-center cursor-pointer"
                                  >
                                    {task.resourceId
                                      ? resources.find(
                                          (r) => r.id === task.resourceId,
                                        )?.name
                                      : "未割当"}
                                  </div>
                                )
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className="w-full h-full flex items-center justify-center outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                                >
                                  <span className="text-slate-400 block py-1">
                                    -
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        case "startDate":
                          return (
                            <td
                              key={col.id}
                              className={
                                cellClass + " text-center font-mono text-xs"
                              }
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {editingCell?.r === index &&
                              editingCell?.c === cIndex ? (
                                <input
                                  type="date"
                                  data-row={index}
                                  data-col={cIndex}
                                  autoFocus
                                  onFocus={(e) => {
                                    if (e.target.showPicker) {
                                      try {
                                        e.target.showPicker();
                                      } catch (error) {
                                        // Ignore SecurityError from cross-origin iframe
                                      }
                                    }
                                  }}
                                  className="w-full h-full min-h-[30px] bg-white ring-1 ring-blue-500 outline-none px-2 py-1 min-w-[max-content] text-slate-600 text-center text-[11px]"
                                  value={formatDate(
                                    task.manualStartDate ||
                                      task.earlyStart ||
                                      task.startDate,
                                  )}
                                  onChange={(e) =>
                                    handleUpdate(task.id, {
                                      manualStartDate: parseDateString(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  onBlur={() => setEditingCell(null)}
                                />
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-slate-600 text-center text-[11px] flex items-center justify-center truncate"
                                >
                                  {formatDate(
                                    task.manualStartDate ||
                                      task.earlyStart ||
                                      task.startDate,
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        case "endDate":
                          return (
                            <td
                              key={col.id}
                              className={
                                cellClass + " text-center font-mono text-xs"
                              }
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {editingCell?.r === index &&
                              editingCell?.c === cIndex ? (
                                <input
                                  type="date"
                                  data-row={index}
                                  data-col={cIndex}
                                  autoFocus
                                  onFocus={(e) => {
                                    if (e.target.showPicker) {
                                      try {
                                        e.target.showPicker();
                                      } catch (error) {
                                        // Ignore SecurityError from cross-origin iframe
                                      }
                                    }
                                  }}
                                  className="w-full h-full min-h-[30px] bg-white ring-1 ring-blue-500 outline-none px-2 py-1 min-w-[max-content] text-slate-600 text-center text-[11px]"
                                  value={formatEndDate(
                                    task.manualEndDate ||
                                      task.earlyFinish ||
                                      task.endDate,
                                  )}
                                  onChange={(e) =>
                                    handleUpdate(task.id, {
                                      manualEndDate: parseEndDateString(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  onBlur={() => setEditingCell(null)}
                                />
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className="w-full h-full min-h-[30px] bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 px-2 py-1 text-slate-600 text-center text-[11px] flex items-center justify-center truncate"
                                >
                                  {formatEndDate(
                                    task.manualEndDate ||
                                      task.earlyFinish ||
                                      task.endDate,
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        case "progress":
                          return (
                            <td
                              key={col.id}
                              className={cellClass}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {!isParent ? (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className={`flex items-center gap-1.5 h-full min-h-[30px] w-full px-2 outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 ${editingCell?.r === index && editingCell?.c === cIndex ? "bg-white ring-1 ring-blue-500" : "bg-transparent"}`}
                                >
                                  <span className="font-mono font-medium text-slate-500 text-[9px] w-5 text-right shrink-0">
                                    {task.progress}%
                                  </span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    value={task.progress}
                                    onChange={(e) => {
                                      const p = Number(e.target.value);
                                      handleUpdate(task.id, {
                                        progress: p,
                                        status:
                                          p === 100
                                            ? "done"
                                            : p === 0
                                              ? "todo"
                                              : "in_progress",
                                      });
                                    }}
                                  />
                                </div>
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className="flex items-center gap-1.5 pl-3 pr-2 h-full min-h-[30px] w-full outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400"
                                >
                                  <span className="font-mono text-slate-400 text-[9px] w-5 text-right shrink-0">
                                    {task.progress}%
                                  </span>
                                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                    <div
                                      className="bg-slate-400 h-full"
                                      style={{ width: `${task.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        case "status":
                          return (
                            <td
                              key={col.id}
                              className={cellClass + " text-center"}
                              style={cellStyle}
                              onMouseDown={(e) => {
                                if (
                                  editingCell?.r !== index ||
                                  editingCell?.c !== cIndex
                                ) {
                                  handleCellMouseDown(e, index, cIndex);
                                  setEditingCell(null);
                                  setTimeout(() => {
                                    const el = document.querySelector(
                                      `[data-row="${index}"][data-col="${cIndex}"]`,
                                    ) as HTMLElement;
                                    if (el) el.focus();
                                  }, 0);
                                }
                              }}
                              onDoubleClick={() =>
                                setEditingCell({ r: index, c: cIndex })
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              {editingCell?.r === index &&
                              editingCell?.c === cIndex ? (
                                <select
                                  data-row={index}
                                  data-col={cIndex}
                                  autoFocus
                                  className={`text-[10px] font-semibold flex items-center justify-center bg-white ring-1 ring-blue-500 px-2 py-1 outline-none cursor-pointer appearance-none text-center h-full min-h-[30px] w-full ${
                                    task.status === "done"
                                      ? "text-green-700"
                                      : task.status === "in_progress"
                                        ? "text-blue-700"
                                        : "text-slate-500"
                                  }`}
                                  value={task.status}
                                  onChange={(e) => {
                                    const st = e.target.value as any;
                                    handleUpdate(task.id, {
                                      status: st,
                                      progress:
                                        st === "done"
                                          ? 100
                                          : st === "todo"
                                            ? 0
                                            : task.progress === 100 ||
                                                task.progress === 0
                                              ? 50
                                              : task.progress,
                                    });
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                >
                                  <option value="todo">未着手</option>
                                  <option value="in_progress">進行中</option>
                                  <option value="done">完了</option>
                                </select>
                              ) : (
                                <div
                                  data-row={index}
                                  data-col={cIndex}
                                  tabIndex={0}
                                  className={`text-[10px] font-semibold flex items-center justify-center bg-transparent outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 h-full min-h-[30px] w-full truncate ${
                                    task.status === "done"
                                      ? "text-green-700"
                                      : task.status === "in_progress"
                                        ? "text-blue-700"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {task.status === "done"
                                    ? "完了"
                                    : task.status === "todo"
                                      ? "未着手"
                                      : "進行中"}
                                </div>
                              )}
                            </td>
                          );
                        case "actions":
                          return (
                            <td
                              key={col.id}
                              className={cellClass + " p-0 text-center"}
                              style={cellStyle}
                              onMouseDown={(e) =>
                                handleCellMouseDown(e, index, cIndex)
                              }
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, index, cIndex)
                              }
                            >
                              <div
                                data-row={index}
                                data-col={cIndex}
                                tabIndex={0}
                                className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity w-full h-full min-h-[30px] outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 focus:opacity-100"
                              >
                                <button
                                  onClick={() => handleOutdent(task)}
                                  disabled={!canOutdent}
                                  className={`p-1 rounded mx-0.5 ${canOutdent ? "text-slate-400 hover:text-blue-600 hover:bg-blue-50" : "text-slate-200 cursor-not-allowed"}`}
                                  title="レベルを上げる (親から外す)"
                                >
                                  <Outdent className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleIndent(task)}
                                  disabled={!canIndent}
                                  className={`p-1 rounded mx-0.5 ${canIndent ? "text-slate-400 hover:text-blue-600 hover:bg-blue-50" : "text-slate-200 cursor-not-allowed"}`}
                                  title="レベルを下げる (上のタスクの子にする)"
                                >
                                  <Indent className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setTargetParentId(task.id);
                                    (
                                      document.querySelector(
                                        'input[type="text"]',
                                      ) as HTMLElement
                                    )?.focus();
                                  }}
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded mx-0.5"
                                  title="サブタスクを追加"
                                >
                                  <ListPlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded mx-0.5"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  <td className="p-0 border-b border-slate-100" />
                </tr>
              );
            })}
            {visibleTasks.length === 0 && (
              <tr>
                <td
                  colSpan={columns.filter((c) => c.visible).length + 1}
                  className="p-8 text-center text-slate-400"
                >
                  タスクが登録されていません
                </td>
              </tr>
            )}

            {/* New Task Row */}
            <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="p-0 border-r border-slate-100 bg-slate-50 sticky left-0 z-[55] shadow-[1px_0_0_0_#f1f5f9]" />
              {columns
                .filter((c) => c.visible)
                .map((col, cIndex) => {
                  const stickyInfo = stickyColumns.get(col.id);
                  const isSticky = stickyInfo?.isSticky;
                  const stickyClass = isSticky 
                    ? "sticky z-40 bg-slate-50 shadow-[1px_0_0_0_#f1f5f9]" 
                    : "relative";
                  const cellStyle = { left: isSticky ? stickyInfo.left : undefined };
                  if (col.id === "name") {
                    return (
                      <td
                        key={col.id}
                        className={`p-0 border-r border-slate-100 ${stickyClass}`}
                        style={cellStyle}
                      >
                        <div className="flex items-center w-full h-full min-h-[30px] pl-8">
                          <input
                            type="text"
                            data-row={visibleTasks.length}
                            data-col={cIndex}
                            placeholder="+ タスクを追加..."
                            className="bg-transparent outline-none px-1.5 py-1 min-h-[30px] w-full flex-1 font-medium text-slate-400 placeholder:text-slate-400 focus:text-slate-700 text-sm"
                            onFocus={() => {
                              setSelectionStart(null);
                              setSelectionEnd(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = e.currentTarget.value;
                                if (val.trim()) {
                                  addTask({
                                    name: val.trim(),
                                    duration: 8,
                                    type: "regular",
                                  });
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.currentTarget.value;
                              if (val.trim()) {
                                addTask({
                                  name: val.trim(),
                                  duration: 8,
                                  type: "regular",
                                });
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.id}
                      className={`p-0 border-r border-slate-100 ${stickyClass}`}
                      style={cellStyle}
                      data-row={visibleTasks.length}
                      data-col={cIndex}
                      tabIndex={0}
                      onMouseDown={(e) =>
                        handleCellMouseDown(e, visibleTasks.length, cIndex)
                      }
                    />
                  );
                })}
              <td className="p-0" />
            </tr>
          </tbody>
          <tfoot className="bg-slate-100 font-bold text-slate-700 sticky bottom-0 z-[60] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] border-t border-slate-300">
            <tr>
              <td className="p-0 border-r border-slate-200 bg-slate-100 sticky left-0 z-[70] shadow-[1px_0_0_0_#e2e8f0]" />
              {columns
                .filter((c) => c.visible)
                .map((col, idx) => {
                  const stickyInfo = stickyColumns.get(col.id);
                  const stickyClass = stickyInfo?.isSticky ? "sticky z-[60] bg-slate-100 shadow-[1px_0_0_0_#cbd5e1]" : "relative";
                  const cellStyle = { left: stickyInfo?.isSticky ? stickyInfo.left : undefined };
                  switch (col.id) {
                    case "name":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 px-3 border-r border-slate-200 text-right text-xs ${stickyClass}`}
                          style={cellStyle}
                        >
                          プロジェクト全体合算
                        </td>
                      );
                    case "duration":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 text-right font-mono text-sm ${stickyClass}`}
                          style={cellStyle}
                        >
                          {Math.round(totalDuration * 10) / 10}
                        </td>
                      );
                    case "actualDuration":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 text-right font-mono text-sm ${stickyClass}`}
                          style={cellStyle}
                        >
                          {Math.round(totalActual * 10) / 10}
                        </td>
                      );
                    case "remainingDuration":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 text-right font-mono text-sm ${stickyClass}`}
                          style={cellStyle}
                        >
                          {Math.round(totalRemaining * 10) / 10}
                        </td>
                      );
                    case "assignee":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 text-center text-[10px] text-slate-500 font-normal ${stickyClass}`}
                          style={cellStyle}
                        >
                          総作業見込み: {Math.round(totalExpected * 10) / 10}h
                        </td>
                      );
                    case "progress":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 ${stickyClass}`}
                          style={cellStyle}
                        >
                          <div className="flex items-center gap-2 pl-1">
                            <span className="font-mono text-slate-600 text-[10px] w-5 text-right shrink-0">
                              {overallProgress}%
                            </span>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full"
                                style={{ width: `${overallProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      );
                    case "status":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 text-center text-xs border-r border-slate-200 ${stickyClass}`}
                          style={cellStyle}
                        >
                          {overallProgress === 100 ? "完了" : "進行中"}
                        </td>
                      );
                    case "startDate":
                    case "endDate":
                    case "actions":
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 ${stickyClass}`}
                          style={cellStyle}
                        ></td>
                      );
                    default:
                      return (
                        <td
                          key={col.id}
                          className={`p-2 border-r border-slate-200 ${stickyClass}`}
                          style={cellStyle}
                        ></td>
                      );
                  }
                })}
              <td className="p-2 border-slate-200" />
            </tr>
          </tfoot>
        </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
