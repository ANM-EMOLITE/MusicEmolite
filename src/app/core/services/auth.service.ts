import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, finalize, shareReplay, throwError } from 'rxjs';
import { API_SERVICE } from './commons/api.service';
import { API_END } from '../constants/api-end.constants';
import { LoginRequest } from '../models/auth/req-login.model';
import { LoginResponse } from '../models/auth/res-login.model';
import { RegisterRequest } from '../models/auth/req-register.model';
import { RegisterResponse } from '../models/auth/res-register.model';
import { CurrentUserResponse } from '../models/auth/res-current-user.model';
import { BaseResponse } from '../models/base/base-res.model';
import { SendOtpRequest } from '../models/auth/req-send-otp.model';
import { VerifyOtpRequest } from '../models/auth/req-verify-otp.model';
import { ResetPasswordRequest } from '../models/auth/req-reset-password.model';
import { ChangePasswordRequest } from '../models/auth/req-change-password.model';
import { RefreshTokenRequest } from '../models/auth/req-refresh-token.model';
import { RefreshTokenResponse } from '../models/auth/res-refresh-token.model';
import { LogoutRequest } from '../models/auth/req-logout.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private api = inject(API_SERVICE);
  private TOKEN_KEY = 'token';
  private REFRESH_TOKEN_KEY = 'refreshToken';
  private refreshInProgress$: Observable<BaseResponse<RefreshTokenResponse>> | null = null;
  private currentUserInProgress$: Observable<BaseResponse<CurrentUserResponse>> | null = null;
  user = signal<CurrentUserResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  isPremium = computed(() =>
    this.user()?.userType === 'Premium'
  );

  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');

    return !!token;
  }

  getCurrentUser(): Observable<BaseResponse<CurrentUserResponse>> {
    if (!this.currentUserInProgress$) {
      this.currentUserInProgress$ = this.api.getData<BaseResponse<CurrentUserResponse>>(API_END.AUTH.CURRENT_USER).pipe(
        tap(res => this.user.set(res?.data ?? null)),
        finalize(() => this.currentUserInProgress$ = null),
        shareReplay(1)
      );
    }

    return this.currentUserInProgress$;
  }

  setToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  setRefreshToken(token: string) {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  clearRefreshToken() {
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  refreshToken(): Observable<BaseResponse<RefreshTokenResponse>> {
    const token = this.getRefreshToken();

    if (!token) {
      return throwError(() => new Error('No refresh token'));
    }

    if (!this.refreshInProgress$) {
      this.refreshInProgress$ = this.api.postData<BaseResponse<RefreshTokenResponse>, RefreshTokenRequest>(
        API_END.AUTH.REFRESH_TOKEN,
        { refreshToken: token }
      ).pipe(
        tap(res => {
          if (res?.data?.accessToken) {
            this.setToken(res.data.accessToken);
          }
          if (res?.data?.refreshToken) {
            this.setRefreshToken(res.data.refreshToken);
          }
        }),
        finalize(() => {
          this.refreshInProgress$ = null;
        }),
        shareReplay(1)
      );
    }

    return this.refreshInProgress$;
  }

  /**
   * Clears local session state immediately and best-effort invalidates the
   * session server-side so the refresh token can't be reused afterwards.
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();

    this.clearToken();
    this.clearRefreshToken();
    this.user.set(null);

    if (refreshToken) {
      this.api.postData<BaseResponse<boolean>, LogoutRequest>(
        API_END.AUTH.LOGOUT,
        { refreshToken }
      ).subscribe({ error: () => {} });
    }
  }

  login(payload: LoginRequest) {
    this.loading.set(true);
    this.error.set(null);

    return this.api.postData<BaseResponse<LoginResponse>, LoginRequest>(
      API_END.AUTH.LOGIN,
      payload
    ).pipe(
      tap({
        next: () => {
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Login failed');
          this.loading.set(false);
        }
      })
    );
  }

  register(payload: RegisterRequest) {
    this.loading.set(true);
    this.error.set(null);

    return this.api.postData<BaseResponse<RegisterResponse>, RegisterRequest>(
      API_END.AUTH.REGISTER,
      payload
    ).pipe(
      tap({
        next: () => {
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Register failed');
          this.loading.set(false);
        }
      })
    );
  }

  completeProfile(payload: any) {
    return this.api.postData<BaseResponse<boolean>, any>(
      API_END.AUTH.COMPLETE_PROFILE,
      payload
    );
  }

  checkEmail(email: string) {
    return this.api.getData<BaseResponse<boolean>>(
      `${API_END.AUTH.CHECK_EMAIL}?email=${email}`
    );
  }

  checkUsername(username: string) {
    return this.api.getData<BaseResponse<boolean>>(
      `${API_END.AUTH.CHECK_USERNAME}?username=${username}`
    );
  }

  checkIp(ipAddress: string) {
    return this.api.getData<BaseResponse<boolean>>(
      `${API_END.AUTH.CHECK_IP}?ipAddress=${ipAddress}`
    );
  }

  sendOtp(email: string, purpose: string) {
    return this.api.postData<BaseResponse<boolean>, SendOtpRequest>(
      API_END.OTP.SEND,
      { email, purpose }
    );
  }

  verifyOtp(email: string, code: string, purpose: string) {
    return this.api.postData<BaseResponse<boolean>, VerifyOtpRequest>(
      API_END.OTP.VERIFY,
      { email, code, purpose }
    );
  }

  resetPassword(payload: ResetPasswordRequest) {
    return this.api.postData<BaseResponse<boolean>, ResetPasswordRequest>(
      API_END.AUTH.RESET_PASSWORD,
      payload
    );
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.api.postData<BaseResponse<boolean>, ChangePasswordRequest>(
      API_END.AUTH.CHANGE_PASSWORD,
      payload
    );
  }

  loginWithGoogle(): Observable<any> {
    this.loading.set(true);
    this.error.set(null);

    return new Observable(observer => {
      const google = (window as any).google;

      if (!google) {
        this.loading.set(false);
        observer.error('Google SDK chưa load');
        return;
      }

      google.accounts.id.initialize({
        client_id: '721913068181-vthg768rcefrt046vlhnad1t4gqq1uk0.apps.googleusercontent.com',
        callback: (response: any) => {
          const idToken = response.credential;

          if (!idToken) {
            this.loading.set(false);
            observer.error('Không lấy được token từ Google');
            return;
          }

          this.api.postData<BaseResponse<LoginResponse>, { idToken: string }>(
            API_END.AUTH.LOGIN_WITH_GG,
            { idToken }
          ).pipe(
            tap({
              next: () => this.loading.set(false),
              error: (err) => {
                this.error.set(err?.error?.message || 'Google login failed');
                this.loading.set(false);
              }
            })
          ).subscribe(observer);
        }
      });

      google.accounts.id.prompt();
    });
  }
}