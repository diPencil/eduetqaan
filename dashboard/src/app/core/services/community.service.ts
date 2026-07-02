import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Attachment {
  kind: string;
  url: string;
  title?: string;
  mime?: string;
  provider?: string;
}

export interface CommunityAnswer {
  id: number;
  questionId: number;
  responderId: number;
  responderRole: string;
  contentText?: string;
  attachments?: Attachment[];
  createdAt: string;
  responder?: {
    name: string;
    email: string;
    role: string;
  };
}

export interface CommunityQuestion {
  id: number;
  studentId: number;
  body: string;
  imageUrl?: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  student?: {
    studentName: string;
    year: string;
  };
  answersCount?: number;
  lastAnswerByName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/community';

  getQuestions(params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/questions`, { params });
  }

  getQuestionDetails(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/questions/${id}`);
  }

  addAnswer(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/questions/${id}/answers`, data);
  }

  updateStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/questions/${id}/status`, { status });
  }

  deleteQuestion(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/questions/${id}`);
  }
}
