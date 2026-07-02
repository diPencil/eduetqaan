import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { AuthResponse, AdminUser, UserMeResponse, UserRole } from '../interfaces/auth.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  // Base URL for the API
  private apiUrl = environment.apiUrl;

  // State using signals
  currentUser = signal<AdminUser | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor() {
    this.checkInitialAuth();
  }

  private checkInitialAuth() {
    const token = localStorage.getItem('admin_token');
    if (token) {
      this.isAuthenticated.set(true);
      // We could also do a /me call here to verify token and get user data
      this.getMe().subscribe();
    }
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/users/login`, credentials).pipe(
      tap(res => {
        if (res.success && res.token) {
          localStorage.setItem('admin_token', res.token);
          if (res.data) {
            this.currentUser.set(res.data);
          }
          this.isAuthenticated.set(true);
        }
      })
    );
  }

  getMe(): Observable<boolean> {
    return this.http.get<UserMeResponse>(`${this.apiUrl}/users/me`).pipe(
      map(res => {
        if (res.success && res.me) {
          this.currentUser.set({
            id: res.me.id,
            email: res.me.email,
            role: res.me.role as UserRole,
            centerId: res.me.centerId,
            isActive: true
          });
          this.isAuthenticated.set(true);
          return true;
        }
        return false;
      }),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  logout() {
    localStorage.removeItem('admin_token');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('admin_token');
  }
}
