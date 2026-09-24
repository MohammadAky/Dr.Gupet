import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <h1>۴۰۴</h1>
      <p>صفحه‌ای که دنبال آن بودید پیدا نشد.</p>
      <Link to="/">بازگشت به صفحهٔ اصلی</Link>
    </section>
  );
}
