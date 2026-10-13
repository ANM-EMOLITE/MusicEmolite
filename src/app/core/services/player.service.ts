import { Injectable, NgZone, inject, signal } from '@angular/core';
import { debounceTime, distinctUntilChanged, forkJoin, Subject } from 'rxjs';
import { SongService } from './song.service';
import { AlbumService } from './album.service';
import { AuthService } from './auth.service';
import { AlbumResponse } from '../models/album/res-album.model';
import { BaseSearchDto } from '../models/base/base-search.model';
import { AlbumRequest } from '../models/album/req-album.model';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private songService = inject(SongService);
  private albumService = inject(AlbumService);
  private authService = inject(AuthService);
  private zone = inject(NgZone);

  private audio = new Audio();
  private queue: any[] = [];
  private currentIndex = -1;

  private isDraggingVolume = false;
  private volumeBarRef: HTMLElement | null = null;

  private hasAddedHistory = false;
  private hasIncrementedView = false;
  private listenedSeconds = 0;
  private lastTime = 0;

  private youtubePlayer: any = null;
  private youtubeReady = false;
  private youtubeTimer: ReturnType<typeof setInterval> | null = null;
  private pendingYoutubeVideoId: string | null = null;

  currentTrack = signal<any>(null);
  isPlaying = signal(false);
  isShuffle = signal(false);
  isRepeat = signal(false);
  isLiked = signal(false);
  isDetailOpen = signal(false);
  currentTime = signal('0:00');
  duration = signal('0:00');
  progressPercent = signal(0);
  volume = signal(100);
  isMuted = signal(false);
  isPlayerHidden = signal(false);
  currentTimeRaw = signal(0);

  isYoutubeMode = signal(false);
  youtubeVideoId = signal<string | null>(null);
  private autoAdvance = true;

  queueList = signal<any[]>([]);
  currentQueueIndex = signal(-1);
  showQueuePanel = signal(false);

  showLoginMessage = signal(false);

  showAddToAlbum = signal(false);
  selectedAlbumIds = signal<number[]>([]);
  albumList = signal<AlbumResponse[]>([]);
  selectedSongAlbumIds = signal<number[]>([]);
  albumKeyword = signal('');
  isAddingToAlbum = signal(false);

  private albumSearch$ = new Subject<string>();

  constructor() {
    this.initAudioEvents();
    this.initYoutubePlayer();
    this.initMediaSession();
    this.initVisibilityResume();

    this.albumSearch$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(keyword => this.fetchAlbums(keyword));
  }

  /**
   * Mobile browsers can silently pause playback (especially the embedded
   * YouTube iframe) while the tab is backgrounded, without ever calling our
   * own pause handlers - so `isPlaying` stays true while the underlying
   * player is actually stopped. When the tab becomes visible again, check
   * for that mismatch and resume so the user doesn't come back to silence.
   */
  private initVisibilityResume() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.isPlaying()) return;

      this.zone.run(() => {
        if (this.isYoutubeMode()) {
          const state = this.youtubePlayer?.getPlayerState?.();

          if (this.youtubePlayer && state !== window.YT?.PlayerState?.PLAYING) {
            this.youtubePlayer.playVideo();
            this.startYoutubeTimer();
          }

          return;
        }

        if (this.audio.src && this.audio.paused) {
          this.audio.play();
        }
      });
    });
  }

  private initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
  }

  /**
   * Lock-screen/notification media controls are a Premium perk; free
   * accounts still keep playing in the background, they just don't get
   * OS-level playback controls for it.
   */
  private updateMediaSession(track: any) {
    if (!('mediaSession' in navigator)) return;

    if (!this.authService.isPremium()) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.name ?? '',
      artist: track?.artist ?? '',
      artwork: track?.imgUrl
        ? [{ src: track.imgUrl, sizes: '512x512', type: 'image/png' }]
        : []
    });

    this.syncPlaybackState();
  }

  private syncPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    if (!this.authService.isPremium()) return;

    navigator.mediaSession.playbackState = this.isPlaying() ? 'playing' : 'paused';
  }

  togglePlayerBar() {
    this.isPlayerHidden.update(v => !v);
  }

  openDetail() {
    this.isDetailOpen.set(true);
  }

  closeDetail() {
    this.isDetailOpen.set(false);
  }

  closeLoginMessage() {
    this.showLoginMessage.set(false);
  }

  openAddToAlbum() {
    const current = this.currentTrack();
    if (!current?.dbSongId) return;

    this.selectedSongAlbumIds.set(current.albumIds ?? []);
    this.selectedAlbumIds.set([]);
    this.albumKeyword.set('');
    this.showAddToAlbum.set(true);

    this.fetchAlbums('');
  }

  closeAddToAlbum() {
    if (this.isAddingToAlbum()) return;

    this.showAddToAlbum.set(false);
    this.selectedAlbumIds.set([]);
  }

  selectAlbum(album: AlbumResponse) {
    if (this.selectedSongAlbumIds().includes(album.id) || this.isAddingToAlbum()) return;

    this.selectedAlbumIds.update(ids =>
      ids.includes(album.id) ? ids.filter(id => id !== album.id) : [...ids, album.id]
    );
  }

  onAlbumSearch(event: Event) {
    const keyword = (event.target as HTMLInputElement).value;

    this.albumKeyword.set(keyword);
    this.albumSearch$.next(keyword);
  }

  private fetchAlbums(keyword: string) {
    const payload: BaseSearchDto<AlbumRequest> = {
      page: 1,
      pageSize: 20,
      asc: false,
      searchParams: { keyword }
    };

    this.albumService.searchAlbums(payload).subscribe(res => {
      this.albumList.set(res.data ?? []);
    });
  }

  confirmAddToAlbum() {
    const songId = this.currentTrack()?.dbSongId;
    const albumIds = this.selectedAlbumIds();

    if (!songId || albumIds.length === 0) return;

    this.isAddingToAlbum.set(true);

    forkJoin(
      albumIds.map(albumId => this.songService.addSongToAlbum(songId, albumId))
    ).subscribe({
      next: () => {
        this.isAddingToAlbum.set(false);

        this.currentTrack.update((track: any) => ({
          ...track,
          albumIds: [...new Set([...(track.albumIds ?? []), ...albumIds])]
        }));

        this.showAddToAlbum.set(false);
        this.selectedAlbumIds.set([]);
      },
      error: () => {
        this.isAddingToAlbum.set(false);
      }
    });
  }

  startVolumeDrag(event: MouseEvent) {
    this.isDraggingVolume = true;
    this.volumeBarRef = event.currentTarget as HTMLElement;
    this.updateVolume(event.clientX);

    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  private onDocumentMouseMove = (event: MouseEvent) => {
    if (!this.isDraggingVolume || !this.volumeBarRef) return;
    this.zone.run(() => this.updateVolume(event.clientX));
  };

  private onDocumentMouseUp = () => {
    this.isDraggingVolume = false;
    this.volumeBarRef = null;

    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  };

  private updateVolume(clientX: number) {
    if (!this.volumeBarRef) return;

    const rect = this.volumeBarRef.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const volume = Math.round(percent * 100);

    this.volume.set(volume);
    this.audio.volume = percent;

    if (this.youtubePlayer) {
      this.youtubePlayer.setVolume(volume);
    }
  }

  setVolume(event: MouseEvent) {
    this.volumeBarRef = event.currentTarget as HTMLElement;
    this.updateVolume(event.clientX);
  }

  setQueue(queue: any[], options?: { autoAdvance?: boolean }) {
    this.queue = queue;
    this.queueList.set(queue);
    this.autoAdvance = options?.autoAdvance ?? true;
  }

  private setCurrentIndex(index: number) {
    this.currentIndex = index;
    this.currentQueueIndex.set(index);
  }

  toggleQueuePanel() {
    this.showQueuePanel.update(v => !v);
  }

  closeQueuePanel() {
    this.showQueuePanel.set(false);
  }

  playFromQueue(index: number) {
    if (index < 0 || index >= this.queue.length) return;

    this.setCurrentIndex(index);
    this.playCurrentTrack();
    this.closeQueuePanel();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';

    this.stopYoutubeTimer();

    if (this.youtubePlayer) {
      this.youtubePlayer.stopVideo();
    }

    this.isYoutubeMode.set(false);
    this.youtubeVideoId.set(null);
    this.pendingYoutubeVideoId = null;

    this.currentTrack.set(null);
    this.queue = [];
    this.queueList.set([]);
    this.setCurrentIndex(-1);

    this.isPlaying.set(false);
    this.currentTime.set('0:00');
    this.duration.set('0:00');
    this.currentTimeRaw.set(0);
    this.progressPercent.set(0);
  }

  playSong(id: number) {
    const current = this.currentTrack();

    if (current?.id === id && !this.isYoutubeMode()) {
      this.togglePlay();
      return;
    }

    const index = this.queue.findIndex(x => x.id === id);
    if (index === -1) return;

    this.setCurrentIndex(index);
    this.startTrack(this.queue[index]);
  }

  playYoutubeSong(id: string) {
    const current = this.currentTrack();

    if (current?.id === id && this.isYoutubeMode()) {
      this.togglePlay();
      return;
    }

    const index = this.queue.findIndex(x => x.id === id);
    if (index === -1) return;

    this.setCurrentIndex(index);

    const track = this.queue[index];

    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';

    this.hasAddedHistory = false;
    this.hasIncrementedView = false;
    this.listenedSeconds = 0;
    this.lastTime = 0;

    this.isYoutubeMode.set(true);
    this.youtubeVideoId.set(track.videoId);

    this.currentTrack.set({
      ...track,
      dbSongId: track.dbSongId ?? null,
      isLiked: track.isLiked ?? false,
      syncedLyrics: []
    });

    this.isLiked.set(track.isLiked ?? false);

    this.isPlaying.set(true);
    this.currentTime.set('0:00');
    this.duration.set(track.duration ? this.formatTime(track.duration) : '--:--');
    this.currentTimeRaw.set(0);
    this.progressPercent.set(0);

    this.updateMediaSession(this.currentTrack());

    this.addYoutubeHistory(track);
    this.loadYoutubeVideo(track.videoId);
    this.loadYoutubeLyrics(track);
  }

  /**
   * Bài đã có trong DB (vd: được admin đồng bộ) thì dùng lyrics lưu sẵn trong DB;
   * chưa có lyrics thì mới tìm trên LRCLIB như cũ.
   */
  private loadYoutubeLyrics(track: any) {
    const dbSongId = track.dbSongId ?? track.songId;

    if (!dbSongId) {
      this.fetchLyrics(track.id, track.name, track.artist);
      return;
    }

    this.songService.getSongDetail(dbSongId).subscribe({
      next: res => {
        const detail = res.data;
        const current = this.currentTrack();
        if (!current || current.id !== track.id) return;

        if (detail?.syncedLyrics?.length || detail?.lyrics) {
          this.currentTrack.update((t: any) => ({
            ...t,
            syncedLyrics: detail.syncedLyrics ?? [],
            lyrics: detail.lyrics ?? t.lyrics
          }));
          return;
        }

        this.fetchLyrics(track.id, track.name, track.artist);
      },
      error: () => this.fetchLyrics(track.id, track.name, track.artist)
    });
  }

  private fetchLyrics(trackId: string | number, title: string, artist: string) {
    if (!title) return;

    // Ưu tiên tìm lyrics trong album EMOLITE_MUSIC trước.
    this.songService.searchLyrics({
      page: 1,
      pageSize: 20,
      searchParams: { query: title, artist, album: 'EMOLITE_MUSIC' }
    }).subscribe({
      next: res => {
        const results = res.data ?? [];

        if (results.length > 0) {
          this.applyLyrics(trackId, artist, results);
          return;
        }

        // Không có kết quả trong album EMOLITE_MUSIC -> gọi lại bỏ tham số album.
        this.fetchLyricsFallback(trackId, title, artist);
      },
      error: () => {
        this.fetchLyricsFallback(trackId, title, artist);
      }
    });
  }

  private fetchLyricsFallback(trackId: string | number, title: string, artist: string) {
    this.songService.searchLyrics({
      page: 1,
      pageSize: 20,
      searchParams: { query: title, artist }
    }).subscribe({
      next: res => {
        const results = res.data ?? [];
        this.applyLyrics(trackId, artist, results);
      },
      error: () => {
        // No lyrics available for this track - keep syncedLyrics empty.
      }
    });
  }

  private applyLyrics(trackId: string | number, artist: string, results: any[]) {
    const current = this.currentTrack();
    if (!current || current.id !== trackId) return;

    const lyrics = results.find(
      r => r.artist?.toLowerCase() === artist?.toLowerCase()
    ) ?? results[0];

    this.currentTrack.update((track: any) => ({
      ...track,
      syncedLyrics: lyrics?.syncedLyrics ?? [],
      lyrics: lyrics?.lyrics ?? track.lyrics
    }));
  }

  private addYoutubeHistory(track: any) {
    if (this.hasAddedHistory || !this.authService.isLoggedIn()) return;

    this.hasAddedHistory = true;

    this.songService
      .addSongHistory({
        videoId: track.videoId,
        title: track.name,
        channel: track.artist,
        channelThumbnail: track.channelThumbnail ?? '',
        thumbnailHigh: track.imgUrl ?? '',
        duration: track.duration ?? 0
      })
      .subscribe({
        next: (res: any) => {
          const song = res.data;
          if (!song?.id) return;

          const currentLiked = this.currentTrack()?.isLiked ?? track.isLiked ?? false;

          this.currentTrack.update((current: any) => ({
            ...current,
            dbSongId: song.id,
            views: song.views ?? current.views ?? 0,
            likes: song.likes ?? current.likes ?? 0,
            isLiked: currentLiked,
            youtubeVideoId: song.youtubeVideoId,
            playCount: song.playCount,
            sourceType: song.sourceType,
            albumIds: song.albumIds ?? current.albumIds ?? []
          }));

          this.isLiked.set(currentLiked);
        }
      });
  }

  private startTrack(track: any) {
    this.stopYoutubeTimer();

    if (this.youtubePlayer) {
      this.youtubePlayer.stopVideo();
    }

    this.isYoutubeMode.set(false);
    this.youtubeVideoId.set(null);
    this.pendingYoutubeVideoId = null;

    this.hasAddedHistory = false;
    this.hasIncrementedView = false;
    this.listenedSeconds = 0;
    this.lastTime = 0;

    this.songService.getSongDetail(track.id).subscribe(res => {
      const detail = res.data;

      this.currentTrack.set({
        ...track,
        dbSongId: track.id,
        isLiked: detail?.isLiked ?? false,
        imgUrl: detail?.imgUrl,
        releaseDate: detail?.releaseDate,
        syncedLyrics: detail?.syncedLyrics ?? [],
        albumIds: detail?.albumIds ?? [],
      });

      this.isLiked.set(detail?.isLiked ?? false);

      this.audio.src = track.url;
      this.audio.load();
      this.audio.play();

      this.isPlaying.set(true);
      this.updateMediaSession(this.currentTrack());

      if (!this.hasAddedHistory && this.authService.isLoggedIn()) {
        this.hasAddedHistory = true;

        this.songService
          .addSongHistory(track.id)
          .subscribe();
      }
    });
  }

  togglePlay() {
    if (this.isYoutubeMode()) {
      if (!this.youtubePlayer) return;

      const state = this.youtubePlayer.getPlayerState?.();

      if (state === window.YT?.PlayerState?.PLAYING) {
        this.youtubePlayer.pauseVideo();
        this.isPlaying.set(false);
        this.syncPlaybackState();
        return;
      }

      this.youtubePlayer.playVideo();
      this.isPlaying.set(true);
      this.syncPlaybackState();
      this.startYoutubeTimer();
      return;
    }

    if (!this.audio.src) return;

    if (this.audio.paused) {
      this.audio.play();
      this.isPlaying.set(true);
    } else {
      this.audio.pause();
      this.isPlaying.set(false);
    }

    this.syncPlaybackState();
  }

  toggleLike() {
    if (!this.authService.isLoggedIn()) {
      this.showLoginMessage.set(true);
      return;
    }

    const current = this.currentTrack();
    if (!current) return;

    const songId = this.isYoutubeMode()
      ? current.dbSongId
      : current.id;

    if (!songId) return;

    this.songService.toggleLike(songId).subscribe((res: any) => {
      const data = res.data;
      const liked = data?.isLiked ?? !this.isLiked();

      this.isLiked.set(liked);

      this.currentTrack.update((track: any) => ({
        ...track,
        isLiked: liked,
        likes: data?.likes ?? track.likes
      }));
    });
  }

  nextTrack() {
    if (!this.queue.length) return;

    if (this.isShuffle()) {
      this.setCurrentIndex(Math.floor(Math.random() * this.queue.length));
    } else {
      this.setCurrentIndex(
        this.currentIndex + 1 >= this.queue.length ? 0 : this.currentIndex + 1
      );
    }

    this.playCurrentTrack();
  }

  prevTrack() {
    if (!this.queue.length) return;

    this.setCurrentIndex(
      this.currentIndex - 1 < 0 ? this.queue.length - 1 : this.currentIndex - 1
    );

    this.playCurrentTrack();
  }

  private playCurrentTrack() {
    const track = this.queue[this.currentIndex];
    if (!track) return;

    if (track.videoId) {
      this.playYoutubeSong(track.id);
      return;
    }

    this.startTrack(track);
  }

  seek(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    if (this.isYoutubeMode()) {
      if (!this.youtubePlayer) return;

      const duration = this.youtubePlayer.getDuration?.() ?? 0;
      if (!duration) return;

      this.youtubePlayer.seekTo(percent * duration, true);
      this.syncYoutubeProgress();
      return;
    }

    if (!this.audio.duration) return;

    this.audio.currentTime = percent * this.audio.duration;
  }

  toggleMute() {
    this.isMuted.set(!this.isMuted());

    this.audio.muted = this.isMuted();

    if (!this.youtubePlayer) return;

    if (this.isMuted()) {
      this.youtubePlayer.mute();
    } else {
      this.youtubePlayer.unMute();
    }
  }

  toggleShuffle() {
    this.isShuffle.set(!this.isShuffle());
  }

  toggleRepeat() {
    this.isRepeat.set(!this.isRepeat());
  }

  private initAudioEvents() {
    this.audio.ontimeupdate = () => {
      this.zone.run(() => {
        if (this.isYoutubeMode()) return;

        const current = this.audio.currentTime;

        const delta = current - this.lastTime;
        if (delta > 0 && delta < 2) {
          this.listenedSeconds += delta;
        }

        this.lastTime = current;

        this.currentTimeRaw.set(current);
        this.currentTime.set(this.formatTime(current));

        if (this.audio.duration) {
          this.progressPercent.set((current / this.audio.duration) * 100);

          const listenedPercent = (this.listenedSeconds / this.audio.duration) * 100;

          if (!this.hasIncrementedView && listenedPercent >= 70 && this.authService.isLoggedIn()) {
            this.hasIncrementedView = true;

            const currentTrack = this.currentTrack();

            if (currentTrack?.id) {
              this.songService
                .incrementView(currentTrack.id)
                .subscribe((res: any) => {
                  const data = res.data;
                  if (!data) return;

                  this.currentTrack.update((track: any) => ({
                    ...track,
                    views: data.views ?? track.views
                  }));
                });
            }
          }
        }
      });
    };

    this.audio.onloadedmetadata = () => {
      this.zone.run(() => {
        if (this.isYoutubeMode()) return;
        this.duration.set(this.formatTime(this.audio.duration));
      });
    };

    this.audio.onended = () => {
      this.zone.run(() => {
        if (this.isYoutubeMode()) return;

        if (this.isRepeat()) {
          this.audio.currentTime = 0;
          this.audio.play();
        } else {
          if (this.autoAdvance && this.currentIndex + 1 < this.queue.length) {
            this.nextTrack();
          } else {
            this.isPlaying.set(false);
          }
        }
      });
    };

    this.audio.onerror = () => {
      this.zone.run(() => {
        if (this.isYoutubeMode() || !this.audio.src) return;

        this.isPlaying.set(false);

        if (this.autoAdvance && this.currentIndex + 1 < this.queue.length) {
          this.nextTrack();
        }
      });
    };
  }

  private initYoutubePlayer() {
    const existing = document.getElementById('hidden-youtube-player');

    if (!existing) {
      const host = document.createElement('div');
      host.id = 'hidden-youtube-player';
      host.style.position = 'fixed';
      host.style.width = '1px';
      host.style.height = '1px';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      // Kept inside the real viewport (not off-screen at -9999px) - some
      // mobile browsers treat an off-screen iframe as "not visible" and
      // suspend its playback more aggressively in the background than one
      // that's technically on-screen (just invisible via opacity).
      host.style.left = '0';
      host.style.top = '0';

      document.body.appendChild(host);
    }

    const createPlayer = () => {
      this.youtubePlayer = new window.YT.Player('hidden-youtube-player', {
        width: '1',
        height: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            this.zone.run(() => {
              this.youtubeReady = true;
              this.youtubePlayer.setVolume(this.volume());

              if (this.pendingYoutubeVideoId) {
                this.loadYoutubeVideo(this.pendingYoutubeVideoId);
              }
            });
          },
          onStateChange: (event: any) => {
            this.zone.run(() => this.handleYoutubeStateChange(event.data));
          },
          onError: (event: any) => {
            this.zone.run(() => this.handleYoutubeError(event.data));
          }
        }
      });
    };

    if (window.YT?.Player) {
      createPlayer();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }

  private loadYoutubeVideo(videoId: string) {
    if (!videoId) return;

    if (!this.youtubeReady || !this.youtubePlayer) {
      this.pendingYoutubeVideoId = videoId;
      return;
    }

    this.pendingYoutubeVideoId = null;

    this.youtubePlayer.loadVideoById(videoId);
    this.youtubePlayer.setVolume(this.volume());

    if (this.isMuted()) {
      this.youtubePlayer.mute();
    } else {
      this.youtubePlayer.unMute();
    }

    this.startYoutubeTimer();
  }

  private handleYoutubeStateChange(state: number) {
    if (!this.isYoutubeMode()) return;

    if (state === window.YT.PlayerState.PLAYING) {
      this.isPlaying.set(true);
      this.syncPlaybackState();
      this.startYoutubeTimer();
      return;
    }

    if (state === window.YT.PlayerState.PAUSED) {
      this.isPlaying.set(false);
      this.syncPlaybackState();
      return;
    }

    if (state === window.YT.PlayerState.ENDED) {
      this.stopYoutubeTimer();

      if (this.isRepeat()) {
        this.youtubePlayer.seekTo(0, true);
        this.youtubePlayer.playVideo();
        this.startYoutubeTimer();
        return;
      }

      if (this.autoAdvance && this.currentIndex + 1 < this.queue.length) {
        this.nextTrack();
      } else {
        this.isPlaying.set(false);
      }
    }
  }

  private handleYoutubeError(_code: number) {
    if (!this.isYoutubeMode()) return;

    this.stopYoutubeTimer();
    this.isPlaying.set(false);

    if (this.autoAdvance && this.currentIndex + 1 < this.queue.length) {
      this.nextTrack();
    }
  }

  private startYoutubeTimer() {
    if (this.youtubeTimer) return;

    this.youtubeTimer = setInterval(() => {
      this.zone.run(() => this.syncYoutubeProgress());
    }, 300);
  }

  private stopYoutubeTimer() {
    if (!this.youtubeTimer) return;

    clearInterval(this.youtubeTimer);
    this.youtubeTimer = null;
  }

  private syncYoutubeProgress() {
    if (!this.isYoutubeMode() || !this.youtubePlayer) return;

    const current = this.youtubePlayer.getCurrentTime?.() ?? 0;
    const duration = this.youtubePlayer.getDuration?.() ?? 0;

    const delta = current - this.lastTime;
    if (delta > 0 && delta < 2) {
      this.listenedSeconds += delta;
    }

    this.lastTime = current;

    this.currentTimeRaw.set(current);
    this.currentTime.set(this.formatTime(current));

    if (duration) {
      this.duration.set(this.formatTime(duration));
      this.progressPercent.set((current / duration) * 100);

      const listenedPercent = (this.listenedSeconds / duration) * 100;

      if (!this.hasIncrementedView && listenedPercent >= 70 && this.authService.isLoggedIn()) {
        this.hasIncrementedView = true;

        const currentTrack = this.currentTrack();
        const songId = currentTrack?.dbSongId;

        if (songId) {
          this.songService
            .incrementView(songId)
            .subscribe((res: any) => {
              const data = res.data;
              if (!data) return;

              this.currentTrack.update((track: any) => ({
                ...track,
                views: data.views ?? track.views
              }));
            });
        }
      }
    }
  }

  private formatTime(sec: number) {
    if (!sec) return '0:00';

    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);

    return `${m}:${s < 10 ? '0' + s : s}`;
  }
}