import { SafeImage } from '../SafeImage';
import { Link } from 'react-router-dom';

export function Footer() {
  const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(new Date());
  return (
    <footer className="app-footer">
      <div className="footer-content site-container">
        <div className="footer-brand">
          <SafeImage src="/brand/logo.webp" alt="" width="58" height="58" loading="lazy" />
          <div>
            <strong>دکتر گوپت</strong>
            <p>
              انتخاب محصول برای سگ، گربه و پرنده، با اطلاعات روشن و تجربه‌ای ساده. اطلاعات دارویی
              جایگزین نظر دامپزشک نیست.
            </p>
          </div>
        </div>
        <div className="footer-links">
          <strong>فروشگاه</strong>
          <Link to="/products">همهٔ محصولات</Link>
          <Link to="/cart">سبد خرید</Link>
          <Link to="/orders">سفارش‌های من</Link>
        </div>
        <div className="footer-links">
          <strong>راهنما</strong>
          <Link to="/medicines">اطلاعات داروها</Link>
          <Link to="/pharmacies">داروخانه‌ها</Link>
          <Link to="/clinics">کلینیک‌ها</Link>
        </div>
      </div>
      <div className="footer-bottom site-container">
        <span>
          حقوق محتوای اصیل دکتر گوپت متعلق به صاحب این برند است؛ تصاویر دارای مجوز مستقل‌اند.{' '}
          <bdi dir="ltr">© {year}</bdi>
        </span>
      </div>
    </footer>
  );
}
