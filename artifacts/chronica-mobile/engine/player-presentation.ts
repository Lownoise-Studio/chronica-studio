/** Player UI tokens — presentation only; no engine behavior. */

export const BACKGROUND_OVERLAY_OPACITY = 0.68;

export const CONTENT_PANEL_BG = 'rgba(5,5,12,0.72)';

export const CHOICE_SURFACE_BG = 'rgba(30,29,43,0.92)';

export const STORY_TEXT_ON_IMAGE = '#f0eef8';

export type PlayerLayoutMode = 'image' | 'plain';

export function shouldShowSceneBackground(
  resolvedUri?: string,
  loadFailed = false,
): boolean {
  return !!resolvedUri && !loadFailed;
}

export function getBackgroundOverlayColor(
  opacity = BACKGROUND_OVERLAY_OPACITY,
): string {
  return `rgba(0,0,0,${opacity})`;
}

export function getPlayerLayoutMode(showBackground: boolean): PlayerLayoutMode {
  return showBackground ? 'image' : 'plain';
}

export function getStoryTextColor(showBackground: boolean, foreground: string): string {
  return showBackground ? STORY_TEXT_ON_IMAGE : foreground;
}

export function getChoiceSurfaceColor(showBackground: boolean, secondaryColor: string): string {
  return showBackground ? CHOICE_SURFACE_BG : secondaryColor;
}

export function getEndCardSurfaceColor(showBackground: boolean, secondaryColor: string): string {
  return getChoiceSurfaceColor(showBackground, secondaryColor);
}
