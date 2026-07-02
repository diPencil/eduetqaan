import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FaqItem {
  id: number;
  questionText: string;
  answerText?: string;
  category?: string;
  level?: string;
  status: 'draft' | 'published';
  orderIndex: number;
  attachments?: any[];
  updatedAtLocal?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FaqService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/faq';

  getFaqs(params?: any): Observable<{ success: boolean, data: FaqItem[], pagination: any }> {
    return this.http.get<{ success: boolean, data: FaqItem[], pagination: any }>(this.apiUrl, { params });
  }

  getFaq(id: number): Observable<{ success: boolean, data: FaqItem }> {
    return this.http.get<{ success: boolean, data: FaqItem }>(`${this.apiUrl}/${id}`);
  }

  createFaq(data: any): Observable<{ success: boolean, data: FaqItem }> {
    return this.http.post<{ success: boolean, data: FaqItem }>(this.apiUrl, data);
  }

  updateFaq(id: number, data: any): Observable<{ success: boolean, data: FaqItem }> {
    return this.http.patch<{ success: boolean, data: FaqItem }>(`${this.apiUrl}/${id}`, data);
  }

  deleteFaq(id: number): Observable<{ success: boolean, message: string }> {
    return this.http.delete<{ success: boolean, message: string }>(`${this.apiUrl}/${id}`);
  }
}
