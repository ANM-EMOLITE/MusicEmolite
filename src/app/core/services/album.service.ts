import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { API_SERVICE } from "./commons/api.service";
import { API_END } from "../constants/api-end.constants";
import { BaseTableResponse } from "../models/base/base-table-res.model";
import { BaseResponse } from "../models/base/base-res.model";
import { AlbumResponse } from "../models/album/res-album.model";
import { AlbumCreateRequest, AlbumRequest } from "../models/album/req-album.model";
import { BaseSearchDto } from "../models/base/base-search.model";

@Injectable({
  providedIn: 'root'
})
export class AlbumService {

  private api = inject(API_SERVICE);

  searchAlbums(
    data: BaseSearchDto<AlbumRequest>
  ): Observable<BaseTableResponse<AlbumResponse>> {

    return this.api.postData<
      BaseTableResponse<AlbumResponse>,
      BaseSearchDto<AlbumRequest>
    >(
      API_END.ALBUM.SEARCH,
      data
    );
  }

  searchPublicAlbums(
    data: BaseSearchDto<AlbumRequest>
  ): Observable<BaseTableResponse<AlbumResponse>> {

    return this.api.postData<
      BaseTableResponse<AlbumResponse>,
      BaseSearchDto<AlbumRequest>
    >(
      API_END.ALBUM.SEARCH_PUBLIC,
      data
    );
  }

  getAlbumById(id: number): Observable<BaseResponse<AlbumResponse>> {
    return this.api.getData<BaseResponse<AlbumResponse>>(API_END.ALBUM.DETAIL(id));
  }

  createAlbum(data: AlbumCreateRequest) {
    const formData = new FormData();

    formData.append('Title', data.title);
    formData.append('ReleaseDate', data.releaseDate);
    formData.append('AlbumType', data.albumType.toString());
    formData.append('Image', data.image);

    return this.api.postData<any, FormData>(
      API_END.ALBUM.BASE,
      formData
    );
  }
}