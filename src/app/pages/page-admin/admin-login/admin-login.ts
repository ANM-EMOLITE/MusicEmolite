import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-admin-login',
    imports: [FormsModule],
    templateUrl: './admin-login.html'
})
export class AdminLoginComponent {

    private authService = inject(AuthService);
    private router = inject(Router);

    showPassword = signal(false);
    loading = this.authService.loading;
    errorMessage = signal('');

    form = { userName: '', password: '' };

    togglePassword() {
        this.showPassword.update(v => !v);
    }

    login() {
        this.errorMessage.set('');
        if (!this.form.userName.trim() || !this.form.password.trim()) return this.errorMessage.set('Vui lòng nhập đầy đủ thông tin');

        this.authService.login(this.form).subscribe({
            next: (res: any) => {
                const data = res?.data;
                if (res?.code !== '200' || !data?.accessToken) return this.errorMessage.set(res?.message || 'Lỗi hệ thống');

                this.authService.setToken(data.accessToken);
                if (data.refreshToken) this.authService.setRefreshToken(data.refreshToken);

                this.authService.getCurrentUser().subscribe({
                    next: userRes => {
                        if (!(userRes?.data?.roleCode ?? '').includes('ADMIN')) {
                            this.authService.logout();
                            return this.errorMessage.set('Tài khoản không có quyền quản trị');
                        }
                        this.router.navigate(['/admin/dashboard']);
                    },
                    error: () => this.errorMessage.set('Lỗi hệ thống')
                });
            },
            error: err => this.errorMessage.set(err?.error?.message || err?.error?.title || err?.message || 'Lỗi hệ thống')
        });
    }
}
