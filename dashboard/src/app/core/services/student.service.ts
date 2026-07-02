import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Student {
  id: number;
  studentName: string;
  email: string;
  studentPhone: string;
  guardianPhone: string;
  year: string;
  region: string;
  totalPoints?: number;
  centerId?: number;
  centerName?: string;
  centerCode?: string;
  createdAt: string;
  updatedAtLocal?: string;
}

export interface StudentsResponse {
  success: boolean;
  data: Student[];
}

export interface StudentResponse {
  success: boolean;
  data: Student;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  getStudents(params?: any): Observable<any> {
    const queryParams = this.mapParams(params);
    return this.http.get<any>(`${this.apiUrl}/wallet/admin/students`, { params: queryParams });
  }

  getStudentStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/wallet/admin/students/stats`);
  }

  getStudent(id: number): Observable<StudentResponse> {
    return this.http.get<StudentResponse>(`${this.apiUrl}/students/admin/${id}`);
  }

  createStudent(data: any): Observable<StudentResponse> {
    return this.http.post<StudentResponse>(`${this.apiUrl}/students`, data);
  }

  updateStudent(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/students/admin/${id}`, data);
  }

  deleteStudent(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/students/admin/${id}`);
  }

  getStudentAttendance(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/students/admin/${id}/attendance`);
  }

  // Wallet Management
  getStudentWallet(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/wallet/admin/students/${studentId}`);
  }

  getStudentWalletTransactions(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/wallet/admin/students/${studentId}/transactions`);
  }

  adjustWallet(studentId: number, amountCents: number, desc: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/admin/adjust-balance`, { studentId, amountCents, desc });
  }

  // Enrollment / Purchases
  getEnrollments(studentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/checkout/admin/students/${studentId}/enrollments`);
  }

  manualEnroll(studentId: number, courseId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/checkout/admin/students/${studentId}/enroll`, { courseId });
  }

  // Device Management
  getDevices(studentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/device-sessions`, { params: { studentId } });
  }

  revokeDevice(sessionId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/device-sessions/${sessionId}`);
  }

  logoutAllDevices(studentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/device-sessions/by-student/${studentId}`);
  }

  // Vouchers
  // Performance Stats
  getStudentPerformance(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats/admin/student-performance/${studentId}`);
  }

  // Access Overrides & Extensions
  getOverrides(studentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/students/admin/${studentId}/overrides`);
  }

  saveOverride(studentId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/students/admin/${studentId}/overrides`, data);
  }

  deleteOverride(studentId: number, lessonId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/students/admin/${studentId}/overrides/${lessonId}`);
  }

  // Gamification & Points
  getStudentPoints(studentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/students/admin/${studentId}/points`);
  }

  adjustStudentPoints(studentId: number, points: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/students/admin/${studentId}/points`, { points, reason });
  }

  extendAttendance(studentId: number, attendanceId: number, expiresAt: string | null): Observable<any> {
    return this.http.patch(`${this.apiUrl}/students/admin/${studentId}/attendance/${attendanceId}/extend`, { expiresAt });
  }

  // Bulk Operations
  bulkImport(students: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/students/admin/bulk-import`, { students });
  }

  getAllStudents(params?: any): Observable<any> {
    const queryParams = this.mapParams(params);
    queryParams.limit = 100000; // High limit to get all for export
    return this.http.get<any>(`${this.apiUrl}/wallet/admin/students`, { params: queryParams });
  }

  private mapParams(params: any): any {
    const queryParams: any = {};
    if (params?.search) queryParams.q = params.search;
    if (params?.grade) queryParams.level = params.grade;
    if (params?.centerId) queryParams.centerId = params.centerId;
    if (params?.region) queryParams.region = params.region;
    if (params?.hasBalance !== undefined) queryParams.hasBalance = params.hasBalance;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    return queryParams;
  }
}
