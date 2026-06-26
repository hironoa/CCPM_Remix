"use client";
import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import { X, Upload, Info } from "lucide-react";

export default function ImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const { tasks, resources, recalculateSchedule } = useStore();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    try {
      if (!text.trim()) {
        setError("データが入力されていません。");
        return;
      }

      const lines = text.split("\n").filter((l) => l.trim() !== "");
      // 「No」か「タスク名」を含んでいればヘッダー行と判定
      const hasHeader =
        lines[0].includes("No") || lines[0].includes("タスク名");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const newTasks: any[] = [];
      const newResources: any[] = [];
      const idMap = new Map<string, string>(); // No -> UUID

      // パス1: UUIDの割り当てと担当者の抽出
      for (let i = 0; i < dataLines.length; i++) {
        const cols = dataLines[i].split("\t").map((c) => c.trim());
        const no = cols[0] || `row-${i}`;
        if (!idMap.has(no)) {
          idMap.set(no, uuidv4());
        }

        const resourceName = cols[6];
        if (
          resourceName &&
          !newResources.find((r) => r.name === resourceName) &&
          !resources.find((r) => r.name === resourceName)
        ) {
          newResources.push({
            id: uuidv4(),
            name: resourceName,
            capacity: 8,
            role: "",
          });
        }
      }

      // パス2: タスクの生成
      const usedIds = new Set<string>();
      for (let i = 0; i < dataLines.length; i++) {
        const cols = dataLines[i].split("\t").map((c) => c.trim());
        const no = cols[0] || `row-${i}`;
        let id = idMap.get(no)!;
        if (usedIds.has(id)) {
          id = uuidv4(); // 重複するNoがあった場合は新しいIDを割り振る
        }
        usedIds.add(id);

        const name = cols[1] || `名称未設定タスク ${i + 1}`;
        const duration = parseFloat(cols[2]) || 8; // デフォルト8時間（1日）
        const actualDuration = parseFloat(cols[3]) || 0;
        const parentNo = cols[4];
        const predNos = cols[5]
          ? cols[5]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const resourceName = cols[6];

        const parentId =
          parentNo && idMap.has(parentNo) ? idMap.get(parentNo) : undefined;
        // 先行タスク（既存のタスクのNoであればそれを検索、なければ今回割り当てたUUID）
        const predecessors = predNos
          .map(
            (pn) =>
              idMap.get(pn) ||
              (importMode === "append" &&
                tasks.find((t) => t.id === pn || t.name === pn)?.id) ||
              null,
          )
          .filter(Boolean) as string[];

        const resId = resourceName
          ? newResources.find((r) => r.name === resourceName)?.id ||
            resources.find((r) => r.name === resourceName)?.id
          : undefined;

        newTasks.push({
          id,
          name,
          duration,
          type: "regular",
          status:
            actualDuration >= duration
              ? "done"
              : actualDuration > 0
                ? "in_progress"
                : "todo",
          progress:
            duration > 0
              ? Math.min(100, Math.round((actualDuration / duration) * 100))
              : 0,
          actualDuration,
          remainingDuration: Math.max(0, duration - actualDuration),
          parentId,
          predecessors,
          resourceId: resId,
        });
      }

      // Storeへの反映
      if (importMode === "replace") {
        useStore.setState((state) => ({
          tasks: newTasks,
          resources: newResources,
          dailyLogs: [],
          taskStatusLogs: [],
          feverHistory: [],
          ganttSettings: {
            ...state.ganttSettings,
            collapsedTasks: [],
            selectedResources: [],
          }
        }));
      } else {
        useStore.setState((state) => ({
          tasks: [...state.tasks, ...newTasks],
          resources: [...state.resources, ...newResources],
        }));
      }

      recalculateSchedule(useStore.getState().projectStartDate);
      useStore.getState().saveData();

      onClose();
      setText("");
      setError(null);
    } catch (e: any) {
      setError(
        e.message ||
          "パースに失敗しました。TSV（タブ区切り）形式であることを確認してください。",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Upload className="w-5 h-5 text-blue-600" />
            Excel等から一括インポート
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            <p className="mb-2">
              Excelやスプレッドシートのセル範囲をコピーして、そのまま下のテキストエリアに貼り付け（Ctrl+V）してください。
            </p>
            <div className="font-mono text-xs bg-white border border-slate-200 p-3 rounded-lg overflow-x-auto whitespace-pre">
              <span className="text-slate-500 font-bold">
                No{"\t"}タスク名{"\t"}予定(h){"\t"}実績(h){"\t"}親No{"\t"}先行No
                {"\t"}担当者
              </span>
              {"\n"}1{"\t"}要件定義フェーズ{"\t"}40{"\t"}0{"\t"}
              {"\t"}
              {"\t"}
              {"\n"}2{"\t"}API仕様書作成{"\t"}16{"\t"}16{"\t"}1{"\t"}
              {"\t"}Alice
              {"\n"}3{"\t"}DB設計{"\t"}24{"\t"}8{"\t"}1{"\t"}2{"\t"}Bob
            </div>
            <ul className="list-disc list-inside mt-3 space-y-1 text-slate-600">
              <li>
                <strong className="text-slate-800">無限階層</strong>:
                「親No」に別のタスクのNoを指定することで、何階層でもネスト構造を作れます。
              </li>
              <li>
                <strong className="text-slate-800">複数リンク</strong>:
                「先行No」にカンマ区切り（例: <code>1, 2</code>
                ）で入力すると複数タスクを連結できます。
              </li>
              <li>
                「No」は任意の文字列や数字（WBSコード等）が使えます（A-1, 1.1.1
                など）。
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              データ貼付エリア
              <span className="text-xs font-normal text-slate-500">
                （TSV形式）
              </span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ここにコピーしたデータを貼り付けてください"
              className="w-full h-48 p-3 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer group">
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="text-slate-700 group-hover:text-slate-900">
                既存データを全て上書き（リセット）
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer group">
              <input
                type="radio"
                name="importMode"
                value="append"
                checked={importMode === "append"}
                onChange={() => setImportMode("append")}
                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="text-slate-700 group-hover:text-slate-900">
                現在のデータに追加（追記）
              </span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleImport}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            インポート実行
          </button>
        </div>
      </div>
    </div>
  );
}
