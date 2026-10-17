import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../../core/services/auth.service";
import { Router } from "@angular/router";
import { AuthBackgroundComponent } from "../../../shared/components/auth-background/auth-background";

@Component({
    selector: 'app-login',
    imports: [CommonModule, FormsModule, AuthBackgroundComponent],
    templateUrl: './login.html'
})
export class LoginComponent {

    private authService = inject(AuthService);
    private router = inject(Router);

    showPassword = signal(false);
    loading = this.authService.loading;
    errorMessage = signal('');

    form = {
        userName: '',
        password: ''
    };

    togglePassword() {
        this.showPassword.update(v => !v);
    }

    login() {
        this.errorMessage.set('');
        if (!this.form.userName.trim() || !this.form.password.trim()) {
            this.errorMessage.set('Vui lòng nhập đầy đủ thông tin');
            return;
        }
        this.authService.login(this.form).subscribe({
            next: (res: any) => {
                if (res?.code !== '200') {
                    this.errorMessage.set(
                        res?.message || 'Lỗi hệ thống'
                    );
                    return;
                }

                const data = res?.data;
                if (!data?.accessToken) {
                    this.errorMessage.set('Lỗi hệ thống');
                    return;
                }
                this.authService.setToken(data.accessToken);
                if (data.refreshToken) {
                    this.authService.setRefreshToken(data.refreshToken);
                }
                this.authService.getCurrentUser().subscribe({
                    next: (userRes: any) => {
                        const user = userRes?.data;
                        this.authService.user.set(user ?? null);
                        const roleCode = user?.roleCode ?? '';
                        if (roleCode.includes('ADMIN')) return this.rejectAdmin();

                        if (roleCode.includes('USER')) {
                            this.router.navigate(['/users/home']);
                            return;
                        }

                        this.errorMessage.set(
                            'Không xác định được quyền tài khoản'
                        );
                    },

                    error: () => {
                        this.errorMessage.set(
                            'Lỗi hệ thống'
                        );
                    }
                });
            },

            error: (err) => {
                const message =
                    err?.error?.message ||
                    err?.error?.title ||
                    err?.message ||
                    'Lỗi hệ thống';

                this.errorMessage.set(message);
            }
        });
    }

    /** Admin accounts may only sign in through the dedicated admin login route. */
    private rejectAdmin() {
        this.authService.logout();
        this.errorMessage.set('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    loginWithGoogle() {
        this.errorMessage.set('');
        this.authService.loginWithGoogle().subscribe({
            next: (res: any) => {
                if (res?.code !== '200') {
                    this.errorMessage.set(res?.message || 'Lỗi hệ thống');
                    return;
                }

                const data = res?.data;
                if (!data?.accessToken) {
                    this.errorMessage.set('Lỗi hệ thống');
                    return;
                }

                this.authService.setToken(data.accessToken);
                if (data.refreshToken) {
                    this.authService.setRefreshToken(data.refreshToken);
                }

                if (data.isNewUser) {
                    this.router.navigate(['/auth/welcome'], {
                        state: {
                            googleName: data.googleName,
                            googlePicture: data.googlePicture
                        }
                    });
                    return;
                }

                this.authService.getCurrentUser().subscribe({
                    next: (userRes: any) => {
                        const user = userRes?.data;
                        this.authService.user.set(user ?? null);
                        const roleCode = user?.roleCode ?? '';

                        if (roleCode.includes('ADMIN')) return this.rejectAdmin();

                        if (roleCode.includes('USER')) {
                            this.router.navigate(['/users/home']);
                            return;
                        }

                        this.errorMessage.set('Không xác định được quyền tài khoản');
                    },
                    error: () => {
                        this.errorMessage.set('Lỗi hệ thống');
                    }
                });
            },
            error: () => {
                this.errorMessage.set('Đăng nhập Google thất bại');
            }
        });
    }
}