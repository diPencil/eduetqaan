import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Exam {
  id: number;
  title: string;
  description: string;
  level: string;
  category: string;
  grade: string;
  isFree: boolean;
  status: 'published' | 'draft';
  durationMin: number;
  courseId?: number;
  lessonId?: number;
  questionsCount?: number;
}

export interface ExamQuestion {
  id: number;
  examId: number;
  text: string;
  type?: 'mcq' | 'true_false';
  choices?: string[]; // Array of choice texts
  correctIndex: number;
  explanation?: string | null;
  choiceExplanations?: string[] | null;
  imageUrl?: string | null;
  points: number;
  
  // Frontend specific helper fields
  options?: string[]; // Used in forms
  isTrue?: boolean; // Used in forms
}

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/admin/exams';

  getExams(params?: any): Observable<{ success: boolean; data: Exam[] }> {
    return this.http.get<{ success: boolean; data: Exam[] }>(this.apiUrl, { params });
  }

  getExam(id: number): Observable<{ success: boolean; data: Exam }> {
    return this.http.get<{ success: boolean; data: Exam }>(`${this.apiUrl}/${id}`);
  }

  createExam(data: any): Observable<{ success: boolean; data: { id: number } }> {
    return this.http.post<{ success: boolean; data: { id: number } }>(this.apiUrl, data);
  }

  updateExam(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteExam(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Questions
  getQuestions(examId: number): Observable<{ success: boolean; data: ExamQuestion[] }> {
    return this.http.get<{ success: boolean; data: ExamQuestion[] }>(`${this.apiUrl}/${examId}/questions`);
  }

  getAllQuestions(params?: any): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/questions/all`, { params });
  }

  addQuestion(examId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${examId}/questions`, data);
  }

  updateQuestion(examId: number, questionId: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${examId}/questions/${questionId}`, data);
  }

  deleteQuestion(examId: number, questionId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${examId}/questions/${questionId}`);
  }

  getExamReport(id: number): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/${id}/report`);
  }
}
