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

import { SongResponse } from '../../../core/models/song/res-song.model';

interface SongRow {
  /** videoId với bài Youtube (player phát theo videoId), id DB với bài upload */
  id: string | number;
  dbSongId: number;
  songId: number;
  name: string;
  artist: string;
  duration: number;
  imgUrl?: string;
  views: number;
  url: string;
  isLiked?: boolean;
  albumIds?: number[];
  videoId: string | null;
  sourceType?: number;
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
   * Chỉ query DB (nhạc đã được admin đồng bộ từ Youtube), không gọi Youtube nữa.
   * `append` distinguishes infinite-scroll loads (add to the list) from a fresh keyword/page-1 load (replace it).
   */
  loadSongs(append = false): void {
    const kw = this.keyword().trim();

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

    this.songService.searchPublicSongs({
      page: this.page(),
      pageSize: PAGE_SIZE,
      searchParams: {
        keyword: kw
      }
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          let items: SongRow[] = (res.data ?? []).map(
            (s: SongResponse) => this.mapSong(s)
          );

          // Reorder/autoplay only makes sense on the first load, not on appended infinite-scroll pages.
          const hId = !append ? this.highlightId() : null;

          if (hId) {
            const idx = items.findIndex(x => String(x.id) === hId);

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
            const selected = items.find(x => String(x.id) === hId);

            if (selected) {
              this.player.setQueue(this.songs(), { autoAdvance: false });
              this.play(selected);
            }
          }
        },

        error: () => {
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
        }
      });
  }

  playSong(id: string | number): void {
    const song = this.songs().find(x => x.id === id);
    if (!song) return;

    this.player.setQueue(this.songs(), { autoAdvance: false });
    this.play(song);
  }

  private play(song: SongRow): void {
    if (song.videoId) {
      this.player.playYoutubeSong(song.id as string);
      return;
    }

    this.player.playSong(song.id as number);
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

  private mapSong(s: SongResponse): SongRow {
    const isYoutube = s.sourceType === 3 || !!s.youtubeVideoId;

    return {
      id: isYoutube ? s.youtubeVideoId! : s.id,
      dbSongId: s.id,
      songId: s.id,
      videoId: isYoutube ? s.youtubeVideoId! : null,
      sourceType: s.sourceType,
      name: s.title,
      artist: s.artistName ?? '',
      duration: s.duration ?? 0,
      imgUrl: s.imgUrl || undefined,
      views: s.views ?? 0,
      url: isYoutube ? '' : s.fileUrl,
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
