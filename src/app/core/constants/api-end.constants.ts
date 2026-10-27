import { ENVI } from "../../../environment/environment";

const BASE_URL = ENVI.apiUrl;

export const API_END = {
  AUTH: {
    LOGIN: `${BASE_URL}auth/login`,
    LOGIN_WITH_GG: `${BASE_URL}auth/login-google`,
    COMPLETE_PROFILE: `${BASE_URL}auth/complete-profile`,
    REGISTER: `${BASE_URL}auth/register`,
    CHECK_EMAIL: `${BASE_URL}auth/check-email`,
    CHECK_USERNAME: `${BASE_URL}auth/check-username`,
    CHECK_IP: `${BASE_URL}auth/check-ip`,
    CURRENT_USER: `${BASE_URL}auth/current-user`,
    RESET_PASSWORD: `${BASE_URL}auth/reset-password`,
    CHANGE_PASSWORD: `${BASE_URL}auth/change-password`,
    REFRESH_TOKEN: `${BASE_URL}auth/refresh-token`,
    LOGOUT: `${BASE_URL}auth/logout`
  },

  OTP: {
    SEND: `${BASE_URL}otp/send`,
    VERIFY: `${BASE_URL}otp/verify`
  },

  FRIEND: {
    BASE: `${BASE_URL}friends`,
    REQUESTS: `${BASE_URL}friends/requests`,
    REQUESTS_SENT: `${BASE_URL}friends/requests/sent`,
    SEARCH: `${BASE_URL}friends/search`,
    ACCEPT: (friendshipId: number) => `${BASE_URL}friends/requests/${friendshipId}/accept`,
    REJECT: (friendshipId: number) => `${BASE_URL}friends/requests/${friendshipId}/reject`,
    REMOVE: (friendUserId: number) => `${BASE_URL}friends/${friendUserId}`,
    PIN: (friendUserId: number) => `${BASE_URL}friends/${friendUserId}/pin`,
  },

  MESSAGE: {
    BASE: `${BASE_URL}messages`,
    CONVERSATIONS: `${BASE_URL}messages/conversations`,
    CONVERSATION: (otherUserId: number) => `${BASE_URL}messages/${otherUserId}`,
    MARK_READ: (otherUserId: number) => `${BASE_URL}messages/${otherUserId}/read`,
    UPLOAD_IMAGE: `${BASE_URL}messages/upload-image`,
    DELETE: (id: number) => `${BASE_URL}messages/${id}`,
  },

  USER: {
    BASE: `${BASE_URL}users`,
    PROFILE: `${BASE_URL}users/profile`,
    BANK_USER: `${BASE_URL}users/bank-user`,
    BANK_USER_ADMIN: `${BASE_URL}users/bank-user/admin`,
    BANK_USER_ADD: `${BASE_URL}users/bank-user/add`,
    BANK_USER_EDIT: (id: number) => `${BASE_URL}users/${id}/bank-user`,
  },

  SONG: {
    BASE: `${BASE_URL}songs`,
    SEARCH: `${BASE_URL}songs/search`,
    SEARCH_PUBLIC: `${BASE_URL}songs/public/search`,
    TRENDINGS: `${BASE_URL}songs/public/trending`,
    NEWEST: `${BASE_URL}songs/public/newest`,
    RECENTS: `${BASE_URL}songs/recent`,
    MOST_PLAYED: `${BASE_URL}songs/most-played`,
    MOST_PLAYED_MIX: `${BASE_URL}songs/mixes/most-played`,
    SONG_TO_ALBUMS: `${BASE_URL}songs/albums`,
    DETAIL: (id: number) => `${BASE_URL}songs/${id}`,
    VIEW: (id: number) => `${BASE_URL}songs/${id}/view`,
    HISTORY: `${BASE_URL}songs/history`,
    LIKE: (id: number) => `${BASE_URL}songs/${id}/like`,
    LYRICS: `${BASE_URL}songs/lyrics`,
    LYRICS_SEARCH: `${BASE_URL}songs/lyrics/search`,
    LYRICS_BY_ID: (id: number) => `${BASE_URL}songs/lyrics/${id}`,
    LYRICS_PUBLISH: `${BASE_URL}songs/publish`,
    YOUTUBE_SEARCH: `${BASE_URL}songs/youtube/search`
  },

  ALBUM: {
    BASE: `${BASE_URL}albums`,
    SEARCH: `${BASE_URL}albums/search`,
    SEARCH_PUBLIC: `${BASE_URL}albums/public/search`,
    DETAIL: (id: number) => `${BASE_URL}albums/${id}`
  },

  ARTIST: {
    BASE: `${BASE_URL}artists`,
    SEARCH: `${BASE_URL}artists/search`,
    DETAIL: (id: number) => `${BASE_URL}artists/${id}`,
    EDIT: (id: number) => `${BASE_URL}artists/${id}`,
  },

  BANK: {
    LIST: `${BASE_URL}bank`
  }
};