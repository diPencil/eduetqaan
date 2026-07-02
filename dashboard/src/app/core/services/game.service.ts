import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TrueFalseQuestion {
  id: number;
  text: string;
  isTrue: boolean;
  level?: string;
  isActive: boolean;
}

export interface McqQuestion {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  level?: string;
  isActive: boolean;
}

export interface FlipCardCountry {
  id: number;
  code: string;
  name: string;
  flagEmoji?: string;
  isActive: boolean;
}

export interface FlipCardQuestion extends McqQuestion {
  countryId: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/games';

  // --- True/False ---
  getTrueFalseQuestions(params?: any): Observable<{ success: boolean; data: TrueFalseQuestion[] }> {
    return this.http.get<{ success: boolean; data: TrueFalseQuestion[] }>(`${this.apiUrl}/true-false/admin/questions`, { params });
  }
  createTrueFalseQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/true-false/admin/questions`, data);
  }
  updateTrueFalseQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/true-false/admin/questions/${id}`, data);
  }
  deleteTrueFalseQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/true-false/admin/questions/${id}`);
  }

  // --- MCQ Rush ---
  getMcqQuestions(params?: any): Observable<{ success: boolean; data: McqQuestion[] }> {
    return this.http.get<{ success: boolean; data: McqQuestion[] }>(`${this.apiUrl}/mcq-rush/admin/questions`, { params });
  }
  createMcqQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/mcq-rush/admin/questions`, data);
  }
  updateMcqQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/mcq-rush/admin/questions/${id}`, data);
  }
  deleteMcqQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mcq-rush/admin/questions/${id}`);
  }

  // --- Fast Answer ---
  getFastAnswerQuestions(params?: any): Observable<{ success: boolean; data: McqQuestion[] }> {
    return this.http.get<{ success: boolean; data: McqQuestion[] }>(`${this.apiUrl}/fast-answer/admin/questions`, { params });
  }
  createFastAnswerQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/fast-answer/admin/questions`, data);
  }
  updateFastAnswerQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/fast-answer/admin/questions/${id}`, data);
  }
  deleteFastAnswerQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/fast-answer/admin/questions/${id}`);
  }

  // --- Flip Card (Countries) ---
  getFlipCountries(): Observable<{ success: boolean; data: FlipCardCountry[] }> {
    return this.http.get<{ success: boolean; data: FlipCardCountry[] }>(`${this.apiUrl}/flip-card/admin/countries`);
  }
  createFlipCountry(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/flip-card/admin/countries`, data);
  }
  updateFlipCountry(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/flip-card/admin/countries/${id}`, data);
  }
  deleteFlipCountry(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/flip-card/admin/countries/${id}`);
  }

  // --- Flip Card (Questions) ---
  getFlipQuestions(params?: any): Observable<{ success: boolean; data: FlipCardQuestion[] }> {
    return this.http.get<{ success: boolean; data: FlipCardQuestion[] }>(`${this.apiUrl}/flip-card/admin/questions`, { params });
  }
  createFlipQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/flip-card/admin/questions`, data);
  }
  updateFlipQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/flip-card/admin/questions/${id}`, data);
  }
  deleteFlipQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/flip-card/admin/questions/${id}`);
  }

  // --- Battle Friend ---
  getBattleFriendQuestions(params?: any): Observable<{ success: boolean; data: McqQuestion[] }> {
    return this.http.get<{ success: boolean; data: McqQuestion[] }>(`${this.apiUrl}/battle-friend/admin/questions`, { params });
  }
  createBattleFriendQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/battle-friend/admin/questions`, data);
  }
  updateBattleFriendQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/battle-friend/admin/questions/${id}`, data);
  }
  deleteBattleFriendQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/battle-friend/admin/questions/${id}`);
  }

  // --- Team Battle ---
  getTeamBattleQuestions(params?: any): Observable<{ success: boolean; data: McqQuestion[] }> {
    return this.http.get<{ success: boolean; data: McqQuestion[] }>(`${this.apiUrl}/team-battle/admin/questions`, { params });
  }
  createTeamBattleQuestion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/team-battle/admin/questions`, data);
  }
  updateTeamBattleQuestion(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/team-battle/admin/questions/${id}`, data);
  }
  deleteTeamBattleQuestion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/team-battle/admin/questions/${id}`);
  }
}
