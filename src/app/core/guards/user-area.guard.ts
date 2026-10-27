import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CurrentUserResponse } from '../models/auth/res-current-user.model';

const isAdmin = (user: CurrentUserResponse | null): boolean => (user?.roleCode ?? '').includes('ADMIN');

/**
 * Keeps admin sessions out of the user area: an admin token is logged out and sent back
 * to the login page. Guests and normal users pass straight through (the user area is public).
 */
export const userAreaGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const kickAdmin = () => {
    authService.logout();
    return router.createUrlTree(['/auth/login']);
  };

  const currentUser = authService.user();
  if (currentUser) return isAdmin(currentUser) ? kickAdmin() : true;

  if (!authService.getToken()) return true;

  return authService.getCurrentUser().pipe(
    map(res => isAdmin(res.data ?? null) ? kickAdmin() : true),
    catchError(() => of(true))
  );
};
