import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LiveRequest {
  id: number;
  studentId?: number;
  studentName?: string;
  name?: string;
  phone: string;
  source: 'site' | 'whatsapp' | 'call';
  status: 'new' | 'contacted' | 'ignored';
  note?: string;
  meetLink?: string;
  scheduledAt?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class LiveRequestService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/live-requests';

  getLiveRequests(params?: { status?: string, phone?: string }): Observable<{ success: boolean, data: LiveRequest[] }> {
    return this.http.get<{ success: boolean, data: LiveRequest[] }>(this.apiUrl, { params });
  }

  updateLiveRequest(id: number, data: Partial<LiveRequest>): Observable<{ success: boolean, data: LiveRequest }> {
    return this.http.patch<{ success: boolean, data: LiveRequest }>(`${this.apiUrl}/${id}`, data);
  }

  createLiveRequest(data: any): Observable<{ success: boolean, data: LiveRequest }> {
    return this.http.post<{ success: boolean, data: LiveRequest }>(this.apiUrl, data);
  }
}
