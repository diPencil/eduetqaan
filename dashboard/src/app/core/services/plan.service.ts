import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Plan {
  id?: number;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  periodDays: number;
  isActive: boolean;
  scopeType: 'ALL' | 'CATEGORY' | 'GRADE' | 'COURSE_LIST';
  scopeValue?: string;
  scopeStage?: string;
  includeCourseIds?: string;
}

export interface Subscription {
  id: number;
  studentId: number;
  studentName?: string;
  planId: number;
  planName?: string;
  priceCents: number;
  currency: string;
  startAt: string;
  endAt: string;
  status: 'active' | 'expired' | 'pending';
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/plans';

  // Plans Management
  getPlans(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getPlan(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createPlan(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  updatePlan(id: number, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, data);
  }

  deletePlan(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  // Subscription Management (Admin)
  getAllSubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/subscriptions`);
  }

  createSubscription(data: { studentId: number; planId: number; startAt?: string; endAt?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/subscriptions`, data);
  }

  updateSubscription(id: number, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/admin/subscriptions/${id}`, data);
  }

  deleteSubscription(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/admin/subscriptions/${id}`);
  }
}
