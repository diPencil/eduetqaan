import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QrSnippet {
  id?: number;
  token?: string;
  courseId: number;
  lessonId: number;
  title: string;
  description?: string;
  subject?: string;
  teacher?: string;
  streamType: 'mp4' | 'hls' | 'dash' | 'external';
  provider?: string;
  streamUrl: string;
  posterUrl?: string;
  durationSec?: number;
  startAt?: number;
  endAt?: number;
  linkExpiresAt?: string | Date;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QrService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/qr-snippets';

  getQrSnippets(params: any = {}): Observable<{ success: boolean; data: QrSnippet[] }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<{ success: boolean; data: QrSnippet[] }>(this.apiUrl, { params: httpParams });
  }

  getQrSnippet(id: number): Observable<{ success: boolean; data: QrSnippet }> {
    return this.http.get<{ success: boolean; data: QrSnippet }>(`${this.apiUrl}/${id}`);
  }

  createQrSnippet(data: QrSnippet): Observable<{ success: boolean; data: QrSnippet }> {
    return this.http.post<{ success: boolean; data: QrSnippet }>(this.apiUrl, data);
  }

  updateQrSnippet(id: number, data: Partial<QrSnippet>): Observable<{ success: boolean; data: QrSnippet }> {
    return this.http.patch<{ success: boolean; data: QrSnippet }>(`${this.apiUrl}/${id}`, data);
  }

  deleteQrSnippet(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  getCourses(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/catalog/courses`);
  }

  getLessons(courseId: number): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/catalog/lessons`, {
      params: new HttpParams().set('courseId', courseId.toString())
    });
  }
}
