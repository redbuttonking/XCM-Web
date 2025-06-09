let mediaQueryDetectorElem: HTMLElement | null;

export function initialize(): Promise<void> {
  mediaQueryDetectorElem = document.getElementById('mediasoup-demo-app-media-query-detector');

  return Promise.resolve();
}

export function isDesktop(): boolean {
  return !!(mediaQueryDetectorElem && mediaQueryDetectorElem.offsetParent);
}

export function isMobile(): boolean {
  return !(mediaQueryDetectorElem && mediaQueryDetectorElem.offsetParent);
}
