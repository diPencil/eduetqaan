import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BaseOrder {
  id: number;
  studentId: number;
  student?: {
    studentName: string;
    studentPhone: string;
    year: string;
  };
  amountCents: number;
  status: 'pending' | 'paid' | 'approved' | 'rejected' | 'failed' | 'canceled';
  createdAt: string;
  proofImageUrl?: string;
  itemTitle?: string;
  itemType?: 'COURSE' | 'PLAN' | 'TOPUP';
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  // Manual Orders (Courses/Plans)
  getManualOrders(params?: any): Observable<{ success: boolean; data: any[] | { rows: any[]; total: number } }> {
    return this.http.get<{ success: boolean; data: any[] | { rows: any[]; total: number } }>(`${this.apiUrl}/checkout/manual/orders`, { params });
  }

  confirmManualOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/checkout/manual/confirm`, { orderId });
  }

  rejectManualOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/checkout/manual/reject`, { orderId });
  }

  // Top-ups (Wallet Charging)
  getTopups(params?: any): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/admin/topups`, { params });
  }

  approveTopup(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/topups/${id}/approve`, {});
  }

  rejectTopup(id: number, reason?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/topups/${id}/reject`, { reason });
  }
}
