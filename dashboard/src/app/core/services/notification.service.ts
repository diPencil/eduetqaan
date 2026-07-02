import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NotificationBroadcast {
  title: string;
  body: string;
  studentId?: number;
  studentIds?: number[];
  centerId?: number;
  level?: string;
  sendToAll?: boolean;
}

export interface AdminNotification {
  id: number;
  title: string;
  body: string;
  date: string;
  read: boolean;
  studentId: number;
}

export interface AdminNotificationBatch {
  batchId: string;
  title: string;
  body: string;
  date: string;
  kind: string;
  targetCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/notifications';

  broadcast(data: NotificationBroadcast): Observable<{ success: boolean; data: { sentCount: number } }> {
    return this.http.post<{ success: boolean; data: { sentCount: number } }>(`${this.apiUrl}/admin/broadcast`, data);
  }

  getAdminNotifications(page = 1, pageSize = 20, batchId?: string): Observable<{ success: boolean; data: AdminNotification[]; meta: any }> {
    const params: any = { page, pageSize };
    if (batchId) params.batchId = batchId;
    return this.http.get<{ success: boolean; data: AdminNotification[]; meta: any }>(`${this.apiUrl}/admin`, { params });
  }

  getNotificationBatches(page = 1, pageSize = 20): Observable<{ success: boolean; data: AdminNotificationBatch[]; meta: any }> {
    return this.http.get<{ success: boolean; data: AdminNotificationBatch[]; meta: any }>(`${this.apiUrl}/admin/batches`, {
      params: { page, pageSize }
    });
  }

  deleteNotification(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/admin/${id}`);
  }
}
