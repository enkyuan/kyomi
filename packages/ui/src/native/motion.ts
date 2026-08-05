export type NativeMotionIntent = "selection-change";

export type NativeMotionEffect = "selection-surface-fade" | "selection-surface-instant";

export type NativeMotionVisualOutcome = {
  readonly effect: NativeMotionEffect;
  readonly selectedSurfaceAlpha: number;
};

type NativeMotionRecipe = {
  readonly standard: NativeMotionVisualOutcome;
  readonly reduced: NativeMotionVisualOutcome;
};

const NATIVE_MOTION_RECIPES = {
  "selection-change": {
    standard: {
      effect: "selection-surface-fade",
      selectedSurfaceAlpha: 0.14,
    },
    reduced: {
      effect: "selection-surface-instant",
      selectedSurfaceAlpha: 0.14,
    },
  },
} as const satisfies Record<NativeMotionIntent, NativeMotionRecipe>;

export function resolveNativeMotionEffect(
  intent: NativeMotionIntent,
  reducedMotion: boolean,
): NativeMotionVisualOutcome {
  const recipe = NATIVE_MOTION_RECIPES[intent];
  return reducedMotion ? recipe.reduced : recipe.standard;
}
