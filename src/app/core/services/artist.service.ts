import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { API_SERVICE } from "./commons/api.service";
import { API_END } from "../constants/api-end.constants";
import { BaseSearchDto } from "../models/base/base-search.model";
import { BaseTableResponse } from "../models/base/base-table-res.model";
import { BaseResponse } from "../models/base/base-res.model";
import { ArtistCreateRequest, ArtistRequest, ArtistUpdateRequest } from "../models/artist/req-artist.model";
import { ArtistResponse } from "../models/artist/res-artist.model";

@Injectable({
  providedIn: 'root'
})
export class ArtistService {

  private api = inject(API_SERVICE);

  searchArtists(data: BaseSearchDto<ArtistRequest>)
    : Observable<BaseTableResponse<ArtistResponse>> {

    return this.api.postData<
      BaseTableResponse<ArtistResponse>,
      BaseSearchDto<ArtistRequest>
    >(
      API_END.ARTIST.SEARCH,
      data
    );
  }
  getArtistDetail(id: number): Observable<BaseResponse<ArtistResponse>> {
    return this.api.getData<BaseResponse<ArtistResponse>>(
      API_END.ARTIST.DETAIL(id)
    );
  }

  createArtist(data: ArtistCreateRequest)
    : Observable<BaseResponse<ArtistResponse>> {

    return this.api.postData<
      BaseResponse<ArtistResponse>,
      ArtistCreateRequest
    >(
      API_END.ARTIST.BASE,
      data
    );
  }

  updateArtist(id: number, data: ArtistUpdateRequest)
    : Observable<BaseResponse<ArtistResponse>> {

    return this.api.putData<
      BaseResponse<ArtistResponse>,
      ArtistUpdateRequest
    >(
      API_END.ARTIST.EDIT(id),
      data
    );
  }
}