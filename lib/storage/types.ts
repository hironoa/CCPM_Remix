export interface ProjectInfo {
  id: string;
  name: string;
}

export interface PersistenceAdapter {
  /** アダプターの一意なID */
  id: string;
  /** アダプターの表示名 */
  name: string;
  /** アダプターの説明 */
  description: string;
  
  /** 設定または接続処理（ファイル選択やOAuthなどユーザーアクションが必要な場合） */
  connect?(): Promise<void>;
  
  /** 利用可能かどうか判定（設定済み、接続済みなど） */
  isReady(): boolean;
  
  /** プロジェクトの一覧を取得 */
  listProjects(): Promise<ProjectInfo[]>;
  
  /** プロジェクトデータの読み込み */
  loadProject(id: string): Promise<any | null>;
  
  /** プロジェクトデータの保存 */
  saveProject(id: string, name: string, data: any): Promise<void>;

  /** プロジェクトの削除 */
  deleteProject(id: string): Promise<void>;
  
  /** グローバルユーザーの読み込み */
  loadGlobalUsers(): Promise<any[]>;
  
  /** グローバルユーザーの保存 */
  saveGlobalUsers(users: any[]): Promise<void>;

  /** 旧方式との互換用（単一ファイルの場合など） */
  load?(): Promise<any | null>;
  save?(data: any): Promise<void>;
}

