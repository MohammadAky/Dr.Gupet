import { SafeImage } from '../components/SafeImage';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <div className="not-found__art" aria-hidden="true">
        <SafeImage src="/brand/companion-cat-960.webp" width="960" height="720" alt="" />
        <span>۴۰۴</span>
      </div>
      <div className="not-found__copy">
        <p className="eyebrow">صفحه پیدا نشد</p>
        <h1 id="not-found-title">این مسیر به جایی نمی‌رسد.</h1>
        <p>
          ممکن است نشانی تغییر کرده باشد یا این صفحه دیگر در دسترس نباشد. از اینجا مسیر تازه‌ای
          انتخاب کنید.
        </p>
        <div className="not-found__actions">
          <Link className="button-primary" to="/">
            بازگشت به خانه ←
          </Link>
          <Link className="button-secondary" to="/products">
            دیدن محصولات
          </Link>
        </div>
        <nav aria-label="مسیرهای پیشنهادی">
          <Link to="/clinics">کلینیک‌ها</Link>
          <Link to="/pharmacies">داروخانه‌ها</Link>
          <Link to="/medicines">اطلاعات داروها</Link>
        </nav>
      </div>
    </section>
  );
}
