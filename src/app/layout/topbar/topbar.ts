

import {
  Component,
  HostListener,
  inject,
  signal,
  OnDestroy,
  OnInit
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  LucideAngularModule,
  User,
  ChevronDown,
  Settings
} from 'lucide-angular';

import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of
} from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { SongService } from '../../core/services/song.service';
import { SongResponse } from '../../core/models/song/res-song.model';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.html',
  imports: [
    RouterLink,
    LucideAngularModule,
    CommonModule,
    FormsModule
  ]
})
export class TopbarComponent implements OnDestroy, OnInit {

  private router = inject(Router);
  public authService = inject(AuthService);
  private songService = inject(SongService);

  readonly UserIcon = User;
  readonly ChevronDownIcon = ChevronDown;
  readonly SettingsIcon = Settings;

  openMenu = signal(false);

  searchQuery = signal('');
  suggestions = signal<SongResponse[]>([]);

  showDropdown = signal(false);
  isSearching = signal(false);

  private searchSubject = new Subject<string>();

  private sub = this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(keyword => {
      const kw = keyword.trim();

      if (!kw) {
        this.suggestions.set([]);
        this.showDropdown.set(false);
        this.isSearching.set(false);

        return of(null);
      }

      this.isSearching.set(true);

      // Chỉ query DB (nhạc đã đồng bộ), không gọi Youtube
      return this.songService.searchPublicSongs({
        page: 1,
        pageSize: 5,
        searchParams: {
          keyword: kw
        }
      });
    })
  ).subscribe({
    next: res => {
      this.isSearching.set(false);

      if (!res) return;

      const items = res.data ?? [];

      this.suggestions.set(items);
      this.showDropdown.set(items.length > 0);
    },
    error: () => {
      this.isSearching.set(false);
      this.suggestions.set([]);
      this.showDropdown.set(false);
    }
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;

    this.searchQuery.set(val);
    this.searchSubject.next(val);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const kw = this.searchQuery().trim();

      if (kw) {
        this.goToPlaylistWithKeyword(kw);
      }
    }

    if (event.key === 'Escape') {
      this.closeSearch();
    }
  }

  selectSuggestion(item: SongResponse): void {
    this.showDropdown.set(false);

    this.router.navigate(
      ['/users/discover'],
      {
        queryParams: {
          keyword: this.searchQuery(),
          highlightId: item.youtubeVideoId || item.id
        }
      }
    );
  }

  goToPlaylistWithKeyword(keyword: string): void {
    const kw = keyword.trim();

    if (!kw) return;

    this.showDropdown.set(false);

    this.router.navigate(
      ['/users/discover'],
      {
        queryParams: {
          keyword: kw
        }
      }
    );
  }

  closeSearch(): void {
    this.showDropdown.set(false);
  }

  get displayName(): string {
    const user = this.authService.user();

    return (
      user?.profile?.fullName ||
      user?.username ||
      ''
    );
  }

  get profileUri(): string | null {
    return this.authService.user()?.profile?.uri ?? null;
  }

  loadProfile(): void {
    if (!this.authService.user()) return;

    this.authService.getCurrentUser().subscribe(res => {
      const uri = res.data?.profile?.uri ?? null;

      const current = this.authService.user();

      if (!current?.profile) return;

      this.authService.user.set({
        ...current,
        profile: {
          ...current.profile,
          uri
        }
      });
    });
  }

  toggleMenu(): void {
    this.openMenu.update(v => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenu.set(false);
    this.showDropdown.set(false);
  }

  goRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  goProfile(): void {
    this.router.navigate(['/setting/profile']);
    this.openMenu.set(false);
  }
}