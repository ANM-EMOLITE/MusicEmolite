export interface ResUserProfile {
  id: number;
  refCode: string;
  userId: number;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  avatarFileId: number | null;

  isActived: boolean;
  isDeleted: boolean;

  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
}

export interface ResUsers {
    id: number;
    refCode?: string;
    username?: string;
    email?: string;
    userType?: number;
    userTypeName?: string;
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    bio?: string;
    uri?: string;
    isActived: boolean;
    isDeleted: boolean;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: number;
    updatedBy?: number;
}