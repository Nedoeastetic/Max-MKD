// Типы для фронтенда

export type Role = 'resident' | 'master';

export type WorkerType = 'PLUMBER' | 'ELECTRICIAN' | 'CLEANER' | 'LOCKSMITH' | 'LANDSCAPER' | 'MAINTENANCE' | 'UNIVERSAL';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus = 'AVAILABLE' | 'ASSIGNED' | 'RESOLVED' | 'CANCELLED';

export type InputMode = 'TEXT_ONLY' | 'IMAGE_ONLY' | 'TEXT_AND_IMAGE' | 'WEBHOOK';

export interface User {
  id: string;
  role: Role;
  name: string;
  worker_type?: WorkerType;
  default_address?: string;
  created_at: string;
}

export interface Incident {
  id: number;
  user_id: string;
  text?: string;
  address: string;
  photo_url?: string;
  category?: string;
  subcategory?: string;
  severity?: Severity;
  confidence?: number;
  input_mode: InputMode;
  status: IncidentStatus;
  master_id?: string;
  master_name?: string;
  report?: string;
  created_at: string;
  updated_at: string;
  review?: Review | null;
}

export interface Review {
  id: number;
  incident_id: number;
  master_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface Master {
  id: string;
  name: string;
  worker_type: WorkerType;
  rating_avg: number | null;
  review_count: number;
}
