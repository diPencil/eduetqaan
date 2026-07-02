import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardStats } from '../interfaces/stats.interface';
import { ChartDataResponse } from '../models/analytics.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  getDashboardStats(grade?: string, startDate?: string, endDate?: string): Observable<DashboardStats> {
    let params = new HttpParams();
    if (grade && grade !== 'all') {
      params = params.set('grade', grade);
    }
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats/dashboard`, { params });
  }

  getRevenueTrend(): Observable<{ success: boolean; data: ChartDataResponse }> {
    return this.http.get<{ success: boolean; data: ChartDataResponse }>(`${this.apiUrl}/stats/revenue-trend`);
  }

  getStudentGrowth(): Observable<{ success: boolean; data: ChartDataResponse }> {
    return this.http.get<{ success: boolean; data: ChartDataResponse }>(`${this.apiUrl}/stats/student-growth`);
  }
}
