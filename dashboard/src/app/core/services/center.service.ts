import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Center {
  id: number;
  code?: string;
  name: string;
  region: string;
  city?: string;
  addressLine: string;
  mapsUrl?: string;
  isActive: boolean;
  studentCount?: number;
  updatedAtLocal?: string | Date;
}

@Injectable({
  providedIn: 'root'
})
export class CenterService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/centers';

  getCenters(params?: any): Observable<{ success: boolean; data: Center[] }> {
    return this.http.get<{ success: boolean; data: Center[] }>(this.apiUrl, { params });
  }

  getCenter(id: number): Observable<{ success: boolean; data: Center }> {
    return this.http.get<{ success: boolean; data: Center }>(`${this.apiUrl}/${id}`);
  }

  createCenter(data: Partial<Center>): Observable<{ success: boolean; data: Center }> {
    return this.http.post<{ success: boolean; data: Center }>(this.apiUrl, data);
  }

  updateCenter(id: number, data: Partial<Center>): Observable<{ success: boolean; data: Center }> {
    return this.http.patch<{ success: boolean; data: Center }>(`${this.apiUrl}/${id}`, data);
  }

  deleteCenter(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`);
  }
}
