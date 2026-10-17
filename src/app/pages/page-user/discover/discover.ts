import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { PlayerService } from '../../../core/services/player.service';
import { SongService } from '../../../core/services/song.service';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { PAGINATION_USER } from '../../../core/constants/pagination.constants';

import { YoutubeVideoResponse } from '../../../core/models/youtube/youtube-res.model';

interface SongRow {
  /** videoId - player phát theo videoId */
  id: string;
  /** id DB nếu bài đã được đồng bộ, null nếu chưa có trong DB */
  dbSongId: number | null;
  songId: number | null;
  name: string;
  artist: string;
  /** Gửi kèm khi play để BE tạo/cập nhật ảnh nghệ sĩ */
  channelThumbnail?: string;
  duration: number;
  imgUrl?: string;
  views: number;
  url: string;
  isLiked?: boolean;
  albumIds?: number[];
  videoId: string;
}

/**
 * Local, not PAGINATION_USER.DEFAULT_PAGE_SIZE - kept independent so tuning
 * this page's page size never silently affects another page that happens to
 * share the constant.
 */
const PAGE_SIZE = 50;

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    CommonModule,
    InfiniteScrollDirective
  ],
  templateUrl: './discover.html',
})
export class DiscoverComponent implements OnInit, OnDestroy {

  player = inject(PlayerService);

  private songService = inject(SongService);
  private route = inject(ActivatedRoute);

  private destroy$ = new Subject<void>();
  songs = signal<SongRow[]>([]);
  isLoading = signal(false);
  isLoadingMore = signal(false);

  keyword = signal('');
  errorMessage = signal('');
  highlightId = signal<string | null>(null);

  page = signal(PAGINATION_USER.DEFAULT_PAGE);
  totalPages = signal(1);

  hasMore = computed(() => this.page() < this.totalPages());

  currentTrackId = computed(
    () => this.player.currentTrack()?.id ?? null
  );

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.keyword.set(params['keyword'] ?? '');

        this.highlightId.set(
          params['highlightId'] ?? null
        );

        this.page.set(PAGINATION_USER.DEFAULT_PAGE);

        this.loadSongs();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMore(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;

    this.page.update(p => p + 1);
    this.loadSongs(true);
  }

  /**
   * Tìm thẳng trên Youtube (BE cache theo keyword + chặn khi hết quota) - dữ liệu đồng bộ trong DB không đủ để tìm bài.
   * `append` distinguishes infinite-scroll loads (add to the list) from a fresh keyword/page-1 load (replace it).
   */
  loadSongs(append = false): void {
    const kw = this.keyword().trim();
    if (!append) this.errorMessage.set('');

    if (!kw) {
      this.songs.set([]);
      this.totalPages.set(1);
      return;
    }

    if (append) {
      this.isLoadingMore.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.songService.searchYoutube({ page: this.page(), pageSize: PAGE_SIZE, searchParams: { keyword: kw } })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.code === '429' && !append) this.errorMessage.set('Hệ thống tìm kiếm đang quá tải, vui lòng thử lại sau ít phút');

          let items: SongRow[] = (res.data ?? []).map(s => this.mapYoutubeSong(s));

          // Reorder/autoplay only makes sense on the first load, not on appended infinite-scroll pages.
          const hId = !append ? this.highlightId() : null;

          if (hId) {
            const idx = items.findIndex(x => x.id === hId);

            if (idx > 0) {
              const [selected] = items.splice(idx, 1);
              items.unshift(selected);
            }
          }

          this.totalPages.set(res.totalPages || 1);

          if (append) {
            this.songs.update(list => [...list, ...items]);
            this.isLoadingMore.set(false);
          } else {
            this.songs.set(items);
            this.isLoading.set(false);
          }

          if (hId) {
            const selected = items.find(x => x.id === hId);

            if (selected) {
              this.player.setQueue(this.songs(), { autoAdvance: false });
              this.player.playYoutubeSong(selected.id);
            }
          }
        },

        error: () => {
          if (!append) this.errorMessage.set('Không tìm kiếm được, vui lòng thử lại');
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
        }
      });
  }

  playSong(id: string): void {
    this.player.setQueue(this.songs(), { autoAdvance: false });
    this.player.playYoutubeSong(id);
  }

  formatViews(v: number): string {
    if (v == null) return '0';

    if (v >= 1_000_000_000) {
      return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }

    if (v >= 1_000_000) {
      return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }

    if (v >= 1_000) {
      return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }

    return v.toString();
  }

  private mapYoutubeSong(s: YoutubeVideoResponse): SongRow {
    return {
      id: s.videoId,
      dbSongId: s.songId ?? null,
      songId: s.songId ?? null,
      videoId: s.videoId,
      name: s.title,
      artist: s.channel,
      channelThumbnail: s.channelThumbnail,
      duration: s.duration ?? 0,
      imgUrl: s.thumbnailMedium || s.thumbnailHigh || s.thumbnailDefault || s.thumbnailStandard || s.thumbnailMaxres,
      views: s.views ?? 0,
      url: '',
      isLiked: s.isLiked ?? false,
      albumIds: s.albumIds ?? []
    };
  }

  formatDuration(sec: number): string {
    if (!sec) return '--:--';

    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);

    return `${m}:${s < 10 ? '0' + s : s}`;
  }

}
