export type LoadingLayout = 'cards' | 'detail' | 'form' | 'rows';

/** A route's pending outline, without mounting its form or making a request. */
export function loadingLayoutForPath(pathname: string): LoadingLayout {
  if (/^\/(login|verify|profile|checkout)(\/|$)/.test(pathname) ||
      /^\/(pets|addresses)\/(new|\d+\/edit)\/?$/.test(pathname)) return 'form';
  if (/^\/(products|medicines|clinics|pharmacies|pets|orders)\/[^/]+\/?$/.test(pathname)) return 'detail';
  if (/^\/(cart|orders|addresses|payment)(\/|$)/.test(pathname)) return 'rows';
  return 'cards';
}

function Line({ short = false }: { short?: boolean }) {
  return <span className={`loading-wireframe__line${short ? ' loading-wireframe__line--short' : ''}`} />;
}

export function PageSkeleton({ layout = 'cards', text = 'در حال بارگذاری…', heading = false }: {
  layout?: LoadingLayout;
  text?: string;
  heading?: boolean;
}) {
  return (
    <div className={`loading-wireframe loading-wireframe--${layout}`} role="status" aria-busy="true">
      <span className="loading-wireframe__status">{text}</span>
      <div className="loading-wireframe__body" aria-hidden="true">
        {heading && <div className="loading-wireframe__heading"><Line short /><Line /></div>}
        {layout === 'cards' && (
          <div className="loading-wireframe__grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="loading-wireframe__card" key={index}>
                <span className="loading-wireframe__media" /><Line /><Line short />
                <span className="loading-wireframe__action" />
              </div>
            ))}
          </div>
        )}
        {layout === 'detail' && (
          <div className="loading-wireframe__detail">
            <span className="loading-wireframe__media" />
            <div className="loading-wireframe__panel"><Line short /><Line /><Line /><Line short />
              <span className="loading-wireframe__action" /></div>
          </div>
        )}
        {layout === 'form' && (
          <div className="loading-wireframe__form">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="loading-wireframe__field" key={index}><Line short /><span className="loading-wireframe__input" /></div>
            ))}
            <span className="loading-wireframe__action" />
          </div>
        )}
        {layout === 'rows' && (
          <div className="loading-wireframe__rows">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="loading-wireframe__row" key={index}><span className="loading-wireframe__thumb" />
                <div className="loading-wireframe__panel"><Line /><Line short /></div></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RouteLoading({ pathname }: { pathname: string }) {
  return <PageSkeleton layout={loadingLayoutForPath(pathname)} text="در حال آماده‌سازی صفحه…" heading />;
}
