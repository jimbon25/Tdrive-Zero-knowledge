export interface FileItem {
  file_id: string;
  filename: string;
  virtual_path: string;
  size: number;
  sha256: string;
  chunk_count: number;
  encrypted: boolean;
  is_folder: boolean;
  is_starred: boolean;
  is_trashed: boolean;
  thumbnail?: string;
  status: "pending" | "uploading" | "completed" | "error";
  created_at: string;
  deleted_at?: string;
  original_path?: string;
}

export interface Job {
  job_id: string;
  type: "upload" | "download" | "rebuild";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total_size: number;
  current_size: number;
  file_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

// --- System Types ---

export interface ServiceStatus {
  name: string;
  description: string;
  load_state: string;
  active_state: string;
  sub_state: string;
}

export interface ServiceLogResponse {
  service: string;
  logs: string[];
}

export interface SystemStatus {
  telegram_connected: boolean;
  sqlite_healthy: boolean;
  session_valid: boolean;
  config_exists: boolean;
  channel_accessible: boolean;
  upload_queue_size: number;
  dev_mode: boolean;
  active_storage: number;
  trash_storage: number;
  total_storage: number;
  integrity?: {
    state: string;
    safe_mode: boolean;
    read_only: boolean;
    message: string;
  };
  bot?: {
    is_active: boolean;
    username: string | null;
    has_authorized_user?: boolean;
    authorized_users?: number[];
  };
  features?: {
    core: FeatureInfo[];
    security: FeatureIDInfo[];
    ui: FeatureInfo[];
    optional: FeatureInfo[];
  };
}

export interface FeatureInfo {
  id: string;
  name: string;
  enabled: boolean;
  immutable: boolean;
}

export interface FeatureIDInfo extends FeatureInfo {}

export interface StructuredResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// --- Analytics Types ---

export interface StorageOverview {
  total_files: number;
  total_size: number;
  trash_size: number;
  estimated_capacity: number;
}

export interface FileTypeStats {
  category: string;
  count: number;
  size: number;
  percentage: number;
}

export interface FolderAnalytics {
  path: string;
  total_files: number;
  total_size: number;
}

export interface GrowthMetrics {
  today: number;
  last_7_days: number;
  last_30_days: number;
}
