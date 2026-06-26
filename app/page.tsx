'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { LayoutDashboard, GanttChartSquare, Network, KanbanSquare, TrendingUp, Users, ListTree, LineChart, MessageCircle, Clock, Upload, Wand2, History, CheckCircle2, ChevronLeft, ChevronRight, Database, FolderSync, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import KanbanView from '@/components/KanbanView';
import FeverView from '@/components/FeverView';
import ResourceView from '@/components/ResourceView';
import WbsView from '@/components/WbsView';
import DashboardView from '@/components/DashboardView';
import DailyScrumView from '@/components/DailyScrumView';
import ImportModal from '@/components/ImportModal';
import LogsView from '@/components/LogsView';
import VersionsView from '@/components/VersionsView';

const TimesheetView = dynamic(() => import('@/components/TimesheetView'), { ssr: false });

const GanttView = dynamic(() => import('@/components/GanttView'), { ssr: false });
const PertView = dynamic(() => import('@/components/PertView'), { ssr: false });
const EvmView = dynamic(() => import('@/components/EvmView'), { ssr: false });

export default function Home() {
  const { isLoading, loadWorkspace, activeView, setActiveView, storageProviderId, switchStorageProvider, projects, currentProjectId, currentProjectName, switchProject, createProject, updateProjectName, deleteProject } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isRenameProjectModalOpen, setIsRenameProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [reduceEstimateRatio, setReduceEstimateRatio] = useState<string>("50");
  const [enableCcpmMode, setEnableCcpmMode] = useState(false);
  const workingHoursPerDay = useStore((state) => state.workingHoursPerDay);
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const resources = useStore((state) => state.resources);
  const [localWorkingHours, setLocalWorkingHours] = useState<string>("6");
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);

  useEffect(() => {
    if (isScheduleModalOpen) {
      setLocalWorkingHours(String(workingHoursPerDay || 6));
    }
  }, [isScheduleModalOpen, workingHoursPerDay]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">読み込み中...</div>;
  }

  const navItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'wbs', label: 'WBS', icon: ListTree },
    { id: 'pert', label: 'PERT図', icon: Network },
    { id: 'resources', label: 'リソース負荷', icon: Users },
    { id: 'gantt', label: 'ガントチャート', icon: GanttChartSquare },
    { id: 'kanban', label: 'かんばん', icon: KanbanSquare },
    { id: 'timesheet', label: 'タイムシート', icon: Clock },
    { id: 'scrum', label: 'デイリースクラム', icon: MessageCircle },
    { id: 'evm', label: 'EVMチャート', icon: LineChart },
    { id: 'fever', label: 'フィーバーチャート', icon: TrendingUp },
    { id: 'logs', label: 'すべてのログ', icon: History },
    { id: 'versions', label: '履歴管理', icon: Clock },
  ] as const;

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-white border-r border-slate-200/70 flex flex-col items-center py-6 z-20 relative shrink-0`}>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3.5 top-8 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-full p-1 shadow-sm hover:bg-slate-50 z-50 flex items-center justify-center transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className={`flex items-center gap-3 mb-4 w-full transition-all duration-300 ${isSidebarOpen ? 'px-6' : 'px-4 justify-center'}`}>
          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
             <ListTree className="w-4 h-4 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold tracking-tight text-slate-800 truncate animate-in fade-in zoom-in duration-300">CCPM Flow</span>}
        </div>

        {isSidebarOpen && (
          <div className="w-full px-4 mb-6 relative">
            <button
              onClick={() => setIsProjectSelectorOpen(!isProjectSelectorOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span className="truncate font-medium">{currentProjectName || "プロジェクト選択"}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            {isProjectSelectorOpen && (
              <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50 py-1">
                <div className="max-h-48 overflow-y-auto">
                  {projects.map(p => (
                    <div key={p.id} className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${p.id === currentProjectId ? 'bg-blue-50' : ''}`}>
                      <button
                        onClick={() => {
                          switchProject(p.id);
                          setIsProjectSelectorOpen(false);
                        }}
                        className={`flex-1 text-left ${p.id === currentProjectId ? 'text-blue-700 font-medium' : 'text-slate-600 hover:text-blue-700'}`}
                      >
                        {p.name}
                      </button>
                      {p.id === currentProjectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewProjectName(p.name);
                            setIsRenameProjectModalOpen(true);
                            setIsProjectSelectorOpen(false);
                          }}
                          className="text-slate-400 hover:text-blue-600 px-2 flex-shrink-0"
                          title="プロジェクト名を変更"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setIsNewProjectModalOpen(true);
                      setIsProjectSelectorOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-2"
                  >
                    + 新規プロジェクト
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 w-full px-3 space-y-1 overflow-y-auto overflow-x-hidden flex flex-col" style={{ scrollbarWidth: 'none' }}>
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                title={!isSidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50 border border-blue-100/50' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                } ${!isSidebarOpen ? 'justify-center' : ''}`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#f8fafc]">
        <header className="min-h-[64px] py-3 border-b border-slate-200/70 flex flex-wrap items-center gap-4 px-8 shrink-0 z-10 bg-white/60 backdrop-blur-md sticky top-0 justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-800 tracking-tight">
               {navItems.find(i => i.id === activeView)?.label || 'ダッシュボード'}
            </h1>
            {activeView === 'gantt' && <span className="ml-2 text-xs font-medium bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200/50">Interactive</span>}
          </div>
          <div className="flex items-center gap-3 ml-auto">
             <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
               <label htmlFor="global-working-hours" className="text-sm font-medium text-slate-600 border-b border-transparent border-dashed cursor-help" title="1日の稼働時間（スケジュール計算やドラッグ時のリサイズ単位の基準になります）">
                 稼働時間/日 (h)
               </label>
               <input
                 id="global-working-hours"
                 type="number"
                 min="1"
                 max="24"
                 value={workingHoursPerDay}
                 onChange={(e) => {
                   const v = Number(e.target.value);
                   if (v >= 1 && v <= 24) {
                     useStore.getState().setWorkingHoursPerDay(Math.round(v));
                   }
                 }}
                 className="w-16 h-8 text-sm font-medium border border-slate-200 rounded-md px-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
               />
             </div>
             <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4 hidden md:flex">
               <span className="text-sm font-medium text-slate-500 whitespace-nowrap">ユーザー:</span>
               <select
                 value={currentUser || ''}
                 onChange={(e) => setCurrentUser(e.target.value)}
                 className="w-32 h-8 text-sm font-medium border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
               >
                 <option value="">未選択</option>
                 {resources.map((r) => (
                   <option key={r.id} value={r.id}>{r.name}</option>
                 ))}
               </select>
             </div>
             <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-4 hidden sm:flex">
               <Database className="w-4 h-4 text-slate-400" />
               <select
                 value={storageProviderId || 'local'}
                 onChange={(e) => {
                   const val = e.target.value;
                   if (val === 'file') {
                      switchStorageProvider('file');
                   } else {
                      switchStorageProvider(val);
                   }
                 }}
                 className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
               >
                 <option value="local">ブラウザ内部保存</option>
                 <option value="file">ローカル/共有フォルダ連携</option>
               </select>
             </div>
             <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 text-white transition-colors shadow-sm"
             >
                <Wand2 className="w-4 h-4" />
                自動計画
             </button>
             <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
             >
                <Upload className="w-4 h-4" />
                インポート
             </button>
          </div>
        </header>
        <div className="flex-1 flex flex-col min-h-0 relative bg-white">
           {activeView === 'dashboard' && <DashboardView />}
           {activeView === 'wbs' && <WbsView />}
           {activeView === 'gantt' && <GanttView />}
           {activeView === 'pert' && <PertView />}
           {activeView === 'kanban' && <KanbanView />}
           {activeView === 'fever' && <FeverView />}
           {activeView === 'evm' && <EvmView />}
           {activeView === 'scrum' && <DailyScrumView />}
           {activeView === 'resources' && <ResourceView />}
           {activeView === 'timesheet' && <TimesheetView />}
           {activeView === 'logs' && <LogsView />}
           {activeView === 'versions' && <VersionsView />}
        </div>
        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

        {isScheduleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-2">自動計画の実行</h2>
                <div className="text-sm text-slate-600 mb-6 space-y-4">
                  <p>
                    WBSとPERTの依存関係、及びリソースの割り当てから自動的にスケジュールを計画します。<br/>
                    <span className="text-red-500 font-medium">※現在の開始日・終了日の手動指定はリセットされ、タスクが重ならないように上書きされます。</span>
                  </p>
                  
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={enableCcpmMode}
                        onChange={(e) => setEnableCcpmMode(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-slate-800">CCPMモード (見積縮小とバッファ化)</div>
                        <div className="text-xs text-slate-500 mt-1">タスクの見積もり時間を一定割合削減し、削減分をバッファとして統合します。</div>
                      </div>
                    </label>
                    {enableCcpmMode && (
                      <div className="mt-3 ml-7 flex items-center gap-2">
                        <span className="text-sm text-slate-700">削減の割合:</span>
                        <input 
                          type="number"
                          min="0"
                          max="99"
                          value={reduceEstimateRatio}
                          onChange={(e) => setReduceEstimateRatio(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none"
                        />
                        <span className="text-sm text-slate-700">%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 rounded-md border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      const ratioObj = enableCcpmMode ? { reduceEstimateRatio: Number(reduceEstimateRatio) || 50 } : undefined;
                      const store = useStore.getState();
                      if (enableCcpmMode) {
                         const currentRatio = Number(reduceEstimateRatio) || 50;
                         // CCPMモード時、期日(endDate)によるバッファ計算ではなく、
                         // 削ぎ落とした割合に応じた比率計算(ratio)へモードを切り替えることで
                         // "集めた時間の半分" がプロジェクトバッファとして正しく確保されるようにする
                         store.setBufferConfig({ ...store.bufferConfig, type: 'ratio', ratio: currentRatio });
                      }
                      store.autoSchedule(ratioObj);
                      setIsScheduleModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-md bg-blue-600 font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    実行する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isNewProjectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden relative animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">新規プロジェクト</h2>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="プロジェクト名を入力..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsNewProjectModalOpen(false);
                      setNewProjectName("");
                    }}
                    className="px-4 py-2 rounded-md border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      if (newProjectName.trim()) {
                        createProject(newProjectName.trim());
                        setIsNewProjectModalOpen(false);
                        setNewProjectName("");
                      }
                    }}
                    disabled={!newProjectName.trim()}
                    className="px-4 py-2 rounded-md bg-blue-600 font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    作成する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isRenameProjectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden relative animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">プロジェクト名の変更</h2>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="プロジェクト名を入力..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsRenameProjectModalOpen(false);
                      setNewProjectName("");
                    }}
                    className="px-4 py-2 rounded-md border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      if (newProjectName.trim() && currentProjectId) {
                        updateProjectName(currentProjectId, newProjectName.trim());
                        setIsRenameProjectModalOpen(false);
                        setNewProjectName("");
                      }
                    }}
                    disabled={!newProjectName.trim() || !currentProjectId}
                    className="px-4 py-2 rounded-md bg-blue-600 font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    保存する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
