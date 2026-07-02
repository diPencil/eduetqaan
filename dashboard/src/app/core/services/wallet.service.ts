import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WalletAdminStudent {
  id: number;
  studentName: string;
  year: string | null;
  phone: string | null;
  region: string | null;
  centerName: string | null;
  centerId: number | null;
  balanceCents: number;
  walletId: number | null;
  walletUpdatedAtLocal: string | null;
}

export interface WalletStats {
  totalBalanceCents: number;
  totalBalanceEGP: string;
  totalWallets: number;
  pendingTopupsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  getAdminStudents(params: {
    page?: number;
    limit?: number;
    q?: string;
    level?: string;
    centerId?: number | null;
    region?: string;
    hasBalance?: boolean;
    startDate?: string;
    endDate?: string;
  }): Observable<{ success: boolean; data: { students: WalletAdminStudent[], pagination: any } }> {
    // Ensure params are clean
    const queryParams: any = {};
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.q) queryParams.q = params.q;
    if (params.level) queryParams.level = params.level;
    if (params.centerId) queryParams.centerId = params.centerId;
    if (params.region) queryParams.region = params.region;
    if (params.hasBalance !== undefined) queryParams.hasBalance = params.hasBalance;
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;

    return this.http.get<{ success: boolean; data: { students: WalletAdminStudent[], pagination: any } }>(
      `${this.apiUrl}/wallet/admin/students`, 
      { params: queryParams }
    );
  }

  adjustBalance(studentId: number, amountCents: number, desc: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/admin/adjust-balance`, {
      studentId,
      amountCents,
      desc
    });
  }

  getStats(): Observable<{ success: boolean; data: WalletStats }> {
    return this.http.get<{ success: boolean; data: WalletStats }>(`${this.apiUrl}/wallet/admin/stats`);
  }
  
  getStudentTransactions(studentId: number): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/wallet/admin/students/${studentId}/transactions`);
  }
}
