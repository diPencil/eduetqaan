import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SelfQuizChapter {
  id: number;
  title: string;
  gradeLevel: string;
  orderIndex: number;
  secureId?: string;
}

export interface SelfQuizChoice {
  id?: number;
  questionId?: number;
  label: string;
  imageUrl?: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface SelfQuizQuestion {
  id?: number;
  chapterId?: number;
  body: string;
  imageUrl?: string;
  explanation?: string;
  orderIndex: number;
  choices: SelfQuizChoice[];
}

@Injectable({
  providedIn: 'root'
})
export class SelfQuizService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/self-quiz';

  // Chapters
  getChapters(gradeLevel?: string): Observable<any> {
    const params: any = {};
    if (gradeLevel) params.gradeLevel = gradeLevel;
    return this.http.get<any>(`${this.apiUrl}/chapters`, { params });
  }

  createChapter(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/chapters`, data);
  }

  // Questions & Choices (Admin)
  getChapterQuestions(chapterId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chapters/${chapterId}/questions`);
  }

  createQuestionBulk(chapterId: number, questions: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/chapters/${chapterId}/questions/bulk`, { questions });
  }

  updateQuestion(id: number, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/questions/${id}`, data);
  }

  deleteQuestion(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/questions/${id}`);
  }
}
