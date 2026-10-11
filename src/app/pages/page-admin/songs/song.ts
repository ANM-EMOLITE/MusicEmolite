import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';

import { AppTableComponent } from '../../../shared/components/table/table';
import { TableColumn } from '../../../core/models/front-end/table/table-column.model';
import { SongService } from '../../../core/services/song.service';
import { SongResponse } from '../../../core/models/song/res-song.model';
import { PAGINATION } from '../../../core/constants/pagination.constants';
import { FilterComponent } from '../../../shared/components/filter/filter';
import { FilterField } from '../../../core/models/front-end/filter/filter-field.model';
import { SongRequest } from '../../../core/models/song/req-song.model';
import { DetailPanelComponent } from '../../../shared/components/detail-panel/detail-panel';
import { ToastService } from '../../../core/services/toast.service';
import { SongSyncStatus } from '../../../core/models/song/res-song-sync.model';

@Component({
    selector: 'app-songs',
    standalone: true,
    imports: [
        CommonModule,
        AppTableComponent,
        FilterComponent,
        DetailPanelComponent
    ],
    templateUrl: './songs.html'
})
export class Songs {

    private songService = inject(SongService);
    private toast = inject(ToastService);
    private destroyRef = inject(DestroyRef);

    private readonly SYNC_POLL_MS = 3000;
    private syncTimer: ReturnType<typeof setInterval> | null = null;
    syncStatus = signal<SongSyncStatus | null>(null);

    selectedSong = signal<any | null>(null);

    loading = signal(false);
    sortBy = signal('createdAt');

    asc = signal(false);
    rows = signal<any[]>([]);
    currentPage = signal(PAGINATION.DEFAULT_PAGE);
    totalPages = signal(PAGINATION.DEFAULT_PAGE);
    totalRecords = signal(0);
    pageSize = signal(20);
    filter = signal<SongRequest>({
        keyword: ''
    });

    filterFields: FilterField[] = [
        {
            key: 'keyword',
            label: 'Từ khóa',
            type: 'text',
            placeholder: 'Nhập tên bài hát...'
        },

        {
            key: 'isActived',
            label: 'Trạng thái',
            type: 'select',
            options: [
                {
                    label: 'Hoạt động',
                    value: 'true'
                },
                {
                    label: 'Không hoạt động',
                    value: 'false'
                }
            ]
        }
    ];

    columns: TableColumn[] = [
        {
            key: 'stt',
            label: 'STT',
            width: '80px',
            align: 'center'
        },
        {
            key: 'imgUrl',
            label: 'Ảnh',
            type: 'image',
            width: '100px',
            align: 'left'
        },
        {
            key: 'title',
            label: 'Tên bài hát'
        },
        {
            key: 'artistName',
            label: 'Nghệ sĩ'
        },
        {
            key: 'views',
            label: 'Lượt xem',
            align: 'center',
            sortable: true
        },
        {
            key: 'likes',
            label: 'Lượt thích',
            align: 'center',
            sortable: true
        },
        {
            key: 'typeSong',
            label: 'Loại',
            align: 'center'
        },
        {
            key: 'isActived',
            label: 'Trạng thái',
            type: 'status',
            align: 'center'
        },
        {
            key: 'createdAt',
            label: 'Ngày tạo',
            type: 'date',
            sortable: true
        }
    ];

    ngOnInit(): void {
        this.loadSongs();
        // Nếu đang có lần đồng bộ chạy dở (vd: reload trang) thì hiện tiếp tiến độ
        this.checkSyncStatus();
        this.destroyRef.onDestroy(() => this.stopSyncPolling());
    }

    startSync() {
        if (this.syncStatus()?.isRunning) return;

        this.songService.startSyncAdmin().subscribe({
            next: (res) => {
                if (res?.data) this.syncStatus.set(res.data);

                if (res?.data?.isRunning) {
                    this.startSyncPolling();
                } else {
                    this.toast.error(res?.message || 'Không thể bắt đầu đồng bộ');
                }
            },
            error: () => this.toast.error('Không thể bắt đầu đồng bộ')
        });
    }

    private checkSyncStatus() {
        this.songService.getSyncStatusAdmin().subscribe({
            next: (res) => {
                const status = res?.data;
                if (!status) return;

                const wasRunning = this.syncStatus()?.isRunning;
                this.syncStatus.set(status);

                if (status.isRunning) {
                    this.startSyncPolling();
                    return;
                }

                this.stopSyncPolling();

                if (wasRunning) {
                    if (status.stage === 'failed') {
                        this.toast.error(status.message || 'Đồng bộ thất bại');
                    } else {
                        this.toast.success(`Đồng bộ xong: thêm ${status.inserted} bài, ${status.lyricsFound} bài có lyrics`);
                    }
                    this.loadSongs();
                }
            }
        });
    }

    private startSyncPolling() {
        if (this.syncTimer) return;
        this.syncTimer = setInterval(() => this.checkSyncStatus(), this.SYNC_POLL_MS);
    }

    private stopSyncPolling() {
        if (!this.syncTimer) return;
        clearInterval(this.syncTimer);
        this.syncTimer = null;
    }

    syncStageLabel(status: SongSyncStatus): string {
        switch (status.stage) {
            case 'fetching': return `Đang lấy nhạc từ YouTube (${status.fetched} video)`;
            case 'saving': return `Đang lưu bài mới (${status.inserted} bài)`;
            case 'lyrics': return `Đang tìm lyrics (${status.lyricsProcessed}/${status.lyricsTotal})`;
            case 'done': return 'Đồng bộ hoàn tất';
            case 'failed': return 'Đồng bộ thất bại';
            default: return '';
        }
    }

    loadSongs() {

        this.loading.set(true);

        this.songService.searchSongsAdmin({
            page: this.currentPage(),
            pageSize: this.pageSize(),
            asc: this.asc(),
            searchParams: {
                ...this.filter(),
                sortBy: this.sortBy()
            }
        })
            .subscribe({
                next: (res: any) => {
                    const data: SongResponse[] = res?.data ?? [];
                    const mapped = data.map((item, index) => ({
                        ...item,
                        stt:
                            ((this.currentPage() - 1) * this.pageSize())
                            + index
                            + 1
                    }));
                    this.rows.set(mapped);
                    this.totalPages.set(
                        res?.totalPages ?? PAGINATION.DEFAULT_PAGE
                    );
                    this.totalRecords.set(res?.totalRecords ?? 0);
                    this.loading.set(false);
                },

                error: (err) => {
                    console.log(err);
                    this.loading.set(false);
                }
            });
    }

    onFilterChange(data: any) {

        this.currentPage.set(1);

        this.filter.set({
            ...data,

            isActived:
                data.isActived === ''
                    ? undefined
                    : data.isActived === 'true'
        });

        this.loadSongs();
    }
    onPageChange(page: number) {
        this.currentPage.set(page);
        this.loadSongs();
    }

    onPageSizeChange(size: number) {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.loadSongs();
    }

    onRowClick(row: any) {
        console.log(row);
    }

    onRowDblClick(row: any) {
        this.selectedSong.set(row);
    }

    closeDetail() {
        this.selectedSong.set(null);
    }

    onSort(column: string) {

        if (this.sortBy() === column) {

            this.asc.set(!this.asc());
        }
        else {

            this.sortBy.set(column);

            this.asc.set(false);
        }

        this.loadSongs();
    }
}