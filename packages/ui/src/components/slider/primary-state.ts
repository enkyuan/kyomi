export type HoverPreview = {
  left: number;
  width: number;
  snappedValue: number;
  cursorX: number;
};

export type PrimarySliderUiState = {
  isHovered: boolean;
  isPressed: boolean;
  editingIndex: number | null;
  hoverPreview: HoverPreview | null;
  focusedThumb: number | null;
  showHoverTooltip: boolean;
  ready: boolean;
};

export const initialPrimarySliderUiState: PrimarySliderUiState = {
  isHovered: false,
  isPressed: false,
  editingIndex: null,
  hoverPreview: null,
  focusedThumb: null,
  showHoverTooltip: false,
  ready: false,
};

export type PrimarySliderUiAction =
  | { type: "hover_enter" }
  | { type: "hover_leave" }
  | { type: "press_start" }
  | { type: "press_end" }
  | { type: "set_hover_preview"; preview: HoverPreview | null }
  | { type: "set_focused_thumb"; index: number | null }
  | { type: "start_edit"; index: number }
  | { type: "end_edit" }
  | { type: "mark_ready" }
  | { type: "tooltip_show" }
  | { type: "tooltip_hide" };

export function primarySliderUiReducer(
  state: PrimarySliderUiState,
  action: PrimarySliderUiAction,
): PrimarySliderUiState {
  switch (action.type) {
    case "hover_enter":
      return { ...state, isHovered: true };
    case "hover_leave":
      return {
        ...state,
        isHovered: false,
        hoverPreview: null,
        showHoverTooltip: false,
      };
    case "press_start":
      return { ...state, isPressed: true };
    case "press_end":
      return { ...state, isPressed: false, hoverPreview: null };
    case "set_hover_preview":
      return { ...state, hoverPreview: action.preview };
    case "set_focused_thumb":
      return { ...state, focusedThumb: action.index };
    case "start_edit":
      return { ...state, editingIndex: action.index };
    case "end_edit":
      return { ...state, editingIndex: null };
    case "mark_ready":
      return { ...state, ready: true };
    case "tooltip_show":
      return { ...state, showHoverTooltip: true };
    case "tooltip_hide":
      return { ...state, showHoverTooltip: false };
    default:
      return state;
  }
}

export type HoverTooltipAction = { type: "leave" } | { type: "delay_elapsed" };

export function hoverTooltipReducer(_visible: boolean, action: HoverTooltipAction): boolean {
  switch (action.type) {
    case "leave":
      return false;
    case "delay_elapsed":
      return true;
    default:
      return false;
  }
}
