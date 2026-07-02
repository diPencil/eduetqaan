import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Voucher {
  id: number;
  codeHash: string;
  amountCents: number;
  isUsed: boolean;
  usedBy?: number;
  usedAt?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoucherService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  getVouchers(): Observable<{ success: boolean; data: Voucher[] }> {
    return this.http.get<{ success: boolean; data: Voucher[] }>(`${this.apiUrl}/vouchers`);
  }

  generateVouchers(data: { count: number; amount: number }): Observable<any> {
    const payload = {
      count: data.count,
      amountCents: data.amount * 100, // Converting EGP to Cents (Mallims in backend)
      targetType: 'WALLET'
    };
    return this.http.post(`${this.apiUrl}/vouchers/bulk-issue`, payload);
  }

  issueVoucher(data: { code?: string, amount: number }): Observable<any> {
    const payload = {
      code: data.code,
      amountCents: data.amount * 100,
      targetType: 'WALLET'
    };
    return this.http.post(`${this.apiUrl}/vouchers/issue`, payload);
  }

  updateVoucher(id: number, data: { amount?: number, status?: string }): Observable<any> {
    const payload: any = {};
    if (data.amount !== undefined) {
      payload.amountCents = data.amount * 100;
      payload.remainingCents = data.amount * 100;
    }
    if (data.status !== undefined) payload.status = data.status;
    
    return this.http.patch(`${this.apiUrl}/vouchers/${id}`, payload);
  }

  deleteVoucher(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/vouchers/${id}`);
  }
}
