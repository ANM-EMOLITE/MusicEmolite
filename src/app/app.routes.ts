import { Routes } from '@angular/router';
import { URL_END } from './core/constants/url-end.constants';
import { HomeComponent } from './pages/page-user/home/home';
import { PlayerComponent } from './pages/page-user/players/player';
import { DiscoverComponent } from './pages/page-user/discover/discover';
import { LayoutUserComponent } from './layout/layout-user';
import { LayoutAdminComponent } from './layout/layout-login/layout-login';
import { LoginComponent } from './pages/page-login/login/login';
import { RegisterComponent } from './pages/page-login/register/register';
import { AlbumComponent } from './pages/page-user/album/album';
import { PlayerBarDetailComponent } from './pages/page-user/player-bar/player-bar-detail/player-bar-detail';
import { PlaylistComponent } from './pages/page-user/playlist/playlist';
import { AlbumDetailComponent } from './pages/page-user/album/album-detail/album-detail';
import { ArtistDetailComponent } from './pages/page-user/artist/artist-detail/artist-detail';
import { WelcomeComponent } from './pages/page-login/welcome/welcome';
import { ForgotPasswordComponent } from './pages/page-login/forgot-password/forgot-password';
import { MessagesComponent } from './pages/page-user/messages/messages';
import { NotFoundComponent } from './pages/page-default/not-found/not-found';
import { UnauthorizedComponent } from './pages/page-default/unauthorized/unauthorized';
import { adminGuard } from './core/guards/admin.guard';
import { userAreaGuard } from './core/guards/user-area.guard';
import { AdminLoginComponent } from './pages/page-admin/admin-login/admin-login';

export const routes: Routes = [
    {
        path: '',
        redirectTo: `${URL_END.USER.BASE}/${URL_END.USER.HOME}`,
        pathMatch: 'full'
    },
    {
        path: URL_END.AUTH.BASE,
        component: LayoutAdminComponent,
        children: [
            {
                path: URL_END.AUTH.LOGIN,
                component: LoginComponent
            },
            {
                path: URL_END.AUTH.REGISTER,
                component: RegisterComponent
            },
            {
                path: URL_END.AUTH.WELCOME,
                component: WelcomeComponent
            },
            {
                path: URL_END.AUTH.FORGOT_PASSWORD,
                component: ForgotPasswordComponent
            }
        ]
    },
    {
        path: URL_END.USER.BASE,
        component: LayoutUserComponent,
        canActivate: [userAreaGuard],
        children: [
            {
                path: URL_END.USER.HOME,
                component: HomeComponent
            },
            {
                path: URL_END.USER.PLAYLIST,
                component: PlaylistComponent
            },
            {
                path: URL_END.USER.ALBUM,
                component: AlbumComponent
            },
            {
                path: URL_END.USER.ALBUM_DETAIL,
                component: AlbumDetailComponent
            },
            {
                path: URL_END.USER.ARTIST_DETAIL,
                component: ArtistDetailComponent
            },
            {
                path: URL_END.USER.DISCOVER,
                component: DiscoverComponent
            },
            {
                path: URL_END.USER.MESSAGES,
                component: MessagesComponent
            }
        ]
    },
    {
        path: URL_END.USER.SETTING,
        canActivate: [userAreaGuard],
        loadChildren: () => import('./pages/page-user/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
    },
    {
        // Must stay above the guarded admin route so it isn't swallowed by it.
        path: URL_END.ADMIN.LOGIN,
        component: AdminLoginComponent
    },
    {
        path: URL_END.ADMIN.BASE,
        canActivate: [adminGuard],
        loadChildren: () => import('./pages/page-admin/admin.routes').then(m => m.ADMIN_ROUTES)
    },
    {
        path: URL_END.DEFAULT.UNAUTHORIZED,
        component: UnauthorizedComponent
    },
    {
        path: URL_END.DEFAULT.NOT_FOUND,
        component: NotFoundComponent
    },
    {
        path: '**',
        component: NotFoundComponent
    }

];
