import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SyncStats {
  PENDING: number;
  FAILED: number;
  COMPLETED: number;
  totalLogs: number;
  successLogs: number;
  failedLogs: number;
}

export interface SyncLogEntry {
  id: number;
  operationId: string | null;
  modelName: string;
  op: 'create' | 'update' | 'delete' | 'pull' | 'bulk';
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  details: string;
  durationMs: number;
  timestamp: string;
}

export interface OutboxRow {
  id: number;
  operationId: string;
  modelName: string;
  op: 'create' | 'update' | 'delete';
  payload: any;
  status: 'PENDING' | 'FAILED' | 'COMPLETED';
  attempts: number;
  lastError: string;
  lastAttemptAt: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  // Using 127.0.0.1 instead of localhost for better compatibility on MacOS
  private apiUrl = 'http://127.0.0.1:12011/api/v1/sync';

  constructor(private http: HttpClient) {}

  getStats(): Observable<{ success: boolean; stats: SyncStats }> {
    return this.http.get<{ success: boolean; stats: SyncStats }>(`${this.apiUrl}/stats`);
  }

  getReports(params: { limit?: number; offset?: number; status?: string } = {}): Observable<{ success: boolean; count: number; rows: SyncLogEntry[] }> {
    let query = `limit=${params.limit || 50}&offset=${params.offset || 0}`;
    if (params.status) query += `&status=${params.status}`;
    return this.http.get<{ success: boolean; count: number; rows: SyncLogEntry[] }>(`${this.apiUrl}/reports?${query}`);
  }

  clearReports(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/reports/clear`, {});
  }

  getOutbox(status: string = 'FAILED'): Observable<{ success: boolean; rows: OutboxRow[] }> {
    return this.http.get<{ success: boolean; rows: OutboxRow[] }>(`${this.apiUrl}/outbox?status=${status}`);
  }

  reprocess(id?: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/reprocess`, { id });
  }

  pullManual(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/pull`, {});
  }

  exportSql(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-sql`, { responseType: 'blob' });
  }
}
