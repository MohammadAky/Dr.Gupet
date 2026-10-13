import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { landingImageSet } from '../lib/landing-image';

export interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: ReactNode;
}

/** URL validation belongs to the caller; this handles network/decode failures. */
export function SafeImage(props: SafeImageProps) {
  return <ImageResource key={props.src} {...props} />;
}

function ImageResource({ src, alt = '', fallback, onError, className, width, height, ...props }: SafeImageProps) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  if (!src || failedSource === src) {
    return fallback ?? (
      <span className={`safe-image-fallback ${className ?? ''}`} style={className ? undefined : {
        width: typeof width === 'string' && /^\d+$/.test(width) ? Number(width) : width,
        height: typeof height === 'string' && /^\d+$/.test(height) ? Number(height) : height,
      }}
        role={alt ? 'img' : undefined} aria-label={alt ? `تصویر ${alt} در دسترس نیست` : undefined}
        aria-hidden={alt ? undefined : true}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" />
          <path d="m3 17 5-5 4 4 4-5 5 6" />
        </svg>
      </span>
    );
  }
  const responsive = landingImageSet(src, window.location.origin);
  return <img {...props} srcSet={props.srcSet ?? responsive} sizes={props.sizes ?? (responsive ? '100vw' : undefined)} src={src} alt={alt} className={className} width={width} height={height}
    onError={(event) => { setFailedSource(src); onError?.(event); }} />;
}
