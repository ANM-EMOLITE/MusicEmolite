import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const AUTH_ENDPOINTS_WITHOUT_RETRY = [
  '/auth/login',
  '/auth/login-google',
  '/auth/register',
  '/auth/refresh-token'
];

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const skipRetry = AUTH_ENDPOINTS_WITHOUT_RETRY.some(url => req.url.includes(url));

      if (error.status !== 401 || skipRetry || !authService.getRefreshToken()) {
        return throwError(() => error);
      }

      return authService.refreshToken().pipe(
        switchMap(res => {
          const newToken = res?.data?.accessToken;

          if (!newToken) {
            return throwError(() => error);
          }

          const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
          return next(retryReq);
        }),
        catchError(refreshError => {
          authService.logout();
          router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
