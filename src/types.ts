export interface Resident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  phone?: string;
  whatsapp?: string;
  password?: string;
  photoDataUrl?: string;
  driveFileId?: string;
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  deviceRegistered?: boolean;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
  firstLogin: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role?: string;
  active: boolean;
  firstLogin: boolean;
}

export interface SyncProgress {
  residentId: string;
  residentName: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface Reservation {
  id: string;
  apartment: string;
  block: string;
  residentId: string;
  residentName: string;
  amenity: 'quadra' | 'churrasqueira' | 'salao';
  date: string;
  timeSlot: string;
  notes?: string;
  createdAt: string;
}

export interface Package {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  carrier?: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  employeeId?: string;
  receivedBy?: string;
}

export interface WhatsAppConfig {
  enabled: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  templateText: string;
}

export interface HikvisionDevice {
  id: string;
  name: string;
  deviceIp: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export interface HikvisionFaceSyncStatus {
  status: 'synced' | 'pending' | 'failed';
  syncedAt?: string;
  error?: string;
}
