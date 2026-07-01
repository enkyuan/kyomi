export type SessionRow = {
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  locationCity: string | null;
  locationCountry: string | null;
  locationLabel: string | null;
  locationRegion: string | null;
  token: string;
  updatedAt: string;
  userAgent: string | null;
};

export type FormattedTimestamp = {
  absolute: string;
  relative: string;
};

export type SessionDevice = {
  fullUserAgent: string;
  label: string;
  meta: string;
};

export type UseAccountPanelArgs = {
  session:
    | {
        session?: {
          expiresAt: string | Date;
          id: string;
          ipAddress?: string | null;
          locationCity?: string | null;
          locationCountry?: string | null;
          locationLabel?: string | null;
          locationRegion?: string | null;
          token: string;
          updatedAt: string | Date;
          userAgent?: string | null;
        };
      }
    | null
    | undefined;
  user: { email?: string | null } | null | undefined;
};
