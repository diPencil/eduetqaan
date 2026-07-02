export type UserRole = 'admin' | 'supervisor' | 'center_manager' | 'support' | 'user';

export interface AdminUser {
  id: number;
  email: string;
  role: UserRole;
  centerId?: number | null;
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  data?: AdminUser;
}

export interface UserMeResponse {
  success: boolean;
  me: {
    id: number;
    email: string;
    role: string;
    centerId?: number | null;
    iat: number;
    exp: number;
  };
}
