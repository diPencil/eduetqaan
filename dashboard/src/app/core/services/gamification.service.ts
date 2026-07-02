import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GamificationSettings {
  id?: number;
  isActive: boolean;
  pointsPerEgp: number;
  pointsForFullMark: number;
  pointsForVideoComplete: number;
  pointsForAttendance: number;
  pointToEgpRatio: number;
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getSettings(): Observable<{ success: boolean; data: GamificationSettings }> {
    return this.http.get<{ success: boolean; data: GamificationSettings }>(`${this.apiUrl}/gamification/settings`);
  }

  updateSettings(settings: Partial<GamificationSettings>): Observable<{ success: boolean; data: GamificationSettings; message?: string }> {
    return this.http.patch<{ success: boolean; data: GamificationSettings; message?: string }>(`${this.apiUrl}/gamification/settings`, settings);
  }
}
