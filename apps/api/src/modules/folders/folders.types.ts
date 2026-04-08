export type FolderDto = {
  id: string;
  name: string;
  createdAt: string;
};

export type FolderReadStatusResponseDto = {
  message: string;
  folderId: string;
  updatedSubscriptions: number;
};
