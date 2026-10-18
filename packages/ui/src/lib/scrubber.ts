/**
 * Frame engine for `Scrubber`: tick magnification, rubber-banding, and label tracking.
 * Pure functions over a mutable state object so the component can drive them from one rAF loop.
 */

/**
 * Fractional item indices `[start, end]` visible in the view a scrubber controls. Item `i` spans
 * `[i - 0.5, i + 0.5]`, so `[2.5, 6.5]` means items 3 through 6 are fully on screen.
 */
export type ScrubberRange = readonly [start: number, end: number];

/** Ticks never sit closer than this; denser item counts share a tick. */
export const SCRUBBER_MIN_PITCH = 6;
/** Ticks never spread wider than this, so short lists stay compact and centred. */
export const SCRUBBER_MAX_PITCH = 9;
/** Time constant for magnification and label smoothing, in milliseconds. */
const SMOOTHING_MS = 90;
/** Furthest a drag past either end can pull the field, in pixels. */
const OVERSCROLL_LIMIT = 24;
/** Below this pop amount the preview tick loses its highlight. */
const PREVIEW_THRESHOLD = 0.05;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** iOS-style rubber-band curve: resistance grows with distance and never exceeds `limit`. */
export function rubberBand(offset: number, limit = OVERSCROLL_LIMIT): number {
  const distance = Math.abs(offset);
  if (distance === 0) return 0;
  const resistance = 0.55;
  return (Math.sign(offset) * (resistance * distance * limit)) / (limit + resistance * distance);
}

/** How many ticks fit `width` for `count` items without crowding below the minimum pitch. */
export function slotCount(count: number, width: number): number {
  if (count <= 1) return Math.max(count, 0);
  if (width <= 0) return count;
  return clamp(Math.floor(width / SCRUBBER_MIN_PITCH) + 1, 2, count);
}

export interface ScrubberMotion {
  pointerX: number | null;
  pop: number;
  targetPop: number;
  overscroll: number;
  targetOverscroll: number;
  labelX: number;
  labelShown: boolean;
  focusVisible: boolean;
  dragging: boolean;
  frame: number;
  last: number;
  previewSlot: number;
  currentSlot: number;
}

export function createScrubberMotion(): ScrubberMotion {
  return {
    pointerX: null,
    pop: 0,
    targetPop: 0,
    overscroll: 0,
    targetOverscroll: 0,
    labelX: 0,
    labelShown: false,
    focusVisible: false,
    dragging: false,
    frame: 0,
    last: 0,
    previewSlot: -1,
    currentSlot: -1,
  };
}

export interface ScrubberLayout {
  width: number;
  slots: number;
  last: number;
  value: number;
  range: ScrubberRange | undefined;
  separators: readonly number[];
}

export interface ScrubberElements {
  ticks: readonly (HTMLElement | null)[];
  separators: readonly (HTMLElement | null)[];
  field: HTMLElement | null;
  label: HTMLElement | null;
}

/** Frame-rate independent exponential smoothing toward `target`, snapping inside `epsilon`. */
function approach(current: number, target: number, ease: number, epsilon: number): number {
  const next = current + (target - current) * ease;
  return Math.abs(target - next) < epsilon ? target : next;
}

/** Neighbours ease away from the pointer so the magnified tick has room. */
function spread(motion: ScrubberMotion, x: number, anchor: number, reduced: boolean): number {
  return reduced ? 0 : motion.pop * 4 * Math.tanh((x - anchor) / 20);
}

interface Frame {
  pitch: number;
  anchor: number | null;
  bucket: number;
  start: number;
  end: number;
  /** Half the visible window, in ticks: the lens previews what a jump to the pointer would show. */
  halfWindow: number;
  previewSlot: number;
  currentSlot: number;
}

function resolveFrame(motion: ScrubberMotion, layout: ScrubberLayout): Frame {
  const { width, slots, last, value, range } = layout;
  const pitch = slots > 1 ? width / (slots - 1) : width;
  const valueX = last > 0 ? (value / last) * width : width / 2;
  const pointer = motion.pointerX === null ? null : clamp(motion.pointerX, 0, width);
  const anchor = pointer ?? (motion.focusVisible ? valueX : null);
  const [start, end] = range ?? [value - 0.5, value + 0.5];
  const bucket = slots > 1 ? last / (slots - 1) : 1;
  return {
    pitch,
    anchor,
    bucket,
    start,
    end,
    halfWindow: Math.max(0.5, (end - start) / 2 / Math.max(bucket, 1)),
    previewSlot: anchor === null || pitch <= 0 ? -1 : Math.round(anchor / pitch),
    currentSlot: slots > 1 ? Math.round((value / last) * (slots - 1)) : 0,
  };
}

function paintTick(
  tick: HTMLElement,
  slot: number,
  frame: Frame,
  motion: ScrubberMotion,
  reduced: boolean,
): void {
  const x = slot * frame.pitch;
  const distance =
    frame.anchor === null ? Number.POSITIVE_INFINITY : Math.abs(x - frame.anchor) / frame.pitch;
  const cap = distance < 1 ? (1 - distance) ** 1.5 : 0;
  const lens = Math.exp(-((distance / 2.2) ** 2));
  const center = slot * frame.bucket;
  const outside = Math.max(0, frame.start - center, center - frame.end);
  const visibility = clamp(1 - outside / Math.max(frame.bucket, 1), 0, 1);
  const push = frame.anchor === null ? 0 : spread(motion, x, frame.anchor, reduced);
  // Ticks a jump to the pointer would bring on screen swell by up to 6px (0.75 of the 8px tick);
  // the tick under the pointer gains another 18px (2.25).
  const anchorSlot = frame.anchor === null ? 0 : frame.anchor / frame.pitch;
  const previewed = clamp(1 - Math.max(0, Math.abs(slot - anchorSlot) - frame.halfWindow), 0, 1);
  const scaleX = 1 + motion.pop * cap * 0.34;
  const scaleY = 1 + motion.pop * (previewed * (0.1875 + 0.5625 * lens) + cap * 2.25);
  const highlighted = slot === frame.previewSlot && motion.pop > PREVIEW_THRESHOLD;
  tick.style.transform = `translate3d(${push.toFixed(2)}px,0,0) scale(${scaleX.toFixed(3)},${scaleY.toFixed(3)})`;
  tick.style.opacity = highlighted ? "1" : (0.16 + 0.84 * visibility).toFixed(3);
}

function moveMarker(
  elements: readonly (HTMLElement | null)[],
  from: number,
  to: number,
  attribute: string,
): void {
  if (from === to) return;
  elements[from]?.removeAttribute(attribute);
  elements[to]?.setAttribute(attribute, "");
}

/**
 * Advances the springs by one frame and writes transforms. Returns `true` while anything is still
 * moving, so the caller can stop requesting frames once the scrubber settles.
 */
export function paintScrubber(
  motion: ScrubberMotion,
  layout: ScrubberLayout,
  elements: ScrubberElements,
  reduced: boolean,
  now: number,
): boolean {
  const elapsed = motion.last ? Math.min(64, now - motion.last) : 16;
  motion.last = now;
  const ease = reduced ? 1 : 1 - Math.exp(-elapsed / SMOOTHING_MS);
  motion.pop = approach(motion.pop, motion.targetPop, ease, 0.002);
  motion.overscroll = approach(motion.overscroll, motion.targetOverscroll, ease, 0.05);

  const frame = resolveFrame(motion, layout);
  let settling = motion.pop !== motion.targetPop || motion.overscroll !== motion.targetOverscroll;

  if (frame.anchor === null) {
    motion.labelShown = false;
  } else {
    const follow = motion.labelShown && motion.pointerX !== null;
    motion.labelX = follow ? motion.labelX + (frame.anchor - motion.labelX) * ease : frame.anchor;
    motion.labelShown = true;
    settling ||= Math.abs(frame.anchor - motion.labelX) > 0.1;
  }

  for (let slot = 0; slot < layout.slots; slot++) {
    const tick = elements.ticks[slot];
    if (tick) paintTick(tick, slot, frame, motion, reduced);
  }

  layout.separators.forEach((index, position) => {
    const separator = elements.separators[position];
    if (!separator || layout.last === 0) return;
    const x = ((index - 0.5) / layout.last) * layout.width;
    const push = frame.anchor === null ? 0 : spread(motion, x, frame.anchor, reduced);
    separator.style.transform = `translate3d(${push.toFixed(2)}px,0,0)`;
  });

  const shownPreview = motion.pop > PREVIEW_THRESHOLD ? frame.previewSlot : -1;
  moveMarker(elements.ticks, motion.previewSlot, shownPreview, "data-preview");
  motion.previewSlot = shownPreview;
  moveMarker(elements.ticks, motion.currentSlot, frame.currentSlot, "data-current");
  motion.currentSlot = frame.currentSlot;

  if (elements.field) {
    elements.field.style.translate = motion.overscroll ? `${motion.overscroll.toFixed(2)}px 0` : "";
  }
  if (elements.label) {
    elements.label.style.translate = `calc(${motion.labelX.toFixed(2)}px - 50%) 0`;
  }

  if (!settling) motion.last = 0;
  return settling;
}
