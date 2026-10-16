import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { SafeImage } from './SafeImage';

export type GalleryImage = { id: number; safeUrl: string | null };

function ZoomImage({ url, name, onOpen }: { url: string; name: string; onOpen: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const point = useRef({ x: 50, y: 50 });
  const frame = useRef<number | null>(null);
  const fine = useRef<MediaQueryList | null>(null), reduced = useRef<MediaQueryList | null>(null);
  const [failed, setFailed] = useState(false);
  const clear = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; bounds.current = null;
    layer.current?.style.removeProperty('transform');
    layer.current?.style.removeProperty('transform-origin');
  }, []);
  useEffect(() => {
    fine.current = window.matchMedia?.('(hover: hover) and (pointer: fine)') ?? null;
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    const fineQuery = fine.current, reducedQuery = reduced.current;
    fineQuery?.addEventListener?.('change', clear); reducedQuery?.addEventListener?.('change', clear);
    window.addEventListener('resize', clear); window.addEventListener('scroll', clear, true);
    return () => {
      clear(); fineQuery?.removeEventListener?.('change', clear); reducedQuery?.removeEventListener?.('change', clear);
      window.removeEventListener('resize', clear); window.removeEventListener('scroll', clear, true);
    };
  }, [clear]);
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || !fine.current?.matches || reduced.current?.matches || failed) { clear(); return; }
    const rect = bounds.current;
    if (!rect?.width || !rect.height) return;
    point.current = {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)),
    };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!bounds.current || !layer.current) return;
      layer.current.style.transformOrigin = `${point.current.x}% ${point.current.y}%`;
      layer.current.style.transform = 'scale(1.5)';
    });
  }
  return <button className="commerce-gallery-open product-gallery__open" type="button"
    aria-label={`نمایش بزرگ‌تر تصویر ${name}`} onClick={() => { clear(); onOpen(); }}
    onPointerEnter={event => { if (event.pointerType === 'mouse' && fine.current?.matches && !reduced.current?.matches && !failed) bounds.current = event.currentTarget.getBoundingClientRect(); move(event); }}
    onPointerMove={move} onPointerLeave={clear} onPointerCancel={clear} onFocus={clear} onBlur={clear}>
    <div ref={layer} className="product-gallery__zoom-layer">
      <SafeImage src={url} alt={name} referrerPolicy="no-referrer" draggable={false}
        onError={() => { clear(); setFailed(true); }} />
    </div>
  </button>;
}

/** Images are already validated by the page; navigation keeps the existing modal contract. */
export function ProductGallery({ images, selectedId, name, onSelect, onOpen }: {
  images: GalleryImage[]; selectedId: number | null; name: string;
  onSelect: (id: number) => void; onOpen: () => void;
}) {
  const selected = images.find(image => image.id === selectedId) ?? images[0];
  return <div className="product-detail__gallery product-gallery">
    <div className="product-detail__media product-gallery__media">
      {selected?.safeUrl ? <ZoomImage key={selected.safeUrl} url={selected.safeUrl} name={name} onOpen={onOpen} />
        : <SafeImage alt={name} />}
    {images.length > 1 && <div className="product-detail__thumbnails product-gallery__thumbnails" role="group" aria-label="تصاویر محصول">
      {images.map((image, index) => <button key={image.id} type="button" aria-label={`تصویر ${index + 1} از ${name}`}
        aria-pressed={selected?.id === image.id} onClick={() => onSelect(image.id)}>
        <SafeImage src={image.safeUrl ?? undefined} alt="" width="64" height="64" loading="lazy" referrerPolicy="no-referrer" />
      </button>)}
    </div>}
    </div>
  </div>;
}
