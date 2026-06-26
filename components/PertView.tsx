"use client";
import { useStore, Task } from "@/lib/store";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position,
  MarkerType,
  Connection,
  addEdge,
  Panel,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  ReactFlowProvider,
  useReactFlow,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import dagre from "dagre";
import { Plus, X, Flame } from "lucide-react";

const nodeWidth = 240;
const nodeHeight = 90;

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "LR",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = { ...node };

    newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
    newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    newNode.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

// Custom Edge with Delete Button
const CustomDeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  source,
  target,
  data,
}: any) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const showOverlay = selected || isHovered;

  const handleDelete = () => {
    const targetTaskNode = useStore
      .getState()
      .tasks.find((t) => t.id === target);
    if (targetTaskNode) {
      useStore.getState().updateTask(target, {
        predecessors: targetTaskNode.predecessors.filter((p) => p !== source),
      });
    }
  };

  const edgeStyle = {
    ...style,
    strokeWidth: isHovered
      ? (Number(style?.strokeWidth) || 2) + 2
      : style?.strokeWidth,
    stroke: isHovered ? "#3b82f6" : style?.stroke,
  };

  return (
    <g>
      <path
        d={edgePath}
        fill="none"
        stroke={edgeStyle.stroke || "#94a3b8"}
        strokeWidth={edgeStyle.strokeWidth || 2}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        style={edgeStyle}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        className="react-flow__edge-interaction"
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDelete();
        }}
      />

      <EdgeLabelRenderer>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: showOverlay ? "all" : "none",
          }}
          className={`transition-all duration-200 z-50 ${showOverlay ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
        >
          <button
            className="w-7 h-7 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-500 hover:bg-red-50 transition-all shadow-md cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            title="依存関係の削除"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};

const edgeTypes = {
  customDeletableEdge: CustomDeletableEdge,
};

// Custom Node Component
const CustomTaskNode = ({
  data,
  selected,
}: {
  data: any;
  selected?: boolean;
}) => {
  const isCritical = data.isCritical;
  const isParent = data.isParent;

  const bgClass = isParent
    ? "bg-slate-800 text-white"
    : isCritical
      ? "bg-red-50"
      : "bg-white";
  const borderClass = selected
    ? "border-blue-500 ring-4 ring-blue-500/20 z-50"
    : isParent
      ? "border-slate-800"
      : isCritical
        ? "border-red-500"
        : "border-slate-300";

  return (
    <div
      className={`group p-4 w-[240px] rounded-xl shadow-md border-2 relative transition-all ${bgClass} ${borderClass}`}
    >
      <button
        className={`absolute -top-3 -right-3 w-7 h-7 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-500 hover:bg-red-50 transition-all duration-200 z-50 shadow-md cursor-pointer ${selected ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"}`}
        onClick={(e) => {
          e.stopPropagation();
          useStore.getState().deleteTask(data.id);
        }}
        title="タスクを削除"
      >
        <X size={14} strokeWidth={2.5} />
      </button>

      <Handle
        type="target"
        position={Position.Left}
        className={`!w-4 !h-4 !-ml-2 !border-2 !border-white ${isCritical ? "!bg-red-500" : "!bg-slate-400"}`}
      />

      <div className="flex flex-col relative z-10">
        <div className="flex justify-between items-start mb-2 text-current pointer-events-none">
          <span
            className={`font-bold text-sm leading-tight line-clamp-2 ${isParent ? "text-white" : isCritical ? "text-red-900" : "text-slate-800"}`}
          >
            {data.name}
          </span>
          {isCritical && !isParent && (
            <span className="shrink-0 bg-red-500 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ml-2 flex items-center">
              <Flame className="w-3 h-3 mr-0.5" /> CC
            </span>
          )}
        </div>

        {!isParent && (
          <div className="flex justify-between items-end mt-2 pt-2 border-t border-current/20">
            <div
              className={`text-xs font-mono flex flex-col items-start pointer-events-none ${isCritical ? "text-red-800" : "text-slate-500"}`}
            >
              <span className="text-[10px] mb-0.5 font-sans">見積</span>
              <span>
                <span className="font-bold current">{data.duration}</span>h
              </span>
            </div>
            <div
              className={`text-xs font-mono flex flex-col items-center ${isCritical ? "text-red-800" : "text-slate-500"}`}
            >
              <span className="pointer-events-none text-[10px] mb-0.5 font-sans">
                残
              </span>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  className="nodrag w-10 text-center bg-transparent border-b border-current/30 outline-none hover:border-current focus:border-blue-500 font-bold"
                  value={data.remainingDuration}
                  onChange={(e) => {
                    useStore.getState().updateTask(data.id, {
                      remainingDuration: Number(e.target.value),
                    });
                  }}
                />
                <span className="pointer-events-none text-[10px] ml-0.5">
                  h
                </span>
              </div>
            </div>
            <div className="text-xs font-mono flex flex-col items-end pointer-events-none">
              <span className="text-[10px] mb-0.5 font-sans">余裕</span>
              <span>
                <span
                  className={`font-bold ${data.slack > 0 ? "text-green-600" : "current"}`}
                >
                  {data.slack || 0}
                </span>
                d
              </span>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={`!w-4 !h-4 !-mr-2 !border-2 !border-white ${isCritical ? "!bg-red-500" : "!bg-slate-400"}`}
      />
    </div>
  );
};

const nodeTypes = {
  customTaskNode: CustomTaskNode,
};

function PertViewInner() {
  const { tasks, addTask, updateTask, deleteTask } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [newTaskName, setNewTaskName] = useState("");

  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges, "LR");
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    layouted.nodes.forEach((n) => {
      if (n.id !== "PERT_START" && n.id !== "PERT_GOAL") {
        useStore.getState().updateTask(n.id, { position: n.position });
      }
    });

    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
  }, [nodes, edges, setNodes, setEdges, fitView]);

  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const startDragInfo = useRef<{
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        e.button === 2 &&
        (e.target as HTMLElement).closest(".react-flow__pane")
      ) {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        startDragInfo.current = {
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          clientX: e.clientX,
          clientY: e.clientY,
        };
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startDragInfo.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const { startX, startY } = startDragInfo.current;
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);
        setSelectionRect({ x, y, w, h });
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startDragInfo.current) {
        e.currentTarget.releasePointerCapture(e.pointerId);
        const dist = Math.max(
          Math.abs(e.clientX - startDragInfo.current.clientX),
          Math.abs(e.clientY - startDragInfo.current.clientY),
        );

        if (dist >= 5 && selectionRect) {
          const flowRectPosStart = screenToFlowPosition({
            x: Math.min(startDragInfo.current.clientX, e.clientX),
            y: Math.min(startDragInfo.current.clientY, e.clientY),
          });
          const flowRectPosEnd = screenToFlowPosition({
            x: Math.max(startDragInfo.current.clientX, e.clientX),
            y: Math.max(startDragInfo.current.clientY, e.clientY),
          });

          const minFlowX = Math.min(flowRectPosStart.x, flowRectPosEnd.x);
          const minFlowY = Math.min(flowRectPosStart.y, flowRectPosEnd.y);
          const maxFlowX = Math.max(flowRectPosStart.x, flowRectPosEnd.x);
          const maxFlowY = Math.max(flowRectPosStart.y, flowRectPosEnd.y);

          setNodes((nds) =>
            nds.map((n) => {
              if (n.position) {
                const ndW = nodeWidth;
                const ndH = nodeHeight;
                const nLeft = n.position.x;
                const nRight = n.position.x + ndW;
                const nTop = n.position.y;
                const nBottom = n.position.y + ndH;

                const isSelected = !(
                  nLeft > maxFlowX ||
                  nRight < minFlowX ||
                  nTop > maxFlowY ||
                  nBottom < minFlowY
                );
                return { ...n, selected: isSelected };
              }
              return n;
            }),
          );
        }
        setSelectionRect(null);
        startDragInfo.current = null;
      }
    },
    [selectionRect, screenToFlowPosition, setNodes],
  );

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.detail === 2) {
        const position = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        useStore.getState().addTask({
          name: "新規タスク",
          duration: 1,
          type: "regular",
          position,
        });
      }
    },
    [screenToFlowPosition],
  );

  const onNodesChangeImpl = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const draggingPass = changes.filter(
        (c) => c.type === "position" && !c.dragging && c.position,
      );
      if (draggingPass.length > 0) {
        draggingPass.forEach((c) => {
          if (c.type === "position" && c.position) {
            useStore.getState().updateTask(c.id, { position: c.position });
          }
        });
      }
    },
    [onNodesChange],
  );

  useEffect(() => {
    const leafTasks = tasks.filter(
      (task) => !tasks.some((t) => t.parentId === task.id),
    );
    const leafTaskIds = new Set(leafTasks.map((t) => t.id));

    // Determine which nodes need dagre layout
    const needsLayout = leafTasks.some((t) => !t.position);

    const allPredecessors = new Set(
      leafTasks.flatMap((t) =>
        t.predecessors.filter((pId) => leafTaskIds.has(pId)),
      ),
    );

    let rawNodes: Node[] = leafTasks.map((task) => ({
      id: task.id,
      position: task.position || { x: 0, y: 0 },
      type: "customTaskNode",
      data: {
        id: task.id,
        name: task.name,
        duration: task.duration,
        remainingDuration: task.remainingDuration ?? task.duration,
        slack: task.slack,
        isCritical: task.isCritical,
        isParent: false,
      },
    }));

    const startNode: Node = {
      id: "PERT_START",
      position: { x: 0, y: 0 },
      type: "default",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
      data: { label: "START" },
      style: {
        borderRadius: "50%",
        width: 60,
        height: 60,
        background: "#f1f5f9",
        border: "2px solid #cbd5e1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        color: "#64748b",
        fontSize: "11px",
      },
    };

    const goalNode: Node = {
      id: "PERT_GOAL",
      position: { x: 1000, y: 0 },
      type: "default",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
      data: { label: "GOAL" },
      style: {
        borderRadius: "50%",
        width: 60,
        height: 60,
        background: "#f8fafc",
        border: "2px solid #0ea5e9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        color: "#0ea5e9",
        fontSize: "11px",
      },
    };

    rawNodes.push(startNode);
    rawNodes.push(goalNode);

    if (!needsLayout && leafTasks.length > 0) {
      const xVals = leafTasks
        .filter((t) => t.position)
        .map((n) => n.position!.x);
      const yVals = leafTasks
        .filter((t) => t.position)
        .map((n) => n.position!.y);
      const minX = Math.min(...xVals);
      const maxX = Math.max(...xVals);
      const avgY = yVals.reduce((sum, y) => sum + y, 0) / yVals.length;

      startNode.position = { x: minX - 150, y: avgY + nodeHeight / 2 - 30 };
      goalNode.position = {
        x: maxX + nodeWidth + 90,
        y: avgY + nodeHeight / 2 - 30,
      };
    }

    const rawEdges: Edge[] = leafTasks.flatMap((task) =>
      task.predecessors
        .filter((predId) => leafTaskIds.has(predId))
        .map((predId) => {
          const pred = leafTasks.find((t) => t.id === predId);
          const isCriticalEdge = pred?.isCritical && task.isCritical;

          return {
            id: `e-${predId}-${task.id}`,
            source: predId,
            target: task.id,
            animated: isCriticalEdge,
            type: "customDeletableEdge",
            data: {
              sourceId: predId,
              targetId: task.id,
            },
            interactionWidth: 20,
            deletable: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: isCriticalEdge ? "#ef4444" : "#94a3b8",
            },
            style: {
              stroke: isCriticalEdge ? "#ef4444" : "#94a3b8",
              strokeWidth: isCriticalEdge ? 3 : 2,
            },
          };
        }),
    );

    leafTasks.forEach((t) => {
      const initialPredecessorsInLeafTasks = t.predecessors.filter((pId) =>
        leafTaskIds.has(pId),
      );
      if (initialPredecessorsInLeafTasks.length === 0) {
        rawEdges.push({
          id: `e-start-${t.id}`,
          source: "PERT_START",
          target: t.id,
          type: "default",
          style: {
            stroke: "#cbd5e1",
            strokeWidth: 1.5,
            strokeDasharray: "4 4",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1" },
        });
      }
      if (!allPredecessors.has(t.id)) {
        rawEdges.push({
          id: `e-${t.id}-goal`,
          source: t.id,
          target: "PERT_GOAL",
          type: "default",
          style: {
            stroke: "#7dd3fc",
            strokeWidth: 1.5,
            strokeDasharray: "4 4",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#7dd3fc" },
        });
      }
    });

    if (needsLayout && rawNodes.length > 2) {
      const layouted = getLayoutedElements(rawNodes, rawEdges, "LR");
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      // Save to store so they don't jump again
      layouted.nodes.forEach((n) => {
        if (n.id !== "PERT_START" && n.id !== "PERT_GOAL") {
          if (!tasks.find((t) => t.id === n.id)?.position && n.position) {
            useStore.getState().updateTask(n.id, { position: n.position });
          }
        }
      });
    } else {
      setNodes(rawNodes);
      setEdges(rawEdges);
    }
  }, [tasks, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      const targetTask = useStore
        .getState()
        .tasks.find((t) => t.id === connection.target);
      if (targetTask && !targetTask.predecessors.includes(connection.source)) {
        useStore.getState().updateTask(connection.target, {
          predecessors: [...targetTask.predecessors, connection.source],
        });
      }
    }
  }, []);

  const onEdgeContextMenu = useCallback((event: any, edge: any) => {
    event.preventDefault();
    event.stopPropagation();
    const targetTask = useStore
      .getState()
      .tasks.find((t) => t.id === edge.target);
    if (targetTask) {
      useStore.getState().updateTask(targetTask.id, {
        predecessors: targetTask.predecessors.filter((p) => p !== edge.source),
      });
    }
  }, []);
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach((node) => {
      useStore.getState().deleteTask(node.id);
    });
  }, []);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      const targetTask = useStore
        .getState()
        .tasks.find((t) => t.id === edge.target);
      if (targetTask) {
        useStore.getState().updateTask(targetTask.id, {
          predecessors: targetTask.predecessors.filter(
            (p) => p !== edge.source,
          ),
        });
      }
    });
  }, []);

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      useStore
        .getState()
        .addTask({ name: newTaskName.trim(), duration: 1, type: "regular" });
      setNewTaskName("");
    }
  };

  return (
    <div
      className="h-full w-full relative bg-slate-50/50"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {selectionRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10 z-[1000] pointer-events-none"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.w,
            height: selectionRect.h,
          }}
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChangeImpl}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={(e) => e.preventDefault()}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.2}
        selectionOnDrag={false}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        panOnDrag={[0]}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Panel
          position="top-left"
          className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-lg !m-6 w-80"
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold text-slate-800">
              PERT図 (Network Diagram)
            </h2>
            <button
              onClick={handleAutoLayout}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded border border-slate-300 transition"
              title="ノードを自動整列します"
            >
              自動整列
            </button>
          </div>

          <details className="mb-4 text-xs text-slate-500 group">
            <summary className="cursor-pointer hover:text-slate-700 font-medium list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform text-[10px]">
                ▶
              </span>
              操作説明を表示
            </summary>
            <p className="mt-2 pl-2 border-l-2 border-slate-200 leading-relaxed">
              ・マウスホイールでズーム。
              <br />
              ・左クリックドラッグでキャンバス移動(スクロール)。
              <br />
              ・右クリックドラッグで複数範囲選択。
              <br />
              ・背景を「ダブルクリック」でマウス位置に新規タスクを追加。
              <br />
              ・端の丸をドラッグして依存関係(矢印)を追加。
              <br />
              ・矢印をホバーして「×」ボタン、または右クリックで依存関係を削除。
              <br />
              ・タスクを選択して「BackSpace」でタスク削除。
            </p>
          </details>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="新規タスク名..."
              className="flex-1 border border-slate-200 px-3 py-1.5 rounded-md text-sm outline-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
              }}
            />
            <button
              onClick={handleAddTask}
              className="bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 transition flex items-center justify-center w-8"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </Panel>
        <Controls />
        <MiniMap
          nodeStrokeColor={(n) => {
            return n.data.isCritical ? "#ef4444" : "#cbd5e1";
          }}
          nodeColor={(n) => {
            return n.data.isCritical ? "#fef2f2" : "#ffffff";
          }}
          maskColor="rgba(248, 250, 252, 0.7)"
        />
        <Background gap={16} size={2} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}

export default function PertView() {
  return (
    <ReactFlowProvider>
      <PertViewInner />
    </ReactFlowProvider>
  );
}
