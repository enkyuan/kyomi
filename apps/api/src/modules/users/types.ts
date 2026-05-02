/** Public user profile for `GET /api/v1/users/profile` (no secrets). */
export type UserProfileDto = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReaderDefaultModeDto = "smart" | "original" | "extracted";
export type ReaderContentWidthDto = "narrow" | "medium" | "wide";

export type UserPreferencesDto = {
  defaultMode: ReaderDefaultModeDto;
  fontSizePx: number;
  contentWidth: ReaderContentWidthDto;
  openLinksInNewTab: boolean;
  showImages: boolean;
};

export type UpdateUserPreferencesDto = Partial<UserPreferencesDto>;
