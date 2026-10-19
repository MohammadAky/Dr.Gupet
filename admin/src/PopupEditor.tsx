import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import { errorMessage, markFormSaved, Notice, showFieldErrors } from "./management";
import "./popup-editor.css";
import { uploadedImagePath } from "./uploaded-image";

export type PopupContent = { enabled: boolean; title: string; body: string; image: string };
const emptyPopup: PopupContent = { enabled: false, title: "", body: "", image: "" };
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Only first-party raster paths may cause an image request in the preview. */
export function isPopupImagePath(value: string) {
  return value === "" || (value.length <= 500 &&
    /^\/(?:brand|uploads)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:webp|png|jpe?g)$/.test(value) &&
    !value.split("/").includes(".."));
}
function readPopup(value: unknown): PopupContent {
  if (!value || typeof value !== "object") throw new Error("تنظیمات پاپ‌آپ معتبر نیست.");
  const row = value as Record<string, unknown>;
  if (typeof row.enabled !== "boolean" || typeof row.title !== "string" || row.title.length > 90 ||
      typeof row.body !== "string" || row.body.length > 800 || typeof row.image !== "string" || !isPopupImagePath(row.image)) {
    throw new Error("تنظیمات پاپ‌آپ معتبر نیست.");
  }
  return { enabled: row.enabled, title: row.title, body: row.body, image: row.image };
}

export function PopupEditor() {
  const { request } = useAuth();
  const titleId = useId();
  const form = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [content, setContent] = useState<PopupContent>(emptyPopup);
  const [savedContent, setSavedContent] = useState<PopupContent>(emptyPopup);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localImage, setLocalImage] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = readPopup(await request<unknown>("/admin/storefront/popup"));
        if (!active) return;
        setContent(result); setSavedContent(result); setLoaded(true); setError("");
      } catch (problem) {
        if (active) setError(errorMessage(problem));
      }
    }
    void load();
    return () => { active = false; };
  }, [request, revision]);
  useEffect(() => () => { if (localImage) URL.revokeObjectURL(localImage.url); }, [localImage]);

  function dirty() {
    if (form.current) form.current.dataset.dirty = "true";
    setMessage(""); setError("");
  }
  function change(patch: Partial<PopupContent>) {
    dirty(); setContent(current => ({ ...current, ...patch }));
  }
  function chooseImage(file: File | undefined) {
    if (!file || pending.current) return;
    if (!imageTypes.has(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("تصویر PNG، JPEG یا WebP تا ۵ مگابایت انتخاب کنید."); return;
    }
    dirty(); setLocalImage({ file, url: URL.createObjectURL(file) });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !loaded) return;
    const element = event.currentTarget;
    const payload = { ...content, title: content.title.trim(), body: content.body.trim(), image: content.image.trim() };
    const errors: Record<string, string> = {};
    if (payload.title.length > 90) errors.popupTitle = "عنوان باید حداکثر ۹۰ نویسه باشد.";
    if (payload.body.length > 800) errors.popupBody = "متن باید حداکثر ۸۰۰ نویسه باشد.";
    if (payload.enabled && !payload.title && !payload.body && !payload.image && !localImage) errors.popupTitle = "تصویر، عنوان یا متن اضافه کنید.";
    if (!localImage && !isPopupImagePath(payload.image)) { setError("تصویر معتبر نیست؛ تصویر دیگری بارگذاری کنید."); return; }
    showFieldErrors(element, errors);
    if (Object.keys(errors).length) return;
    pending.current = true; setSaving(true); setError(""); setMessage("");
    try {
      if (localImage) {
        const formData = new FormData(); formData.append("file", localImage.file);
        const uploaded = await request<{ url: string }>("/upload/image", { method: "POST", formData });
        if (!mounted.current) return;
        const path = uploadedImagePath(uploaded?.url);
        if (!path) throw new Error("نشانی تصویر دریافتی معتبر نیست.");
        payload.image = path;
        setContent(current => ({ ...current, image: path })); setLocalImage(null);
      }
      await request("/admin/storefront/popup", { method: "PUT", body: payload });
      if (!mounted.current) return;
      setContent(payload); setSavedContent(payload); markFormSaved(element); setMessage("پاپ‌آپ ذخیره شد.");
    } catch (problem) {
      if (mounted.current) setError(errorMessage(problem));
    } finally {
      pending.current = false; if (mounted.current) setSaving(false);
    }
  }
  const previewImage = localImage?.url ?? (isPopupImagePath(content.image.trim()) ? content.image.trim() : "");
  return <section className="manage-card popup-editor" aria-labelledby={titleId}>
    <header className="manage-head"><h1 id={titleId}>پاپ‌آپ سایت</h1>
      {loaded && <span className="popup-editor__publication" aria-label="وضعیت انتشار پاپ‌آپ">در سایت: {savedContent.enabled ? "فعال" : "غیرفعال"}</span>}
    </header>
    {!loaded ? <>
      {!error && <p role="status">در حال دریافت…</p>}
      <Notice message={error} />
      {error && <button type="button" onClick={() => { setError(""); setRevision(value => value + 1); }}>تلاش دوباره</button>}
    </> : <>
      <form ref={form} className="manage-form popup-editor__form" data-draft-editor noValidate onSubmit={event => void save(event)}>
        <div className="popup-editor__fields">
          <label className="popup-editor__toggle"><input type="checkbox" checked={content.enabled} disabled={saving} onChange={event => change({ enabled: event.target.checked })} />نمایش پاپ‌آپ</label>
          <small>نمایش در سایت پس از ذخیره تغییر می‌کند. عنوان و متن اختیاری‌اند.</small>
          <label>عنوان<input name="popupTitle" maxLength={90} value={content.title} disabled={saving} onChange={event => change({ title: event.target.value })} /></label>
          <label>متن<textarea name="popupBody" rows={5} maxLength={800} value={content.body} disabled={saving} onChange={event => change({ body: event.target.value })} /></label>
          <label>تصویر پاپ‌آپ<input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} /></label>
          {(content.image || localImage) && <button type="button" disabled={saving} data-draft-keep onClick={() => { setLocalImage(null); change({ image: "" }); }}>حذف تصویر</button>}
          <button type="submit" className="manage-primary" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره پاپ‌آپ"}</button>
        </div>
        <aside className="popup-editor__preview" aria-label="پیش‌نمایش پاپ‌آپ">
          <span className="popup-editor__preview-label">پیش‌نمایش</span>
          <div className="popup-editor__dialog">
            {previewImage && <img key={previewImage} src={previewImage} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}
            {content.title.trim() && <h3>{content.title}</h3>}
            {content.body && <p>{content.body}</p>}
          </div>
        </aside>
      </form>
      <Notice message={error} /><Notice message={message} kind="success" />
    </>}
  </section>;
}
