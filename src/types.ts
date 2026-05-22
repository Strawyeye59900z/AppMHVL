/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Resident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  password?: string;
  phone?: string; // Optional resident phone number for WhatsApp alerts
  photoDataUrl?: string; // Captured photo (base64 string)
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  driveFileId?: string;
  deviceRegistered?: boolean; // Whether registered manually on the physical device
}

export interface SyncProgress {
  residentId: string;
  residentName: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface DriveFolderMap {
  [folderName: string]: string; // folderName (e.g. "Apto 101") -> google drive folder id
}

export interface Reservation {
  id: string;
  apartment: string;
  block: string;
  residentId: string;
  residentName: string;
  amenity: 'quadra' | 'churrasqueira' | 'salao';
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 - 15:00"
  notes?: string;
  createdAt: string;
}
