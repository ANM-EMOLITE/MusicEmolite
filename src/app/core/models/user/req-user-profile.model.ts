import { BaseSearchDto } from "../base/base-search.model";

export interface ReqUserProfile {
    fullName: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    bio: string;
    uri: string;
}

export interface ReqUsers
    extends BaseSearchDto<ReqUsersFilter> {
}

export interface ReqUsersFilter {
    refCode?: string;
    keyword?: string;
    username?: string;
    email?: string;
    userType?: number;
    fullName?: string;
    phone?: string;
    gender?: string;
    bio?: string;
    isActived?: boolean;
    isDeleted?: boolean;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
}