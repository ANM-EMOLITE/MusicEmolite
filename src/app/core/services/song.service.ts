import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { API_SERVICE } from "./commons/api.service";
import { API_END } from "../constants/api-end.constants";
import { BaseTableResponse } from "../models/base/base-table-res.model";
import { SongResponse } from "../models/song/res-song.model";
import { AddSongHistoryRequest, SongCreateRequest, SongRequest } from "../models/song/req-song.model";
import { BaseSearchDto } from "../models/base/base-search.model";
import { BaseResponse } from "../models/base/base-res.model";
import { LyricsResponseDto } from "../models/song/res-lyrics.model";
import { LyricsRequestDto, LyricsSearchRequestDto, PublishLyricsRequest } from "../models/song/req-lyrics.model";
import { YoutubeVideoResponse } from "../models/youtube/youtube-res.model";
import { YoutubeSearchRequest } from "../models/youtube/youtube-req.model";
import { MixPlaylistResponse } from "../models/song/res-mix.model";

@Injectable({
  providedIn: 'root'
})
export class SongService {

  private api = inject(API_SERVICE);

  searchSongs(data: BaseSearchDto<SongRequest>)
    : Observable<BaseTableResponse<SongResponse>> {

    return this.api.postData<
      BaseTableResponse<SongResponse>,
      BaseSearchDto<SongRequest>
    >(
      API_END.SONG.SEARCH,
      data
    );
  }

  searchPublicSongs(data: BaseSearchDto<SongRequest>)
    : Observable<BaseTableResponse<SongResponse>> {

    return this.api.postData<
      BaseTableResponse<SongResponse>,
      BaseSearchDto<SongRequest>
    >(
      API_END.SONG.SEARCH_PUBLIC,
      data
    );
  }

  searchYoutube(data: BaseSearchDto<YoutubeSearchRequest>)
    : Observable<BaseTableResponse<YoutubeVideoResponse>> {

    return this.api.postData<
      BaseTableResponse<YoutubeVideoResponse>,
      BaseSearchDto<YoutubeSearchRequest>
    >(
      API_END.SONG.YOUTUBE_SEARCH,
      data
    );
  }

  getTrendingSongs(data: BaseSearchDto<SongRequest>): Observable<BaseTableResponse<SongResponse>> {
    return this.api.postData(
      API_END.SONG.TRENDINGS,
      data
    );
  }

  getRecentSongs(data: BaseSearchDto<SongRequest>): Observable<BaseTableResponse<SongResponse>> {
    return this.api.postData<BaseTableResponse<SongResponse>, BaseSearchDto<SongRequest>>(
      API_END.SONG.RECENTS,
      data
    );
  }

  getNewestSongs(data: BaseSearchDto<SongRequest>): Observable<BaseTableResponse<SongResponse>> {
    return this.api.postData<
      BaseTableResponse<SongResponse>,
      BaseSearchDto<SongRequest>
    >(
      API_END.SONG.NEWEST,
      data
    );
  }

  getMostPlayedSongs(top: number = 20): Observable<BaseTableResponse<SongResponse>> {
    return this.api.getData<BaseTableResponse<SongResponse>>(
      `${API_END.SONG.MOST_PLAYED}?top=${top}`
    );
  }

  getMostPlayedMix(top: number = 20): Observable<BaseResponse<MixPlaylistResponse>> {
    return this.api.getData<BaseResponse<MixPlaylistResponse>>(
      `${API_END.SONG.MOST_PLAYED_MIX}?top=${top}`
    );
  }

  createSong(data: SongCreateRequest): Observable<BaseResponse<SongResponse>> {
    const formData = new FormData();

    formData.append('title', data.title);
    formData.append('releaseDate', data.releaseDate);
    formData.append('albumId', data.albumId.toString());
    formData.append('artistName', data.artistName);
    formData.append('fileUrl', data.fileUrl);
    formData.append('imgUrl', data.imgUrl);
    formData.append('type', data.type.toString());

    if (data.lyrics) {
      formData.append('lyrics', JSON.stringify({
        lyrics: data.lyrics.lyrics ?? '',
        syncedLyrics: data.lyrics.syncedLyrics ?? []
      }));
    }

    return this.api.postData<
      BaseResponse<SongResponse>,
      FormData
    >(
      API_END.SONG.BASE,
      formData
    );
  }

  addSongToAlbum(songId: number, albumId: number): Observable<BaseResponse<SongResponse>> {
    return this.api.postData<BaseResponse<SongResponse>, {}>(
      `${API_END.SONG.SONG_TO_ALBUMS}?songId=${songId}&albumId=${albumId}`,
      {}
    );
  }

  removeSongFromAlbum(songId: number, albumId: number): Observable<BaseResponse<boolean>> {
    return this.api.deleteData<BaseResponse<boolean>>(
      `${API_END.SONG.SONG_TO_ALBUMS}?songId=${songId}&albumId=${albumId}`
    );
  }

  getSongDetail(id: number): Observable<BaseResponse<SongResponse>> {
    return this.api.getData<BaseResponse<SongResponse>>(API_END.SONG.DETAIL(id));
  }

  incrementView(id: number): Observable<BaseResponse<SongResponse>> {
    return this.api.postData<BaseResponse<SongResponse>, {}>(API_END.SONG.VIEW(id), {});
  }

  addSongHistory(
    data: AddSongHistoryRequest
  ): Observable<BaseResponse<SongResponse>> {

    return this.api.postData<
      BaseResponse<SongResponse>,
      AddSongHistoryRequest
    >(
      API_END.SONG.HISTORY,
      data
    );
  }

  toggleLike(id: number): Observable<BaseResponse<SongResponse>> {
    return this.api.postData<BaseResponse<SongResponse>, {}>(API_END.SONG.LIKE(id), {});
  }

  getLyrics(params: LyricsRequestDto): Observable<BaseResponse<LyricsResponseDto>> {
    return this.api.getData<BaseResponse<LyricsResponseDto>>(
      `${API_END.SONG.LYRICS}?title=${encodeURIComponent(params.title ?? '')}&artist=${encodeURIComponent(params.artist ?? '')}`
    );
  }

  searchLyrics(data: BaseSearchDto<LyricsSearchRequestDto>)
    : Observable<BaseTableResponse<LyricsResponseDto>> {

    return this.api.postData<
      BaseTableResponse<LyricsResponseDto>,
      BaseSearchDto<LyricsRequestDto>
    >(
      API_END.SONG.LYRICS_SEARCH,
      data
    );
  }

  getLyricsById(id: number)
    : Observable<BaseResponse<LyricsResponseDto>> {

    return this.api.getData<
      BaseResponse<LyricsResponseDto>
    >(
      API_END.SONG.LYRICS_BY_ID(id)
    );
  }

  publishLyrics(data: PublishLyricsRequest)
    : Observable<BaseResponse<string>> {

    return this.api.postData<
      BaseResponse<string>,
      PublishLyricsRequest
    >(
      API_END.SONG.LYRICS_PUBLISH,
      data
    );
  }
}