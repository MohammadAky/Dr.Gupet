import { useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Dialog } from './ui';
import '../styles/directory-filters.css';

const phoneQuery = '(max-width: 900px)';
function subscribe(callback: () => void) {
  const media = window.matchMedia?.(phoneQuery);
  media?.addEventListener('change', callback);
  return () => media?.removeEventListener('change', callback);
}
const phoneSnapshot = () => window.matchMedia?.(phoneQuery).matches ?? false;

export type DirectoryFilterSection = { id: string; label: string; summary?: string; content: ReactNode };

/** One form instance, one expanded section, and the shared accessible mobile drawer. */
export function DirectoryFilters({ title, sections, activeCount, onClear, onSubmit, submitLabel = 'نمایش نتایج', children }: {
  title: string; sections: DirectoryFilterSection[]; activeCount: number;
  onClear(): void; onSubmit(event: FormEvent<HTMLFormElement>): void;
  submitLabel?: string; children: ReactNode;
}) {
  const id = useId();
  const isPhone = useSyncExternalStore(subscribe, phoneSnapshot, () => false);
  const [opened, setOpened] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  function open(section: string | null) { setOpened(section); setDrawerOpen(true); }
  const panel = <form className="filter-panel directory-page__filters directory-filter-panel" onSubmit={event => {
    onSubmit(event); if (isPhone) setDrawerOpen(false);
  }}>
    <div className="directory-filter-panel__heading"><h2>فیلترها</h2>
      <button type="button" className="filter-clear" onClick={onClear}>پاک‌کردن فیلترها{activeCount ? ` (${activeCount.toLocaleString('fa-IR')})` : ''}</button>
    </div>
    {sections.map(section => <section className="directory-filter-section" key={section.id}>
      <button type="button" id={`${id}-${section.id}-heading`} className="directory-filter-section__trigger"
        aria-expanded={opened === section.id} aria-controls={`${id}-${section.id}`}
        onClick={() => setOpened(opened === section.id ? null : section.id)}>
        <span>{section.label}{section.summary && <small>{section.summary}</small>}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={`${id}-${section.id}`} role="region" aria-labelledby={`${id}-${section.id}-heading`}
        hidden={opened !== section.id} className="directory-filter-section__body">{section.content}</div>
    </section>)}
    <button type="submit" className="filter-apply">{submitLabel}</button>
  </form>;
  return <>
    {isPhone && <div className="directory-filter-chips" aria-label={title}>
      <button type="button" onClick={() => open(null)}>فیلترها{activeCount ? ` · ${activeCount.toLocaleString('fa-IR')}` : ''}</button>
      {sections.map(section => <button key={section.id} type="button" onClick={() => open(section.id)}>
        {section.label}{section.summary ? ` · ${section.summary}` : ''}
      </button>)}
    </div>}
    <div className="directory-filter-layout">
      {!isPhone && <aside className="directory-filter-sidebar" aria-label={title}>{panel}</aside>}
      <div className="directory-filter-results">{children}</div>
    </div>
    <Dialog open={isPhone && drawerOpen} title={title} variant="drawer" onClose={() => setDrawerOpen(false)}>{panel}</Dialog>
  </>;
}
