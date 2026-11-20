import { createAppStorage } from "../storage";
const ownerStore = createAppStorage("session-owner");
export const offlineOwner = () => ownerStore.getString("user-id");
