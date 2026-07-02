import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WhatsappStatus {
  ready: boolean;
  phoneNumber?: string;
  pushName?: string;
  qrCode?: string; // Corrected field name (qr -> qrCode)
  status: string;
}

export interface WhatsappCampaign {
  id: number;
  title: string;
  messageTemplate: string;
  targetType: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalTargeted: number;
  sentCount?: number;
  failedCount?: number;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/whatsapp';

  getStatus(): Observable<{ success: boolean; data: WhatsappStatus }> {
    return this.http.get<{ success: boolean; data: WhatsappStatus }>(`${this.apiUrl}/status`);
  }

  initClient(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/init`, {});
  }

  logoutClient(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/logout`, {});
  }

  sendDirect(phone: string, message: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/send`, { phone, message });
  }

  startCampaign(data: any): Observable<{ success: boolean; message: string; campaignId: number }> {
    return this.http.post<{ success: boolean; message: string; campaignId: number }>(`${this.apiUrl}/campaign`, data);
  }

  getCampaigns(): Observable<{ success: boolean; data: WhatsappCampaign[] }> {
    return this.http.get<{ success: boolean; data: WhatsappCampaign[] }>(`${this.apiUrl}/campaigns`);
  }

  getLessons(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/lessons-list`);
  }

  getCenters(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/centers-list`);
  }
}
