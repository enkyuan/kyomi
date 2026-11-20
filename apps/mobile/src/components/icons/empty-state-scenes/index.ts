import { EXTRA_SCENES } from "./extras";
import { FEED_SCENES } from "./feeds";
import { LIBRARY_SCENES } from "./library";
import { SETTINGS_SCENES } from "./settings";
import type { Scene } from "./parts";

/** Every empty-state illustration by name; the catalog and the frame both key off these names. */
export const SCENES = {
  ...FEED_SCENES,
  ...LIBRARY_SCENES,
  ...SETTINGS_SCENES,
  ...EXTRA_SCENES,
} as const satisfies Record<string, Scene>;

export type EmptyStateScene = keyof typeof SCENES;
