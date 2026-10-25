import { useLocalSearchParams } from "expo-router";
import { FolderScreen } from "@modules/feeds/folder-screen";

export default function FolderRoute() {
  const { folder } = useLocalSearchParams<{ folder: string }>();

  return <FolderScreen folderId={folder} />;
}
