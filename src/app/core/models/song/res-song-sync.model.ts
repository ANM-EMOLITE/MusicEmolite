export type SongSyncStage = 'idle' | 'fetching' | 'saving' | 'lyrics' | 'done' | 'failed';

export interface SongSyncStatus {
  isRunning: boolean;
  stage: SongSyncStage;
  startedAt?: string;
  finishedAt?: string;
  fetched: number;
  filtered: number;
  duplicated: number;
  inserted: number;
  lyricsTotal: number;
  lyricsProcessed: number;
  lyricsFound: number;
  /** Bước con đang chạy, vd: "Quét kênh nghệ sĩ 35/400" */
  detail?: string;
  message?: string;
}
