import { useState } from 'react';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Chip,
  DialogExample,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Radio,
  Select,
  Skeleton,
  Stepper,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';

function ToastSamples() {
  const { showToast } = useToast();
  return (
    <div className="ui-gallery__row">
      <Button tone="secondary" onClick={() => showToast('تغییرات نمونه ذخیره شد.', 'success')}>
        پیام موفقیت
      </Button>
      <Button
        tone="secondary"
        onClick={() => showToast('در این نمونه امکان دریافت اطلاعات وجود ندارد.', 'error')}
      >
        پیام خطا
      </Button>
    </div>
  );
}

function GalleryContent() {
  const [checked, setChecked] = useState(true);
  const [selected, setSelected] = useState('a');
  const [chip, setChip] = useState(false);
  const [page, setPage] = useState(2);
  const [tab, setTab] = useState('first');
  return (
    <div className="ui-gallery site-container">
      <header className="ui-gallery__hero">
        <span className="ui-gallery__eyebrow">فقط محیط توسعه · F1</span>
        <h1>گالری اجزای رابط کاربری</h1>
        <p>
          نمونهٔ فارسی و راست‌چینِ اجزای پایه. این صفحه داده یا درخواست شبکه ندارد و در نسخهٔ انتشار
          نمایش داده نمی‌شود.
        </p>
      </header>
      <Breadcrumb items={[{ label: 'خانه', href: '/' }, { label: 'اجزای رابط کاربری' }]} />
      <section className="ui-gallery__section" aria-labelledby="buttons-heading">
        <h2 id="buttons-heading">دکمه‌ها و برچسب‌ها</h2>
        <div className="ui-gallery__row">
          <Button>اقدام اصلی</Button>
          <Button tone="secondary">اقدام فرعی</Button>
          <Button tone="quiet">دکمهٔ ساده</Button>
          <Button tone="danger">حذف نمونه</Button>
          <Button disabled>غیرفعال</Button>
          <Button pending>در حال ذخیره</Button>
        </div>
        <div className="ui-gallery__row">
          <Badge>معمولی</Badge>
          <Badge tone="success">موجود</Badge>
          <Badge tone="warning">نیازمند بررسی</Badge>
          <Badge tone="danger">ناموجود</Badge>
          <Chip selected={chip} onClick={() => setChip(!chip)}>
            فیلتر قابل انتخاب
          </Chip>
        </div>
      </section>
      <section className="ui-gallery__section" aria-labelledby="forms-heading">
        <h2 id="forms-heading">ورودی‌ها و فرم</h2>
        <div className="ui-gallery__fields">
          <Input label="نام محصول" placeholder="نام را وارد کنید" hint="نمونهٔ راهنمای کنار فیلد" />
          <Input label="شماره تماس" defaultValue="۰۹۱۲۳۴۵۶۷۸۹" error="شماره واردشده معتبر نیست." />
          <Input label="فیلد غیرفعال" value="قابل ویرایش نیست" disabled readOnly />
          <Select label="دسته‌بندی" defaultValue="">
            <option value="" disabled>
              انتخاب کنید
            </option>
            <option value="pets">لوازم پت</option>
          </Select>
          <Textarea label="توضیحات" placeholder="توضیح نمونه" rows={3} />
          <Textarea
            label="متن بلند و خطادار"
            defaultValue="این یک نمونه متن طولانی برای بررسی خوانایی چند خط متن فارسی، نحوهٔ شکست سطرها و نمایش پیام خطا در عرض‌های کوچک است."
            error="توضیح باید کوتاه‌تر باشد."
          />
        </div>
        <div className="ui-gallery__row">
          <Checkbox
            label="گزینهٔ انتخابی"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <Checkbox label="غیرفعال" disabled />
          <Radio
            label="گزینهٔ اول"
            name="gallery-radio"
            checked={selected === 'a'}
            onChange={() => setSelected('a')}
          />
          <Radio
            label="گزینهٔ دوم"
            name="gallery-radio"
            checked={selected === 'b'}
            onChange={() => setSelected('b')}
          />
        </div>
      </section>
      <section className="ui-gallery__section" aria-labelledby="surfaces-heading">
        <h2 id="surfaces-heading">کارت و پیام‌ها</h2>
        <div className="ui-gallery__cards">
          <Card>
            <h3>کارت نمونه</h3>
            <p>متن توصیفی ساده برای بررسی فاصله‌گذاری، خوانایی و مرز کارت.</p>
            <Button tone="secondary" size="sm">
              بیشتر
            </Button>
          </Card>
          <Card>
            <h3>عنوان بلند برای بررسی شکستن متن در کارت‌های باریک و نمایش سازگار در تلفن همراه</h3>
            <p>محتوا باید بدون برش یا اسکرول افقی نمایش داده شود.</p>
          </Card>
        </div>
        <div className="ui-gallery__stack">
          <Alert title="یادآوری" tone="info">
            این یک متن اطلاع‌رسانی نمونه است.
          </Alert>
          <Alert title="موفق" tone="success">
            فرایند آزمایشی انجام شد.
          </Alert>
          <Alert title="هشدار" tone="warning">
            پیش از ادامه اطلاعات را بررسی کنید.
          </Alert>
          <Alert title="خطا" tone="error">
            خطای نمونه باید علاوه بر رنگ، با متن هم مشخص باشد.
          </Alert>
        </div>
      </section>
      <section className="ui-gallery__section" aria-labelledby="states-heading">
        <h2 id="states-heading">حالت‌های داده</h2>
        <div className="ui-gallery__cards">
          <div className="ui-gallery__skeleton" role="status" aria-label="در حال بارگذاری">
            <Skeleton width="70%" height="1.4rem" />
            <Skeleton />
            <Skeleton width="45%" />
          </div>
          <EmptyState
            title="موردی پیدا نشد"
            description="با تغییر جستجو دوباره تلاش کنید."
            action={
              <Button tone="secondary" size="sm">
                پاک‌کردن فیلتر
              </Button>
            }
          />
          <ErrorState
            description="دریافت داده‌ها در این نمونه ممکن نشد."
            onRetry={() => undefined}
          />
        </div>
      </section>
      <section className="ui-gallery__section" aria-labelledby="navigation-heading">
        <h2 id="navigation-heading">ناوبری و مراحل</h2>
        <Tabs
          label="تب‌های نمونه"
          activeId={tab}
          onChange={setTab}
          items={[
            {
              id: 'first',
              label: 'معرفی',
              content: <p>محتوای تب اول؛ با کلیدهای جهت‌نما نیز می‌توان جابه‌جا شد.</p>,
            },
            { id: 'second', label: 'جزئیات', content: <p>محتوای تب دوم.</p> },
            { id: 'third', label: 'غیرفعال', content: null, disabled: true },
          ]}
        />
        <Pagination page={page} totalPages={8} onChange={setPage} />
        <Stepper
          currentStep={1}
          steps={[
            { label: 'سبد خرید' },
            { label: 'آدرس و ارسال', description: 'مرحلهٔ جاری' },
            { label: 'پرداخت' },
          ]}
        />
      </section>
      <section className="ui-gallery__section" aria-labelledby="overlays-heading">
        <h2 id="overlays-heading">پنجره و پیام گذرا</h2>
        <div className="ui-gallery__row">
          <DialogExample variant="modal" />
          <DialogExample variant="drawer" />
          <ToastSamples />
        </div>
      </section>
    </div>
  );
}

export default function UiGalleryPage() {
  return <GalleryContent />;
}
