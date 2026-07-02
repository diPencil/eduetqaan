import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AttendanceSession {
  id: number;
  centerId: number;
  courseId: number;
  lessonId: number;
  sessionDate: string;
  status: 'active' | 'closed';
  level?: string;
  startedAt?: string;
  endedAt?: string;
  center?: { id: number; name: string };
  course?: { id: number; title: string };
  lesson?: { id: number; title: string };
}

export interface AttendanceScanResponse {
  success: boolean;
  data: {
    session: AttendanceSession;
    student: {
      id: number;
      studentName: string;
      centerCode: string;
    };
    attendance: any;
    alreadyPresent: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/center-attendance';
  private courseApiUrl = 'http://localhost:12011/api/v1/center-attendance-course';

  startSession(data: { centerId: number; courseId: number; lessonId: number; level?: string }): Observable<{ success: boolean; data: AttendanceSession }> {
    return this.http.post<{ success: boolean; data: AttendanceSession }>(`${this.apiUrl}/sessions/start`, data);
  }

  scanByCode(sessionId: number, centerCode: string): Observable<AttendanceScanResponse> {
     return this.http.post<AttendanceScanResponse>(`${this.apiUrl}/sessions/${sessionId}/scan-by-center-code`, { centerCode });
  }

  getSessions(params: { centerId?: number; limit?: number; offset?: number } = {}): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sessions`, { params });
  }

  getLessonRoster(params: { centerId: number; lessonId: number; courseId?: number; level?: string }): Observable<any> {
    const baseUrl = 'http://localhost:12011/api/v1/attendance';
    return this.http.get<any>(`${baseUrl}/lesson-roster`, { params });
  }

  // Center Attendance & Exams (Robust routes)
  getCenterStudents(centerId: number, params: { level: string; courseId?: number; lessonId?: number }): Observable<any> {
    return this.http.get<any>(`${this.courseApiUrl}/centers/${centerId}/students`, { params });
  }

  saveExamScore(data: {
    centerId: number;
    courseId: number;
    lessonId: number;
    studentId: number;
    score?: number;
    maxScore?: number;
    isAbsent?: boolean;
    note?: string;
    clear?: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.courseApiUrl}/exam-score`, data);
  }

  bulkSaveExamScores(data: {
    centerId: number;
    courseId: number;
    lessonId: number;
    scores: any[];
  }): Observable<any> {
    return this.http.post<any>(`${this.courseApiUrl}/lesson-exam-scores/bulk`, data);
  }

  getAbsenceReport(params: {
    centerId: number;
    courseId: number;
    lessonId: number;
    level: string;
  }): Observable<any> {
    return this.http.get<any>(`${this.courseApiUrl}/absence-report`, { params });
  }

  getStudentScores(studentId: number, limit: number = 20): Observable<any> {
    return this.http.get<any>(`${this.courseApiUrl}/students/${studentId}/lesson-exam-scores`, {
      params: { limit }
    });
  }
}
