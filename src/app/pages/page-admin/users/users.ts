import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { AppTableComponent }
    from '../../../shared/components/table/table';

import { FilterComponent }
    from '../../../shared/components/filter/filter';

import { TableColumn }
    from '../../../core/models/front-end/table/table-column.model';

import { FilterField }
    from '../../../core/models/front-end/filter/filter-field.model';

import { UserService }
    from '../../../core/services/user.service';

import { PAGINATION }
    from '../../../core/constants/pagination.constants';
import { ReqUsers, ReqUsersFilter } from '../../../core/models/user/req-user-profile.model';
import { ResUsers } from '../../../core/models/user/res-user-profile.model';
import { DetailPanelComponent } from '../../../shared/components/detail-panel/detail-panel';
import { AlbumService } from '../../../core/services/album.service';
import { SongService } from '../../../core/services/song.service';
import { FoodEmoliteService } from '../../../core/services/food-emolite.service';

@Component({
    selector: 'app-users',
    standalone: true,

    imports: [
        CommonModule,
        AppTableComponent,
        FilterComponent,
        DetailPanelComponent
    ],

    templateUrl: './users.html'
})
export class UsersComponent {

    private userService = inject(UserService);
    private albumService = inject(AlbumService);
    private songService = inject(SongService);
    private foodEmoliteService = inject(FoodEmoliteService);

    /** MusicEmolite users vs FoodEmolite users - separate systems, separate tabs. */
    usersTab = signal<'music' | 'food'>('music');

    loadingFoodUsers = signal(false);
    foodUsers = signal<any[]>([]);
    foodUsersCurrentPage = signal(PAGINATION.DEFAULT_PAGE);
    foodUsersTotalPages = signal(PAGINATION.DEFAULT_PAGE);
    foodUsersTotalRecords = signal(0);
    foodUsersPageSize = signal(20);
    selectedFoodUser = signal<any | null>(null);

    foodUserFilter = signal<{ keyword: string }>({ keyword: '' });

    foodUserFilterFields: FilterField[] = [
        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Tên đăng nhập, họ tên hoặc email...' }
    ];

    foodUserColumns: TableColumn[] = [
        { key: 'stt', label: 'STT', width: '80px', align: 'center' },
        { key: 'avatarUrl', label: 'Ảnh', type: 'image', width: '100px', align: 'left' },
        { key: 'username', label: 'Tên đăng nhập' },
        { key: 'fullName', label: 'Họ tên' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Số điện thoại' },
        { key: 'isActived', label: 'Trạng thái', type: 'status', align: 'center' }
    ];

    selectedUser = signal<ResUsers | null>(null);
    userAlbums = signal<any[]>([]);
    userLikedSongs = signal<any[]>([]);
    loadingUserAlbums = signal(false);
    loadingUserLikedSongs = signal(false);

    loading = signal(false);

    rows = signal<ResUsers[]>([]);
    sortBy = signal('createdAt');
    asc = signal(false);
    currentPage = signal(
        PAGINATION.DEFAULT_PAGE
    );

    totalPages = signal(
        PAGINATION.DEFAULT_PAGE
    );

    totalRecords = signal(0);
    pageSize = signal(20);

    filter = signal<ReqUsersFilter>({
        keyword: '',
        isActived: true
    });

    filterFields: FilterField[] = [

        { key: 'keyword', label: 'Tìm kiếm', type: 'text', placeholder: 'Tìm kiếm...' },

        {
            key: 'isActived',
            label: 'Trạng thái',
            type: 'select',

            options: [
                {
                    label: 'Hoạt động',
                    value: true
                },
                {
                    label: 'Không hoạt động',
                    value: false
                }
            ]
        },

        {
            key: 'gender',
            label: 'Giới tính',
            type: 'select',
            options: [
                {
                    label: 'Nam',
                    value: 'male'
                },
                {
                    label: 'Nữ',
                    value: 'female'
                }
            ]
        },

        {
            key: 'userType',
            label: 'Loại tài khoản',
            type: 'select',
            options: [
                {
                    label: 'Free Plan',
                    value: 1
                },
                {
                    label: 'Premium',
                    value: 2
                }
            ]
        }
    ];

    columns: TableColumn[] = [

        {
            key: 'stt',
            label: 'STT',
            width: '80px',
            align: 'center',
        },

        {
            key: 'uri',
            label: 'Ảnh',
            type: 'image',
            width: '100px',
            align: 'center'
        },

        {
            key: 'username',
            label: 'Tên tài khoản'
        },

        {
            key: 'fullName',
            label: 'Họ tên'
        },

        {
            key: 'email',
            label: 'Email'
        },

        {
            key: 'phone',
            label: 'Số điện thoại'
        },

        {
            key: 'gender',
            label: 'Giới tính',
            align: 'center'
        },

        {
            key: 'isPremium',
            label: 'Loại tài khoản',
            type: 'badge',
            align: 'center',
            badgeConfig: { trueLabel: 'Premium', falseLabel: 'Free Plan', trueClass: 'bg-amber-100 text-amber-700', falseClass: 'bg-gray-100 text-gray-600' }
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

        this.loadUsers();
        this.loadFoodUsers();
    }

    setUsersTab(tab: 'music' | 'food') {
        this.usersTab.set(tab);
    }

    loadFoodUsers() {
        this.loadingFoodUsers.set(true);

        this.foodEmoliteService.getUsers(this.foodUsersCurrentPage(), this.foodUsersPageSize(), this.foodUserFilter().keyword).subscribe({
            next: (res) => {
                const items: any[] = res?.items ?? [];

                const mapped = items.map((item, index) => ({
                    id: item.account?.id,
                    refCode: item.account?.refCode,
                    username: item.account?.username,
                    email: item.account?.email,
                    isActived: item.account?.isActive,
                    fullName: item.profile?.fullName,
                    phone: item.profile?.phoneNumber,
                    gender: item.profile?.gender,
                    dateOfBirth: item.profile?.dateOfBirth,
                    address: item.profile?.address,
                    avatarUrl: item.profile?.avatarUrl,
                    stt: ((this.foodUsersCurrentPage() - 1) * this.foodUsersPageSize()) + index + 1
                }));

                this.foodUsers.set(mapped);
                this.foodUsersTotalPages.set(res?.totalPages ?? PAGINATION.DEFAULT_PAGE);
                this.foodUsersTotalRecords.set(res?.totalRecords ?? 0);
                this.loadingFoodUsers.set(false);
            },
            error: (err) => {
                console.log(err);
                this.loadingFoodUsers.set(false);
            }
        });
    }

    onFoodUsersPageChange(page: number) {
        this.foodUsersCurrentPage.set(page);
        this.loadFoodUsers();
    }

    onFoodUsersPageSizeChange(size: number) {
        this.foodUsersPageSize.set(size);
        this.foodUsersCurrentPage.set(1);
        this.loadFoodUsers();
    }

    onFoodUserFilterChange(data: any) {
        this.foodUsersCurrentPage.set(1);
        this.foodUserFilter.set({ keyword: data.keyword ?? '' });
        this.loadFoodUsers();
    }

    onFoodUserRowDblClick(row: any) {
        this.selectedFoodUser.set(row);
    }

    closeFoodUserDetail() {
        this.selectedFoodUser.set(null);
    }

    loadUsers() {

        this.loading.set(true);

        const payload: ReqUsers = {

            page: this.currentPage(),

            pageSize:
                this.pageSize(),

            asc: this.asc(),

            searchParams: {
                ...this.filter(),
                sortBy: this.sortBy()
            }
        };
        this.userService
            .getUsers(payload)
            .subscribe({

                next: (res) => {

                    const data =
                        res?.data ?? [];

                    const mapped =
                        data.map((item, index) => ({

                            ...item,
                            gender: item.gender === 'male'
                                ? 'Nam'
                                : item.gender === 'female'
                                    ? 'Nữ'
                                    : item.gender,
                            isPremium: item.userType === 2,
                            stt:
                                ((this.currentPage() - 1)
                                    * this.pageSize())
                                + index
                                + 1
                        }));

                    this.rows.set(mapped);

                    this.totalPages.set(
                        res?.totalPages
                        ?? PAGINATION.DEFAULT_PAGE
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

    onFilterChange(data: ReqUsersFilter) {

        this.currentPage.set(1);

        this.filter.set(data);

        this.loadUsers();
    }

    onPageChange(page: number) {

        this.currentPage.set(page);

        this.loadUsers();
    }

    onPageSizeChange(size: number) {

        this.pageSize.set(size);

        this.currentPage.set(1);

        this.loadUsers();
    }

    onSort(column: string) {

        if (this.sortBy() === column) {

            this.asc.set(!this.asc());
        }

        else {

            this.sortBy.set(column);

            this.asc.set(false);
        }

        this.loadUsers();
    }

    onRowClick(row: ResUsers) {

        console.log(row);
    }

    onRowDblClick(row: ResUsers) {

        this.selectedUser.set(row);

        if (!row.id) return;

        this.loadUserAlbums(row.id);
        this.loadUserLikedSongs(row.id);
    }

    closeDetail() {

        this.selectedUser.set(null);
        this.userAlbums.set([]);
        this.userLikedSongs.set([]);
    }

    private loadUserAlbums(userId: number) {

        this.loadingUserAlbums.set(true);

        this.albumService.getAlbumsByUserAdmin(userId, {
            page: 1,
            pageSize: 50,
            asc: false,
            searchParams: {}
        }).subscribe({
            next: (res) => {
                this.userAlbums.set(res?.data ?? []);
                this.loadingUserAlbums.set(false);
            },
            error: () => {
                this.loadingUserAlbums.set(false);
            }
        });
    }

    private loadUserLikedSongs(userId: number) {

        this.loadingUserLikedSongs.set(true);

        this.songService.getLikedSongsByUserAdmin(userId, {
            page: 1,
            pageSize: 50,
            asc: false,
            searchParams: {}
        }).subscribe({
            next: (res) => {
                this.userLikedSongs.set(res?.data ?? []);
                this.loadingUserLikedSongs.set(false);
            },
            error: () => {
                this.loadingUserLikedSongs.set(false);
            }
        });
    }
}