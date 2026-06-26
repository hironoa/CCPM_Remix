const fs = require('fs');

let fileContent = fs.readFileSync('components/GanttView.tsx', 'utf8');

const targetStart = `<div
                        className="flex flex-row shrink-0 overflow-hidden pr-1 items-center h-full"
                        style={{`;

const targetEnd = `                          </>
                        )}
                      </div>
                      <div className="relative flex-1 h-full flex items-center border-b border-slate-100">`;

const startIdx = fileContent.indexOf(targetStart);
const endIdx = fileContent.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    const block = fileContent.substring(startIdx, endIdx);
    
    // We will replace this block with our mapped columns
    const mappedColumnsCode = `{columns.filter(c => c.visible).map(col => {
                          if (col.id === 'name') {
                            return (
                              <div
                                key={col.id}
                                className="flex flex-row shrink-0 overflow-hidden pr-1 items-center h-full"
                                style={{
                                  width: col.width,
                                  paddingLeft: task.parentId ? "1.5rem" : "0.5rem",
                                }}
                              >
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, task.id)}
                                  onDragEnd={handleDragEnd}
                                  className="w-4 flex shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500 mr-1"
                                  title="ドラッグして移動"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                {isParent ? (
                                  <div
                                    className="w-4 h-4 shrink-0 mr-1 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-700 transition-colors text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded"
                                    onClick={() => toggleCollapse(task.id)}
                                  >
                                    {isCollapsed ? "+" : "-"}
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 shrink-0 mr-1"></div>
                                )}
                                {editingCell?.r === index &&
                                editingCell?.c === "name" ? (
                                  <input
                                    type="text"
                                    data-row={index}
                                    data-col="name"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    value={task.name}
                                    onChange={(e) =>
                                      useStore
                                        .getState()
                                        .updateTask(task.id, { name: e.target.value })
                                    }
                                    onBlur={() => setEditingCell(null)}
                                    className={\`w-0 flex-1 bg-white outline-none ring-1 ring-blue-500 rounded px-1 -ml-1 truncate text-sm transition-all min-w-0 \${isParent ? "font-bold text-slate-800" : "font-medium text-slate-700"}\`}
                                  />
                                ) : (
                                  <div
                                    tabIndex={0}
                                    data-row={index}
                                    data-col="name"
                                    onMouseDown={() =>
                                      setSelectedCell({ r: index, c: "name" })
                                    }
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "name" })
                                    }
                                    className={\`w-0 flex-1 bg-transparent outline-none rounded px-1 -ml-1 truncate text-sm transition-all min-w-0 h-full flex items-center relative \${isParent ? "font-bold text-slate-800" : "font-medium text-slate-700"} \${selectedCell?.r === index && selectedCell?.c === "name" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                  >
                                    {task.name}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'startDate') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden text-xs text-slate-600 font-mono"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "startDate" ? (
                                    <input
                                      type="date"
                                      autoFocus
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-[11px] text-slate-600 cursor-text rounded px-1 -mx-1 truncate"
                                      value={formatDate(
                                        task.manualStartDate ||
                                          task.earlyStart ||
                                          task.startDate,
                                      )}
                                      onChange={(e) => {
                                        const parsed = parseDateString(
                                          e.target.value,
                                        );
                                        if (parsed)
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualStartDate: parsed,
                                            });
                                        else
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualStartDate: undefined,
                                            });
                                      }}
                                      onBlur={() => setEditingCell(null)}
                                    />
                                  ) : (
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="startDate"
                                      onMouseDown={() =>
                                        setSelectedCell({
                                          r: index,
                                          c: "startDate",
                                        })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "startDate" })
                                      }
                                      className={\`w-full truncate h-full flex items-center justify-center outline-none \${selectedCell?.r === index && selectedCell?.c === "startDate" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                    >
                                      {formatDate(
                                        task.manualStartDate ||
                                          task.earlyStart ||
                                          task.startDate,
                                      )}
                                    </div>
                                  ))}
                                {((task as any).isVirtualGroup || isParent) && (
                                  <div className="w-full truncate h-full flex items-center justify-center opacity-70">
                                    {formatDate(
                                      task.manualStartDate ||
                                        task.earlyStart ||
                                        task.startDate,
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'endDate') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden text-xs text-slate-600 font-mono"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "endDate" ? (
                                    <input
                                      type="date"
                                      autoFocus
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-[11px] text-slate-600 cursor-text rounded px-1 -mx-1 truncate"
                                      value={formatEndDate(
                                        task.manualEndDate ||
                                          task.earlyFinish ||
                                          task.endDate,
                                      )}
                                      onChange={(e) => {
                                        const parsed = parseEndDateString(
                                          e.target.value,
                                        );
                                        if (parsed)
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualEndDate: parsed,
                                            });
                                        else
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              manualEndDate: undefined,
                                            });
                                      }}
                                      onBlur={() => setEditingCell(null)}
                                    />
                                  ) : (
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="endDate"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "endDate" })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "endDate" })
                                      }
                                      className={\`w-full truncate h-full flex items-center justify-center outline-none \${selectedCell?.r === index && selectedCell?.c === "endDate" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                    >
                                      {formatEndDate(
                                        task.manualEndDate ||
                                          task.earlyFinish ||
                                          task.endDate,
                                      )}
                                    </div>
                                  ))}
                                {((task as any).isVirtualGroup || isParent) && (
                                  <div className="w-full truncate h-full flex items-center justify-center opacity-70">
                                    {formatEndDate(
                                      task.manualEndDate ||
                                        task.earlyFinish ||
                                        task.endDate,
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (col.id === 'resource') {
                            return (
                              <div
                                key={col.id}
                                className="flex justify-start px-2 items-center h-full border-l border-slate-100/50 shrink-0 overflow-hidden"
                                style={{ width: col.width }}
                              >
                                {!(task as any).isVirtualGroup &&
                                  !isParent &&
                                  task.type !== "project_buffer" &&
                                  task.type !== "feeding_buffer" &&
                                  (editingCell?.r === index &&
                                  editingCell?.c === "resource" ? (
                                    <select
                                      data-row={index}
                                      data-col="resource"
                                      autoFocus
                                      value={task.resourceId || ""}
                                      onChange={(e) =>
                                        useStore.getState().updateTask(task.id, {
                                          resourceId: e.target.value || undefined,
                                        })
                                      }
                                      onBlur={() => setEditingCell(null)}
                                      className="appearance-none w-full bg-white ring-1 ring-blue-500 outline-none text-xs text-slate-600 cursor-pointer rounded px-1 -mx-1 truncate"
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
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="resource"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "resource" })
                                      }
                                      onDoubleClick={() =>
                                        setEditingCell({ r: index, c: "resource" })
                                      }
                                      className={\`w-full h-full flex items-center bg-transparent outline-none text-xs text-slate-600 rounded px-1 -mx-1 truncate relative \${selectedCell?.r === index && selectedCell?.c === "resource" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                    >
                                      {task.resourceId
                                        ? resources.find(
                                            (r) => r.id === task.resourceId,
                                          )?.name
                                        : "未割当"}
                                    </div>
                                  ))}
                              </div>
                            );
                          }
                          if (col.id === 'progress') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div
                                    className="flex items-center absolute inset-0 cursor-text group/input"
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "progress" })
                                    }
                                  >
                                    {editingCell?.r === index &&
                                    editingCell?.c === "progress" ? (
                                      <input
                                        type="number"
                                        data-row={index}
                                        data-col="progress"
                                        min={0}
                                        max={100}
                                        autoFocus
                                        onFocus={(e) => e.target.select()}
                                        value={
                                          formatNum(task.progress) !== ""
                                            ? formatNum(task.progress)
                                            : 0
                                        }
                                        onChange={(e) =>
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              progress:
                                                Number(e.target.value) || 0,
                                              status:
                                                Number(e.target.value) === 100
                                                  ? "done"
                                                  : Number(e.target.value) === 0
                                                    ? "todo"
                                                    : "in_progress",
                                            })
                                        }
                                        onBlur={() => setEditingCell(null)}
                                        className="w-full h-full bg-white ring-1 ring-blue-500 text-right font-mono text-xs outline-none px-1 py-1 min-w-0 transition-colors"
                                      />
                                    ) : (
                                      <div
                                        tabIndex={0}
                                        data-row={index}
                                        data-col="progress"
                                        onMouseDown={() =>
                                          setSelectedCell({
                                            r: index,
                                            c: "progress",
                                          })
                                        }
                                        className={\`w-full h-full bg-transparent flex justify-end items-center font-mono text-xs outline-none px-1 py-1 min-w-0 transition-colors relative \${selectedCell?.r === index && selectedCell?.c === "progress" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                      >
                                        {formatNum(task.progress) !== ""
                                          ? formatNum(task.progress)
                                          : 0}
                                      </div>
                                    )}
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      %
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.progress!)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      %
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'expected') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="expected"
                                      onMouseDown={() =>
                                        setSelectedCell({
                                          r: index,
                                          c: "expected",
                                        })
                                      }
                                      className={\`cursor-not-allowed w-full h-full bg-transparent flex justify-end items-center font-mono text-xs text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative \${selectedCell?.r === index && selectedCell?.c === "expected" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                    >
                                      {formatNum(task.duration) !== ""
                                        ? formatNum(task.duration)
                                        : 0}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.duration)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'actual') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-slate-50/50 border-l border-slate-100 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div
                                      tabIndex={0}
                                      data-row={index}
                                      data-col="actual"
                                      onMouseDown={() =>
                                        setSelectedCell({ r: index, c: "actual" })
                                      }
                                      className={\`cursor-not-allowed w-full h-full bg-transparent flex justify-end items-center font-mono text-xs text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative \${selectedCell?.r === index && selectedCell?.c === "actual" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                    >
                                      {formatNum(task.actualDuration) !== ""
                                        ? formatNum(task.actualDuration)
                                        : 0}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-slate-50/50 border-l border-slate-100 relative shrink-0"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold text-slate-600 outline-none px-1 py-1 min-w-0 transition-colors relative">
                                      {formatNum(totals.actual)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0 pointer-events-none pr-1">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'remaining') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-blue-50/30 border-l border-slate-100 relative shrink-0 text-blue-700"
                                  style={{ width: col.width }}
                                >
                                  <div
                                    className="flex items-center absolute inset-0 cursor-text group/input"
                                    onDoubleClick={() =>
                                      setEditingCell({ r: index, c: "remaining" })
                                    }
                                  >
                                    {editingCell?.r === index &&
                                    editingCell?.c === "remaining" ? (
                                      <input
                                        type="number"
                                        data-row={index}
                                        data-col="remaining"
                                        min={0}
                                        step={0.5}
                                        autoFocus
                                        onFocus={(e) => e.target.select()}
                                        value={formatNum(
                                          task.remainingDuration !== undefined
                                            ? task.remainingDuration
                                            : Math.max(
                                                0,
                                                task.duration -
                                                  (task.actualDuration || 0),
                                              ),
                                        )}
                                        placeholder="0"
                                        onChange={(e) =>
                                          useStore
                                            .getState()
                                            .updateTask(task.id, {
                                              remainingDuration:
                                                Number(e.target.value) || 0,
                                            })
                                        }
                                        onBlur={() => setEditingCell(null)}
                                        className="w-full h-full bg-white ring-1 ring-blue-500 text-right font-mono text-xs outline-none px-1 py-1 min-w-0 font-medium transition-colors text-inherit"
                                      />
                                    ) : (
                                      <div
                                        tabIndex={0}
                                        data-row={index}
                                        data-col="remaining"
                                        onMouseDown={() =>
                                          setSelectedCell({
                                            r: index,
                                            c: "remaining",
                                          })
                                        }
                                        className={\`w-full h-full bg-transparent flex justify-end items-center font-mono text-xs outline-none px-1 py-1 min-w-0 font-medium transition-colors text-inherit relative \${selectedCell?.r === index && selectedCell?.c === "remaining" ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/10" : ""}\`}
                                      >
                                        {formatNum(
                                          task.remainingDuration !== undefined
                                            ? task.remainingDuration
                                            : Math.max(
                                                0,
                                                task.duration -
                                                  (task.actualDuration || 0),
                                              ),
                                        ) !== ""
                                          ? formatNum(
                                              task.remainingDuration !== undefined
                                                ? task.remainingDuration
                                                : Math.max(
                                                    0,
                                                    task.duration -
                                                      (task.actualDuration || 0),
                                                  ),
                                            )
                                          : 0}
                                      </div>
                                    )}
                                    <span className="text-[10px] text-blue-400/70 shrink-0 pointer-events-none pr-2">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full bg-blue-50/30 border-l border-slate-100 relative shrink-0 text-blue-700"
                                  style={{ width: col.width }}
                                >
                                  <div className="flex items-center absolute inset-0 group/input">
                                    <div className="w-full h-full bg-transparent flex justify-end items-center font-mono text-xs font-bold outline-none px-1 py-1 min-w-0 transition-colors relative text-inherit">
                                      {formatNum(totals.remaining)}
                                    </div>
                                    <span className="text-[10px] text-blue-400/70 shrink-0 pointer-events-none pr-2">
                                      h
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          }
                          if (col.id === 'status') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100 relative shrink-0 px-1"
                                  style={{ width: col.width }}
                                >
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      useStore.getState().updateTask(task.id, {
                                        status: e.target.value as any,
                                      })
                                    }
                                    className="w-full bg-transparent outline-none text-xs text-center"
                                  >
                                    <option value="todo">TODO</option>
                                    <option value="in_progress">進行中</option>
                                    <option value="done">完了</option>
                                  </select>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0 px-1"
                                  style={{ width: col.width }}
                                ></div>
                              );
                            }
                          }
                          if (col.id === 'predecessors') {
                            if (!isParent) {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100 relative shrink-0 px-2"
                                  style={{ width: col.width }}
                                >
                                  <div className="w-full truncate text-xs text-slate-600">
                                    {task.predecessors.length > 0
                                      ? task.predecessors
                                          .map(
                                            (id) =>
                                              tasks.find((t) => t.id === id)
                                                ?.name || "不明",
                                          )
                                          .join(", ")
                                      : "-"}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  key={col.id}
                                  className="flex flex-col justify-center h-full border-l border-slate-100/50 relative shrink-0 px-2"
                                  style={{ width: col.width }}
                                ></div>
                              );
                            }
                          }
                          return null;
                        })}`;
    
    fileContent = fileContent.substring(0, startIdx) + mappedColumnsCode + fileContent.substring(endIdx);
    fs.writeFileSync('components/GanttView.tsx', fileContent, 'utf8');
    console.log("Success");
} else {
    console.log("Not found");
}
