import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router'
import { AuthService } from './core/services/auth.service';
import { ToastComponent } from './shared/components/toast/toast';
import { PopupComponent } from './shared/components/popup/popup';
import { UserService } from './core/services/user.service';
import { ChatHubService } from './core/services/chat-hub.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, PopupComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private chatHubService = inject(ChatHubService);
  private router = inject(Router);
  protected readonly title = signal('MusicEmolite');

  ngOnInit(): void {
    const token = this.authService.getToken();
    if (!token) return;
    this.authService.getCurrentUser().subscribe({
      next: (res: any) => {
        // user signal is set by getCurrentUser() itself; token is gone if userAreaGuard just kicked an admin out.
        // Admin area has no chat - skip the hub + conversations call.
        if (this.authService.getToken() && !res.data?.roleCode?.includes('ADMIN')) this.chatHubService.start();
      },
      error: () => {
        this.authService.logout();
        this.router.navigate([location.pathname.startsWith('/admin') ? '/admin/emolite/login' : '/auth/login']);
      }
    });
    this.userService.getUserProfile().subscribe();
  }
}
