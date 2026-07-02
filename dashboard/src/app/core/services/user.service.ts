import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { UserRole } from '../interfaces/auth.interface';

export interface AdminUser {
  id: number;
  email: string;
  role: UserRole;
  isActive: boolean;
  centerId?: number | null;
  createdAtLocal?: string;
  updatedAtLocal?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1/users';

  getUsers(): Observable<{ success: boolean; data: AdminUser[] }> {
    return this.http.get<{ success: boolean; data: AdminUser[] }>(this.apiUrl);
  }

  createUser(data: Partial<AdminUser> & { password?: string }): Observable<{ success: boolean; data: AdminUser }> {
    return this.http.post<{ success: boolean; data: AdminUser }>(this.apiUrl, data);
  }

  updateUser(id: number, data: Partial<AdminUser>): Observable<{ success: boolean; data: AdminUser }> {
    return this.http.patch<{ success: boolean; data: AdminUser }>(`${this.apiUrl}/${id}`, data);
  }

  deleteUser(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`);
  }
}
