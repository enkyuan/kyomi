export type FolderDto = {
  id: string;
  name: string;
  isPinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
};

export type UpdateFolderInput = {
  name?: string;
  isPinned?: boolean;
};

export type FolderReadStatusResponseDto = {
  message: string;
  folderId: string;
  updatedSubscriptions: number;
};
