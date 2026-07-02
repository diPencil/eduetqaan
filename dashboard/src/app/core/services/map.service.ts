import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MapBank {
  id: number;
  title: string;
  level: string;
  mapImageUrl: string;
  status: 'draft' | 'published';
  orderIndex: number;
  createdAtLocal?: string;
  updatedAtLocal?: string;
}

export interface MapItem {
  id: number;
  bankId: number;
  markerNumber: number;
  prompt: string;
  answerText?: string;
  tags?: string[];
  status: 'draft' | 'published';
  orderIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/map-faq';

  // Banks
  getBanks(params?: any): Observable<{ success: boolean, data: MapBank[] }> {
    return this.http.get<{ success: boolean, data: MapBank[] }>(`${this.apiUrl}/banks`, { params });
  }

  getBank(id: number): Observable<{ success: boolean, data: { bank: MapBank, items: MapItem[] } }> {
    return this.http.get<{ success: boolean, data: { bank: MapBank, items: MapItem[] } }>(`${this.apiUrl}/banks/${id}`);
  }

  createBank(formData: FormData): Observable<{ success: boolean, data: MapBank }> {
    return this.http.post<{ success: boolean, data: MapBank }>(`${this.apiUrl}/banks`, formData);
  }

  updateBank(id: number, data: any): Observable<{ success: boolean, data: MapBank }> {
    return this.http.patch<{ success: boolean, data: MapBank }>(`${this.apiUrl}/banks/${id}`, data);
  }

  deleteBank(id: number): Observable<{ success: boolean, message: string }> {
    return this.http.delete<{ success: boolean, message: string }>(`${this.apiUrl}/banks/${id}`);
  }

  // Items
  createItem(bankId: number, data: any): Observable<{ success: boolean, data: MapItem }> {
    return this.http.post<{ success: boolean, data: MapItem }>(`${this.apiUrl}/banks/${bankId}/items`, data);
  }

  updateItem(bankId: number, itemId: number, data: any): Observable<{ success: boolean, data: MapItem }> {
    return this.http.patch<{ success: boolean, data: MapItem }>(`${this.apiUrl}/banks/${bankId}/items/${itemId}`, data);
  }

  deleteItem(bankId: number, itemId: number): Observable<{ success: boolean, message: string }> {
    return this.http.delete<{ success: boolean, message: string }>(`${this.apiUrl}/banks/${bankId}/items/${itemId}`);
  }
}
