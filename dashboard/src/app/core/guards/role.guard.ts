import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../interfaces/auth.interface';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  let user = authService.currentUser();
  const expectedRoles = route.data['roles'] as UserRole[];

  // Fallback: extract role directly from the JWT token if currentUser is not yet loaded
  if (!user && authService.getToken()) {
    try {
      const token = authService.getToken()!;
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      user = { role: payload.role } as any;
    } catch (e) {
      console.error('Failed to parse role from token in guard', e);
    }
  }

  // If user is admin, allow everything
  if (user?.role === 'admin') {
    return true;
  }

  // Check if user role is in expected roles
  if (user && expectedRoles && expectedRoles.includes(user.role)) {
    return true;
  }

  // Not authorized, redirect to dashboard
  console.warn(`Access denied for role: ${user?.role} to path: ${state.url}`);
  router.navigate(['/dashboard']);
  return false;
};
