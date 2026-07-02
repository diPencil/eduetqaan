import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLog, AuditAction, AuditEntityType, AuditLogFilters } from '../models/audit.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private http = inject(HttpClient);
  private authService = inject(AuthService); // Assuming there's an auth service to get current user
  
  // MOCK STATE for Phase 3 Execution
  private mockLogs = signal<AuditLog[]>(this.generateMockLogs());
  private useMock = true; // TODO: Switch to false when backend API is ready

  constructor() {}

  /**
   * Core method to create an audit log
   */
  createLog(
    action: AuditAction, 
    entityType: AuditEntityType, 
    details: string, 
    entityId?: string | number, 
    entityName?: string, 
    metadata?: any
  ): Observable<AuditLog> {
    
    // Fallback user info if authService doesn't provide it yet
    const currentUser = this.authService.currentUser() || { id: 'sys', name: 'System', role: 'ADMIN' };
    
    const newLog: AuditLog = {
      id: Math.random().toString(36).substring(2, 11),
      action,
      entityType,
      entityId,
      entityName,
      userId: currentUser.id,
      userName: (currentUser as any).name,
      userRole: currentUser.role,
      details,
      metadata,
      createdAt: new Date().toISOString()
    };

    if (this.useMock) {
      this.mockLogs.update(logs => [newLog, ...logs]);
      return of(newLog).pipe(delay(300));
    }

    return this.http.post<AuditLog>(`${environment.apiUrl}/audit-logs`, newLog);
  }

  getLogs(filters: AuditLogFilters): Observable<{ data: AuditLog[], total: number }> {
    if (this.useMock) {
      let filtered = this.mockLogs();
      
      if (filters.action) {
        filtered = filtered.filter(l => l.action === filters.action);
      }
      if (filters.entityType) {
        filtered = filtered.filter(l => l.entityType === filters.entityType);
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(l => 
          l.details.toLowerCase().includes(term) || 
          l.userName.toLowerCase().includes(term) ||
          (l.entityName && l.entityName.toLowerCase().includes(term))
        );
      }
      
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      
      return of({ data: paginated, total: filtered.length }).pipe(delay(500));
    }
    
    return this.http.get<{ data: AuditLog[], total: number }>(`${environment.apiUrl}/audit-logs`, { params: { ...filters } as any });
  }

  // --- Specific Action Loggers ---

  logStudentAction(action: AuditAction, studentId: string | number, studentName: string, details: string) {
    return this.createLog(action, AuditEntityType.STUDENT, details, studentId, studentName).subscribe();
  }

  logPaymentAction(studentId: string | number, amount: number, details: string) {
    return this.createLog(AuditAction.PAYMENT, AuditEntityType.PAYMENT, details, studentId, `Payment ${amount}`, { amount }).subscribe();
  }

  logAttendanceAction(studentId: string | number, lessonId: string | number, details: string) {
    return this.createLog(AuditAction.ATTEND, AuditEntityType.ATTENDANCE, details, studentId, `Lesson ${lessonId}`).subscribe();
  }

  logUserAction(action: AuditAction, targetUserId: string | number, targetUserName: string, details: string) {
    return this.createLog(action, AuditEntityType.USER, details, targetUserId, targetUserName).subscribe();
  }

  logSubscriptionAction(studentId: string | number, courseId: string | number, details: string) {
    return this.createLog(AuditAction.SUBSCRIBE, AuditEntityType.SUBSCRIPTION, details, studentId, `Course ${courseId}`).subscribe();
  }

  // Generate some initial mock data to test the UI
  private generateMockLogs(): AuditLog[] {
    return [
      {
        id: '1', action: AuditAction.LOGIN, entityType: AuditEntityType.SYSTEM, userId: 'admin1', userName: 'أحمد جابر', userRole: 'ADMIN', details: 'تسجيل دخول ناجح', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        id: '2', action: AuditAction.UPDATE, entityType: AuditEntityType.STUDENT, entityId: '105', entityName: 'محمد أحمد', userId: 'admin1', userName: 'أحمد جابر', userRole: 'ADMIN', details: 'تحديث رقم هاتف الطالب', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
      },
      {
        id: '3', action: AuditAction.PAYMENT, entityType: AuditEntityType.WALLET, entityId: '105', entityName: 'محمد أحمد', userId: 'sec1', userName: 'سكرتير 1', userRole: 'SECRETARY', details: 'شحن محفظة بـ 200 جنية', metadata: { amount: 200 }, createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
      }
    ];
  }
}
