"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Clock, User, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

export default function VersionsView() {
  const { versions, restoreVersion, resources, setActiveView } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null);

  const handleRestore = (id: string, timestamp: string) => {
    setConfirmModalId(id);
  };

  const executeRestore = () => {
    if (confirmModalId) {
      restoreVersion(confirmModalId);
      setConfirmModalId(null);
      setActiveView("dashboard");
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            変更履歴・スナップショット
          </h1>
          <div className="text-sm text-slate-500">
            自動保存されたプロジェクトの履歴一覧です。
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {(!versions || versions.length === 0) ? (
            <div className="p-8 text-center text-slate-500">
              履歴がありません。
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 w-10"></th>
                  <th className="p-4 font-semibold text-sm text-slate-600">日時</th>
                  <th className="p-4 font-semibold text-sm text-slate-600">ユーザー</th>
                  <th className="p-4 font-semibold text-sm text-slate-600">変更内容</th>
                  <th className="p-4 font-semibold text-sm text-slate-600 w-32 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {[...versions].reverse().map((v, i) => {
                  const date = new Date(v.timestamp);
                  const isExpanded = expandedId === v.id;
                  
                  return (
                    <React.Fragment key={v.id}>
                      <tr 
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="p-4 text-center cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : v.id)}>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className="p-4 text-sm text-slate-800 font-medium whitespace-nowrap">
                          {date.toLocaleDateString("ja-JP")} {date.toLocaleTimeString("ja-JP")}
                          {i === 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">最新</span>}
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400" />
                            {resources.find(r => r.id === v.author)?.name || v.author}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-700 max-w-md truncate" title={v.message}>
                          {v.message}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleRestore(v.id, v.timestamp)}
                            disabled={i === 0}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              i === 0
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            復元
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={5} className="p-4">
                            <div className="text-sm text-slate-700 grid grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <div>
                                <div className="font-semibold text-slate-500 mb-1">スナップショット情報</div>
                                <div>タスク数: {v.data?.tasks?.length || 0}</div>
                                <div>リソース数: {v.data?.resources?.length || 0}</div>
                                <div>実績ログ数: {v.data?.dailyLogs?.length || 0}</div>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-500 mb-1">設定情報</div>
                                <div>開始日: {v.data?.projectStartDate ? new Date(v.data.projectStartDate).toLocaleDateString("ja-JP") : "-"}</div>
                                <div>バッファ: {v.data?.bufferConfig?.ratio}% (形式: {v.data?.bufferConfig?.type})</div>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-500 mb-1">自動生成メッセージ</div>
                                <div className="text-slate-600 whitespace-pre-wrap">{v.message}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmModalId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" />
                過去のバージョンに復元
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                本当にこのバージョンに復元しますか？<br />
                現在の未保存の変更は失われます。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModalId(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={executeRestore}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  復元してダッシュボードに戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
