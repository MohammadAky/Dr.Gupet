import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Chunk/network failures keep navigation available and offer a deliberate retry. */
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="route-unavailable" aria-labelledby="route-unavailable-title">
          <h1 id="route-unavailable-title">صفحه بارگذاری نشد</h1>
          <p role="alert">ارتباط را بررسی کنید و صفحه را دوباره بارگذاری کنید.</p>
          <button type="button" className="button-primary" onClick={() => window.location.reload()}>
            بارگذاری دوبارهٔ صفحه
          </button>
          <Link className="account-secondary-link" to="/">
            بازگشت به صفحهٔ اصلی
          </Link>
        </section>
      );
    }
    return this.props.children;
  }
}
