import { Link } from 'react-router-dom';

export function Footer({ onNavigate }: { onNavigate: () => void }) {
  return (
    <footer className="app-footer" onClick={onNavigate}>
      <div className="footer-content site-container">
        <div className="footer-brand">
          <img src="/brand/logo.jpg" alt="" width="58" height="58" loading="lazy" />
          <div>
            <strong>دکتر گوپت</strong>
            <p>
              انتخاب محصول برای سگ و گربه، با اطلاعات روشن و تجربه‌ای ساده. اطلاعات دارویی جایگزین
              نظر دامپزشک نیست.
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
          <a href="/licenses/Vazirmatn-OFL.txt">مجوز قلم وزیرمتن</a>
        </div>
      </div>
      <div className="footer-bottom site-container">
        <span>
          حقوق محتوای اصیل دکتر گوپت متعلق به صاحب این برند است؛ تصاویر دارای مجوز مستقل‌اند.
        </span>
        <span>طراحی شده برای تجربهٔ فارسی و راست‌به‌چپ</span>
      </div>
    </footer>
  );
}
