import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** A detail request must retain its heading and escape route while it loads. */
export function DirectoryDetailFrame({
  title,
  to,
  backLabel,
  children,
}: {
  title: string;
  to: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <article className="directory-detail">
      <Link className="detail-back" to={to}>
        {backLabel} <span aria-hidden="true">←</span>
      </Link>
      <h1>{title}</h1>
      {children}
    </article>
  );
}
