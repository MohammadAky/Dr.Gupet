# مستندات وب‌سرویس SMS.ir — راهنمای کامل توسعه بخش OTP

> **هدف این سند:** همه اطلاعات لازم برای پیاده‌سازی ارسال پیامک/OTP با سرویس [sms.ir](https://sms.ir) به‌صورت یک‌جا، برای توسعه‌دهندگان (انسان یا مدل‌های زبانی) **بدون نیاز به دسترسی به اینترنت**.
>
> **منبع:** صفحه رسمی مستندات REST API در `https://sms.ir/rest-api/` (درگاه `https://apidocs.sms.ir/`) — نسخه snapshot: **۲۰۲۶/۱۰/۰۱**.
> کالکشن Postman رسمی: `https://sms.ir/wp-content/uploads/2022/04/SMS.irPanelV2-PostmanCollection.zip` — پکیج‌های رسمی: `https://github.com/IPeCompany`
>
> اگر رفتار واقعی API با این سند مغایرت داشت، مرجع نهایی همان صفحه رسمی است؛ این سند را به‌روز کنید.

---

## ۱. مفاهیم کلی

### ۱.۱ آدرس پایه (Base URL)

```
https://api.sms.ir/v1
```

همه endpointها نسبت به این آدرس هستند (مثلاً `POST https://api.sms.ir/v1/send/verify`).

### ۱.۲ احراز هویت

کلید خصوصی (API Key) از پنل sms.ir در **هدر** هر درخواست ارسال می‌شود:

| هدر | مقدار | توضیح |
|---|---|---|
| `X-API-KEY` | کلید وب‌سرویس از پنل | احراز هویت (نام هدر حساس به حروف نیست؛ `x-api-key` هم پذیرفته می‌شود) |
| `Content-Type` | `application/json` | برای درخواست‌های دارای بدنه JSON |
| `Accept` | `application/json` یا `application/xml` | فرمت خروجی (نمونه‌های رسمی گاه `Accept: text/plain` دارند، ولی بدنه همیشه JSON است) |

کلیدها در پنل: **برنامه‌نویسان ← لیست کلیدهای API ← ایجاد کلید جدید**. دو نوع کلید داریم: **اصلی (Production)** و **Sandbox** (بخش ۵).

### ۱.۳ مدل بازگشتی یکپارچه (Response Envelope)

**همه** درخواست‌ها — موفق یا ناموفق — این ساختار را دارند:

```json
{
  "status": 1,
  "message": "موفق",
  "data": { }
}
```

| فیلد | نوع | توضیح |
|---|---|---|
| `status` | Integer | کد وضعیت منطقی (جدول کامل در بخش ۶). **فقط `1` یعنی موفق** |
| `message` | String | توضیح فارسی وضعیت |
| `data` | هر نوع | دیتای بازگشتی (شکل آن بسته به endpoint متفاوت است؛ می‌تواند object، آرایه یا عدد باشد) |

> ⚠️ **نکته حیاتی:** موفق بودن HTTP (200) به‌تنهایی کافی نیست؛ حتماً `status === 1` را چک کنید. خطاهای منطقی با HTTP 400 و بدنه همین envelope برمی‌گردند.

### ۱.۴ کدهای HTTP Status

| کد HTTP | معنی |
|---|---|
| `200` | عملیات موفق (باز هم `status` بدنه را چک کنید) |
| `400` | خطای منطقی (وضعیت داخل `status` بدنه) |
| `401` | خطا در احراز هویت |
| `429` | تعداد درخواست غیرمجاز (rate limit) |
| `500` | خطای غیرمنتظره |

### ۱.۵ زمان (Unix Time)

همه مقادیر زمانی (`sendDateTime`، `deliveryDateTime`، `receivedDateTime`، `fromDate`، `toDate`) به‌صورت **Unix Time بر حسب UTC** (ثانیه) هستند.

---

## ۲. بخش OTP — ارسال کد تایید (متد Verify) ★

این **متد اصلی برای OTP ماست**. پیامک OTP با **خطوط خدماتی** و **اولویت بالا** ارسال می‌شود و به شماره‌های لیست سیاه (که پیامک تبلیغاتی را مسدود کرده‌اند) هم می‌رسد. پیش‌نیاز: **تعریف قالب (پترن) در پنل**.

### ۲.۱ پیش‌نیاز: تعریف قالب پیامک

1. در پنل sms.ir به بخش **ارسال سریع** بروید و یک قالب پیامک بسازید (مثلاً: `کد تایید شما: #Code#`).
2. پارامترهای قالب را با `#` مشخص می‌کنید (مثل `#Code#`). **نام پارامتر همان چیزی است که بین `#`هاست** — در API آن را **بدون `#`** می‌فرستید (مثلاً `Code`).
3. پس از تایید قالب، یک **`templateId` عددی** دریافت می‌کنید. این شناسه را در تنظیمات پروژه قرار دهید.
4. متن باید توسط پشتیبانی/سامانه تایید شود؛ متنِ ردشده → کد `117`.

### ۲.۲ درخواست

```
POST https://api.sms.ir/v1/send/verify
```

هدرها: `X-API-KEY` + `Content-Type: application/json`

بدنه (JSON):

```json
{
  "mobile": "0912xxxxxxx",
  "templateId": 123456,
  "parameters": [
    { "name": "Code", "value": "12345" }
  ]
}
```

| فیلد | نوع | اجباری | توضیح |
|---|---|---|---|
| `mobile` | String | ✅ | شماره موبایل گیرنده (نگاه کنید به بخش ۲.۵) |
| `templateId` | Integer | ✅ | شناسه قالب تعریف‌شده در پنل |
| `parameters` | Array of `{name, value}` | ✅ | مقادیر جایگزین‌شونده در قالب |

مدل هر parameter:

| فیلد | نوع | اجباری | توضیح |
|---|---|---|---|
| `name` | String | ✅ | کلید قالب **بدون `#`** (مثلاً برای `#Code#` مقدار `Code` را بفرستید). خالی نباشد (کد `116`) |
| `value` | String | ✅ | مقدار جایگزین — **حداکثر ۲۵ کاراکتر** (بیشتر شود → کد `114`) |

### ۲.۳ پاسخ موفق

```json
{
  "status": 1,
  "message": "موفق",
  "data": {
    "messageId": 89545112,
    "cost": 1.0
  }
}
```

| فیلد | نوع | توضیح |
|---|---|---|
| `data.messageId` | Integer | شناسه یکتای پیامک — برای پیگیری دلیوری (بخش ۴) نگه دارید |
| `data.cost` | Decimal | اعتبار مصرفی |

### ۲.۴ خطاهای رایج متد Verify

| کد `status` | معنی | واکنش درست |
|---|---|---|
| `113` | قالب یافت نشد | `templateId` را چک کنید |
| `114` | مقدار parameter بیش از ۲۵ کاراکتر | مقدار (کد OTP) را کوتاه‌تر کنید |
| `115` | شماره در لیست سیاه است | برای OTP باید از همین متد Verify استفاده شود (خط خدماتی)؛ اگر باز هم ۱۱۵ گرفتید با پشتیبانی در میان بگذارید |
| `116` | نام parameter خالی است | `name` را پر کنید |
| `117` | متن ارسالی تاییدشده نیست | قالب را از پنل پیگیری/ویرایش کنید |
| `104` | شماره موبایل نادرست | نرمال‌سازی شماره (بخش ۲.۵) |
| `102` | اعتبار کافی نیست | شارژ پنل |
| `119` | قالب شخصی‌سازی‌شده نیاز به ارتقای پلن دارد | پلن پنل را ارتقا دهید |
| `20` | تعداد درخواست بیش از حد مجاز | بک‌آف/retry با تاخیر — هم‌زمان با محدودسازی سمت خودمان |

### ۲.۵ فرمت شماره موبایل

نمونه‌های مستندات رسمی با فرمت‌های مختلف آمده‌اند:

```
912xxxx677
0912xxxx677
00912xxxx677
+98919xxxx904
```

یعنی API فرمت‌های `09..`، `9..`، `00989..` و `+989..` را می‌پذیرد. **قرارداد پیشنهادی ما:** قبل از ارسال، شماره را به فرمت ملی `09xxxxxxxxx` نرمال کنید (رگولار: `^09\d{9}$`). ذخیره در دیتابیس ما هم با همین فرمت باشد.

---

## ۳. سایر متدهای ارسال (برای اطلاعات تکمیلی)

### ۳.۱ ارسال گروهی (Bulk)

```
POST https://api.sms.ir/v1/send/bulk
```

| فیلد بدنه | نوع | اجباری | توضیح |
|---|---|---|---|
| `lineNumber` | Long | ✅ | شماره خط ارسالی (از `GET /v1/line`) |
| `messageText` | String | ✅ | متن پیامک |
| `mobiles` | Array of String | ✅ | حداکثر **۱۰۰** شماره |
| `sendDateTime` | UnixTime | ➖ | زمان‌بندی: از ۱ ساعت آینده تا حداکثر ۳۶۵ روز آینده؛ خالی = ارسال فوری |

پاسخ `data`:

```json
{
  "packId": "2b99e63c-9bf8-4a21-9bfe-3f72dc1b46f1",
  "messageIds": [86522023, 86522024],
  "cost": 2.0
}
```

> در `messageIds` مقدار `0` برای شماره متناظر یعنی آن شماره در **لیست سیاه** است. (ارسال‌های Bulk با خط اختصاصی انجام می‌شوند و اگر خط خدماتی نشده باشد به لیست سیاه نمی‌رسد — برای OTP از Verify استفاده کنید.)

### ۳.۲ ارسال نظیر به نظیر (LikeToLike)

```
POST https://api.sms.ir/v1/send/likeToLike
```

مانند Bulk ولی `messageTexts` آرایه‌ای از متن‌هاست (هر شماره، متن مخصوص خودش). تعداد متن‌ها و شماره‌ها باید برابر باشد (کد `110`).

### ۳.۳ حذف ارسال زمان‌بندی‌شده

```
DELETE https://api.sms.ir/v1/send/scheduled/{packId}
```

تا **۳ دقیقه قبل** از زمان ارسال قابل لغو است. پاسخ: `{ "returnedCreditCount": 10.0, "smsCount": 5 }`.

### ۳.۴ ارسال از طریق URL (قدیمی)

```
GET/POST https://api.sms.ir/v1/send?username=...&password=...&line=...&mobile=...&text=...
```

با `username` + `password` (کلید خصوصی). برای کد جدید **استفاده نکنید**؛ متد Verify با هدر `X-API-KEY` ترجیح دارد.

---

## ۴. گزارش‌ها و پیگیری دلیوری

### ۴.۱ وضعیت یک پیامک

```
GET https://api.sms.ir/v1/send/{messageId}
```

`data`:

| فیلد | نوع | توضیح |
|---|---|---|
| `messageId` | Integer | شناسه پیامک |
| `mobile` | Long | شماره گیرنده |
| `messageText` | String | متن |
| `sendDateTime` | UnixTime | زمان ارسال |
| `lineNumber` | Long | خط ارسالی |
| `cost` | Decimal | اعتبار کسرشده |
| `deliveryState` | Nullable Byte | وضعیت دلیوری (جدول بخش ۷) |
| `deliveryDateTime` | Nullable UnixTime | زمان دلیوری |

### ۴.۲ سایر گزارش‌های ارسال

| Endpoint | متد | توضیح | پارامترها |
|---|---|---|---|
| `/v1/send/pack` | GET | مجموعه ارسال‌های **روز جاری** | `pageSize` (پیش‌فرض 100)، `pageNumber` (پیش‌فرض 1) → `{packId, recipientCount, creationDateTime}` |
| `/v1/send/pack/{packId}` | GET | همه پیامک‌های یک مجموعه + وضعیتشان | — |
| `/v1/send/live` | GET | ارسال‌های **روز جاری** | `pageSize` (max 100)، `pageNumber` |
| `/v1/send/archive` | GET | ارسال‌های گذشته (تا پایان دیروز) | `fromDate`، `toDate` (UnixTime)، `pageSize`، `pageNumber` |

### ۴.۳ پیامک‌های دریافتی (Inbox)

| Endpoint | متد | توضیح | پارامترها |
|---|---|---|---|
| `/v1/receive/latest` | GET | **تازه‌ترین** پیامک‌های دریافتی — ⚠️ **هر پیامک فقط یک بار** از این متد قابل دریافت است (بعد از خواندن، دیگر برنمی‌گردد) | `count` (max و پیش‌فرض 100) |
| `/v1/receive/live` | GET | پیامک‌های دریافتی **امروز** (خوانده و نخوانده؛ اول صبح، دیروز را هم می‌دهد) | `pageSize`، `pageNumber`، `sortByNewest` (Boolean) |
| `/v1/receive/archive` | GET | دریافتی‌های گذشته | `fromDate`، `toDate`، `pageSize`، `pageNumber` |

مدل هر پیام دریافتی: `{ receiveReturnId, messageText, number, mobile, receivedDateTime }` (`number` = خط دریافت‌کننده).

---

## ۵. محیط Sandbox (تست بدون ارسال واقعی) ★

برای توسعه و تست OTP **حتماً** از Sandbox استفاده کنید — بدون ارسال پیامک واقعی و بدون کسر اعتبار.

| ویژگی | توضیح |
|---|---|
| کلید جداگانه | از پنل: **برنامه‌نویسان ← لیست کلیدهای API ← ایجاد کلید جدید ← نوع: Sandbox** |
| URL/ساختار | **دقیقاً مشابه محیط اصلی** — فقط کلید هدر فرق می‌کند |
| خطاها | مشابه محیط اصلی (ورودی‌ها را واقعاً validate می‌کند) |
| گزارش‌ها | هیچ گزارشی ثبت نمی‌شود |
| قالب پیش‌فرض Verify | **`templateId = 123456`** با متن «کد تایید شما: #CODE#» — نام پارامتر: `Code` (یا `CODE`؛ نام دقیقِ قالب پیش‌فرض طبق نمونه رسمی `Code` است) |

نمونه درخواست Verify در Sandbox:

```bash
curl -X POST 'https://api.sms.ir/v1/send/verify' \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/plain' \
  -H 'x-api-key: YOUR_SANDBOX_API_KEY' \
  -d '{
    "mobile": "0912xxxxxxx",
    "templateId": 123456,
    "parameters": [ { "name": "Code", "value": "12345" } ]
  }'
```

پاسخ موفق، همان envelope استاندارد با `data.messageId` و `data.cost` شبیه‌سازی‌شده است.

---

## ۶. جدول کامل کدهای وضعیت (`status` بدنه)

### کدهای ارسال

| کد | معنی |
|---|---|
| `1` | ✅ عملیات با موفقیت انجام شد |
| `0` | مشکل داخلی سامانه (با پشتیبانی تماس بگیرید) |
| `10` | کلید وب‌سرویس نامعتبر است |
| `11` | کلید وب‌سرویس غیرفعال است |
| `12` | کلید وب‌سرویس محدود به IPهای تعریف‌شده است |
| `13` | حساب کاربری غیرفعال است |
| `14` | حساب کاربری در حالت تعلیق است |
| `20` | تعداد درخواست بیش از حد مجاز (rate limit) |
| `101` | شماره خط نامعتبر است |
| `102` | اعتبار کافی نیست |
| `103` | درخواست دارای متن(های) خالی است |
| `104` | درخواست دارای موبایل(های) نادرست است |
| `105` | تعداد موبایل‌ها بیش از حد مجاز (۱۰۰ عدد) |
| `106` | تعداد متن‌ها بیش از حد مجاز (۱۰۰ عدد) |
| `107` | لیست موبایل‌ها خالی است |
| `108` | لیست متن‌ها خالی است |
| `109` | زمان ارسال نامعتبر است |
| `110` | تعداد شماره‌ها و متن‌ها برابر نیست |
| `111` | شناسه ارسالی ثبت نشده است |
| `112` | رکوردی برای حذف یافت نشد |
| `113` | قالب یافت نشد |
| `114` | طول مقدار parameter بیش از حد مجاز (۲۵ کاراکتر) |
| `115` | شماره(ها) در لیست سیاه سامانه هستند |
| `116` | نام parameter نمی‌تواند خالی باشد |
| `117` | متن ارسالی مورد تایید نیست |
| `118` | تعداد پیام‌ها بیش از حد مجاز |
| `119` | برای قالب شخصی‌سازی‌شده باید پلن را ارتقا دهید |
| `123` | خط ارسال‌کننده نیاز به فعال‌سازی دارد |

### کدهای دلیوری (`deliveryState`)

| کد | معنی |
|---|---|
| `1` | رسیده به گوشی ✅ |
| `2` | نرسیده به گوشی |
| `3` | در حال پردازش در مخابرات |
| `4` | نرسیده به مخابرات |
| `5` | رسیده به مخابرات |
| `6` | خطا |
| `7` | لیست سیاه |

---

## ۷. تنظیمات امنیتی و لیست سفید IP

اگر سرور شما فایروال با محدودیت IP ورودی/خروجی دارد، IPهای **خروجی** سرورهای sms.ir را whitelist کنید (هر دو، به‌خاطر failover خودکار):

- سرور اصلی: `185.211.56.44`
- سرور پشتیبان (Failover): `78.158.166.99`

> کد `12` یعنی کلید API شما در پنل به IPهای خاصی محدود شده (تنظیم خودِ پنل) — آن را بردارید یا IP سرورتان را اضافه کنید.

---

## ۸. پیاده‌سازی در Dr.Gupet

### ۸.۱ وضعیت فعلی کد

- `backend/src/sms/sms.service.ts`: اینترفیس `SmsDriver` با متدهای `sendOtp(phone, code)` و `sendText(phone, text)`؛ درایورهای `console` (فعال در dev)، `kavenegar` و `smsir` (placeholder — **TODO**).
- `backend/src/modules/auth/otp.service.ts`: تولید/اعتبارسنجی OTP (هش‌شده در Redis) را خودش انجام می‌دهد؛ **sms.ir فقط نقش «پیام‌رسان» را دارد** — یعنی کد را ما تولید و تایید می‌کنیم و sms.ir فقط متن پیام را می‌فرستد. (برعکس برخی سرویس‌ها که خودشان OTP صادر/تایید می‌کنند.)
- `.env.example`: `SMS_DRIVER=console` و `SMS_API_KEY=`.

### ۸.۲ متغیرهای محیطی پیشنهادی

```dotenv
SMS_DRIVER=smsir                 # console | smsir
SMS_API_KEY=                     # کلید اصلی یا Sandbox از پنل sms.ir
SMS_IR_TEMPLATE_ID=              # templateId قالب OTP (در Sandbox: 123456)
SMS_IR_PARAM_NAME=Code           # نام پارامتر قالب (بدون #)
SMS_IR_BASE_URL=https://api.sms.ir/v1
```

### ۸.۳ نمونه پیاده‌سازی `SmsIrSmsDriver` (TypeScript / NestJS)

```typescript
// نمونه مرجع — در backend/src/sms/sms.service.ts جایگزین SmsIrSmsDriver شود
interface SmsIrEnvelope {
  status: number;
  message: string;
  data?: any;
}

class SmsIrSmsDriver implements SmsDriver {
  private readonly baseUrl =
    process.env.SMS_IR_BASE_URL ?? 'https://api.sms.ir/v1';
  private readonly apiKey = process.env.SMS_API_KEY ?? '';
  private readonly templateId = Number(process.env.SMS_IR_TEMPLATE_ID ?? 0);
  private readonly paramName = process.env.SMS_IR_PARAM_NAME ?? 'Code';

  /** نرمال‌سازی شماره ایران به فرمت 09xxxxxxxxx */
  private normalizeMobile(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (/^09\d{9}$/.test(digits)) return digits;
    if (/^989\d{9}$/.test(digits)) return '0' + digits.slice(2);
    if (/^\+989\d{9}$/.test(digits)) return digits.slice(3).padStart(11, '0');
    if (/^9\d{9}$/.test(digits)) return '0' + digits;
    throw new Error(`Invalid Iranian mobile: ${phone}`);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send/verify`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        mobile: this.normalizeMobile(phone),
        templateId: this.templateId,
        parameters: [{ name: this.paramName, value: code }], // ≤25 کاراکتر
      }),
    });

    const body = (await res.json()) as SmsIrEnvelope;
    if (!res.ok || body.status !== 1) {
      // status را لاگ کنید (10..14 امنیتی، 102 اعتبار، 113 قالب، ...)
      throw new Error(`sms.ir verify failed: status=${body.status} ${body.message}`);
    }
    // اختیاری: body.data.messageId را برای پیگیری دلیوری ذخیره کنید
  }

  async sendText(phone: string, text: string): Promise<void> {
    // POST /v1/send/bulk با lineNumber از GET /v1/line — برای پیامک‌های اطلاع‌رسانی
    throw new Error('Implement bulk send if needed');
  }
}
```

### ۸.۴ نکات ادغام با جریان OTP (مهم)

1. **کد OTP را خودمان می‌سازیم** (۶ رقمی، هش‌شده در Redis با TTL، محدودیت تلاش، cooldown) — sms.ir فقط ارسال می‌کند. تایید کد (verify) **در کد ما** انجام می‌شود، نه در API sms.ir.
2. **شکست ارسال SMS نباید OTP را بسوزاند:** اگر `sendOtp` خطا داد، باید کد از Redis حذف شود یا به کاربر خطا برگردد؛ حالتی که کد ساخته شود ولی پیامک نرود، کاربر را قفل می‌کند. (در `requestOtp` فعلی، `generate` و `sendOtp` پشت سر هم‌اند — در پیاده‌سازی واقعی، خطا در send را handle کنید.)
3. **retry در برابر خطاهای گذرا:** فقط برای HTTP 429/500 یا status `0`/`20` با backoff کوتاه retry کنید؛ برای خطاهای منطقی (۱۱۳، ۱۱۴، ۱۰۴ و…) retry بی‌فایده است.
4. **timeout:** برای fetch مقدار timeout (مثلاً ۱۰ ثانیه) بگذارید تا درخواست‌های کاربران گیر نکند.
5. **لاگ امنیتی:** کلید API را هرگز لاگ/کامیت نکنید؛ `messageId` و `status` را لاگ کنید.
6. **مقادیر parameter حداکثر ۲۵ کاراکتر** — کد ۶ رقمی مشکلی ندارد، ولی اگر روزی متن طولانی‌تری (مثل لینک) فرستادید، به این محدودیت دقت کنید.
7. **ریت‌لیمیت سمت خودمان:** از قبل در `otp.service.ts` cooldown و max attempts داریم (این‌ها مکمل ریت‌لیمیت sms.ir هستند، نه جایگزین).

### ۸.۵ چک‌لیست راه‌اندازی

- [ ] ثبت‌نام در `https://app.sms.ir/auth/sign-up` و تکمیل احراز هویت پنل
- [ ] ایجاد **کلید Sandbox** و تست با `templateId=123456`
- [ ] تعریف قالب OTP واقعی در پنل (ارسال سریع) و دریافت `templateId`
- [ ] تنظیم متغیرهای محیطی (۸.۲)
- [ ] پیاده‌سازی `SmsIrSmsDriver` (۸.۳) + تست واحد با mock
- [ ] تست end-to-end با Sandbox (درخواست OTP → دریافت پاسخ `status:1`)
- [ ] سوییچ به کلید Production + شارژ اعتبار
- [ ] (اختیاری) بررسی دلیوری با `GET /v1/send/{messageId}` و لاگ `deliveryState`
- [ ] (اختیاری) Whitelist کردن IPهای خروجی sms.ir در فایروال (بخش ۷)

---

## ۹. خلاصه سریع (Cheat Sheet)

```
Base URL:   https://api.sms.ir/v1
Auth:       Header  X-API-KEY: <key>
Envelope:   { "status": 1|<code>, "message": "...", "data": ... }   ← فقط status==1 موفق

OTP:        POST /send/verify
            { "mobile": "09...", "templateId": 123456,
              "parameters": [ { "name": "Code", "value": "12345" } ] }   ← value ≤ 25 chars
            → data: { messageId, cost }

Sandbox:    کلید جداگانه (نوع Sandbox) — قالب پیش‌فرض: templateId 123456 / پارامتر Code
Delivery:   GET /send/{messageId}  → deliveryState: 1..7  (1=رسیده به گوشی)
Credit:     GET /credit
Lines:      GET /line
Rate limit: HTTP 429 یا status 20 — با backoff retry کنید
```
