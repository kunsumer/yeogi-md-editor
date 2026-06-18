/** What the Lightbox needs to display a clicked target. */
export type ZoomTarget =
  | { image: { src: string; alt: string } }
  | { svgEl: SVGSVGElement };

/**
 * Tag every <img> and Mermaid <svg> inside a rendered preview `host` as
 * click-to-zoom: sets a zoom-in cursor and, on click, calls `onOpen` with the
 * payload the Lightbox needs. Returns a cleanup function that removes every
 * listener it added (call before re-rendering the host or on unmount).
 */
export function attachZoomTargets(
  host: HTMLElement,
  onOpen: (target: ZoomTarget) => void,
): () => void {
  const cleanups: Array<() => void> = [];

  host.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.style.cursor = "zoom-in";
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen({ image: { src: img.currentSrc || img.src, alt: img.alt } });
    };
    img.addEventListener("click", handler);
    cleanups.push(() => img.removeEventListener("click", handler));
  });

  host.querySelectorAll<SVGSVGElement>(".mermaid svg").forEach((svg) => {
    const container = svg.parentElement;
    if (container) container.style.cursor = "zoom-in";
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen({ svgEl: svg });
    };
    svg.addEventListener("click", handler);
    cleanups.push(() => svg.removeEventListener("click", handler));
  });

  return () => cleanups.forEach((fn) => fn());
}
