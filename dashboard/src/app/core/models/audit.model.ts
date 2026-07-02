export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  VIEW = 'VIEW',
  ATTEND = 'ATTEND',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  SUBSCRIBE = 'SUBSCRIBE'
}

export enum AuditEntityType {
  STUDENT = 'STUDENT',
  USER = 'USER',
  ATTENDANCE = 'ATTENDANCE',
  WALLET = 'WALLET',
  PAYMENT = 'PAYMENT',
  COURSE = 'COURSE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SYSTEM = 'SYSTEM',
  EXAM = 'EXAM',
  CENTER = 'CENTER'
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | number;
  entityName?: string;
  userId: string | number;
  userName: string;
  userRole: string;
  details: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date | string;
}

export interface AuditLogFilters {
  action?: AuditAction;
  entityType?: AuditEntityType;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  userId?: string | number;
  page?: number;
  limit?: number;
}
