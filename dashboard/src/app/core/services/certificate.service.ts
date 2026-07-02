import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StudentCertificate {
  id?: number;
  studentId: number;
  title: string;
  description?: string;
  type: 'exam' | 'course' | 'behavior' | 'other';
  issuedBy?: string;
  issuedAt: string | Date;
  reason?: string;
  course?: string;
  score?: number;
  maxScore?: number;
  metaJson?: string;
  student?: {
    id: number;
    studentName: string;
    centerCode: string;
    phone: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/certificates`;

  getCertificates(params: any = {}): Observable<{ success: boolean; data: StudentCertificate[], count: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<{ success: boolean; data: StudentCertificate[], count: number }>(this.apiUrl, { params: httpParams });
  }

  issueCertificate(data: Partial<StudentCertificate>): Observable<{ success: boolean; data: StudentCertificate }> {
    return this.http.post<{ success: boolean; data: StudentCertificate }>(this.apiUrl, data);
  }

  updateCertificate(id: number, data: Partial<StudentCertificate>): Observable<{ success: boolean; data: StudentCertificate }> {
    return this.http.patch<{ success: boolean; data: StudentCertificate }>(`${this.apiUrl}/${id}`, data);
  }

  deleteCertificate(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  getDownloadUrl(id: number): string {
    return `${this.apiUrl}/${id}/pdf`;
  }

  getPreviewUrl(id: number): string {
    return `${this.apiUrl}/${id}/preview`;
  }
  
  // Useful to search for students when issuing
  searchStudents(q: string): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<any>(`${environment.apiUrl}/wallet/admin/students`, {
        params: new HttpParams().set('q', q).set('limit', '10')
    }).pipe(
      map(res => ({
        success: res.success,
        data: res.data?.students || []
      }))
    );
  }
}
