import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { ProductFilters } from '../api/endpoints-shop';
import type { Brand, PetType, Tag } from '../api/types';
import { TomanInput } from './TomanInput';
import { rawTomanInput } from '../lib/toman-input';
import { publicRecordName } from '../lib/sample-records';

export type CatalogFilterSection = 'animal' | 'brand' | 'age' | 'size' | 'diet' | 'price' | 'sort';
type Option = { value: string; label: string };
const ages: Option[] = [{ value: '', label: 'همهٔ سن‌ها' }, { value: 'PUPPY_KITTEN', label: 'توله و بچه گربه' }, { value: 'ADULT', label: 'بالغ' }, { value: 'SENIOR', label: 'سالمند' }];
const sizes: Option[] = [{ value: '', label: 'همهٔ سایزها' }, { value: 'SMALL', label: 'کوچک' }, { value: 'MEDIUM', label: 'متوسط' }, { value: 'LARGE', label: 'بزرگ' }];
const sorts: Option[] = [{ value: 'newest', label: 'جدیدترین' }, { value: 'price_asc', label: 'ارزان‌ترین' }, { value: 'price_desc', label: 'گران‌ترین' }];

/** Only one expanded section; closing a section never clears its selection. */
export function CatalogFilters({ filters, onPatch, onClear, activeCount, openedSection, onOpenSection, petTypes, brands, dietTags, referencesPending, referencesError, onRetry }: {
  filters: ProductFilters; onPatch(patch: Partial<ProductFilters>): void; onClear(): void; activeCount: number;
  openedSection: CatalogFilterSection | null; onOpenSection(section: CatalogFilterSection | null): void;
  petTypes: PetType[]; brands: Brand[]; dietTags: Tag[];
  referencesPending: boolean; referencesError: boolean; onRetry(): void;
}) {
  const id = useId();
  const [priceError, setPriceError] = useState<string | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
  const selectedTags = (filters.tagIds ?? '').split(',').filter(Boolean);
  function section(key: CatalogFilterSection, title: string, children: ReactNode, selected?: string) {
    const open = openedSection === key;
    return <section className="catalog-filter-section" key={key}>
      <button id={`${id}-${key}-heading`} className="catalog-filter-section__trigger" type="button" aria-expanded={open}
        aria-controls={`${id}-${key}`} onClick={() => onOpenSection(open ? null : key)}>
        <span>{title}{selected && <small>{selected}</small>}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={`${id}-${key}`} role="region" aria-labelledby={`${id}-${key}-heading`} hidden={!open} className="catalog-filter-section__body">{children}</div>
    </section>;
  }
  function choices(key: string, options: Option[], current: string, change: (value: string) => void) {
    return <div className="catalog-filter-options">{options.map(option => <label key={option.value}>
      <input type="radio" name={`${id}-${key}`} value={option.value} checked={current === option.value} onChange={() => change(option.value)} />{option.label}
    </label>)}</div>;
  }
  function submitPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const minRaw = String(values.get('minPrice') ?? '').trim();
    const maxRaw = String(values.get('maxPrice') ?? '').trim();
    const parse = (raw: string) => /^\d+$/.test(rawTomanInput(raw)) ? Number(rawTomanInput(raw)) : NaN;
    const minPrice = minRaw ? parse(minRaw) : undefined;
    const maxPrice = maxRaw ? parse(maxRaw) : undefined;
    if ((minRaw && !Number.isSafeInteger(minPrice)) || (maxRaw && !Number.isSafeInteger(maxPrice)) ||
        (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)) {
      setPriceError('قیمت باید عدد صحیح و نامنفی باشد و حداقل از حداکثر بیشتر نباشد.'); return;
    }
    setPriceError(null); onPatch({ minPrice, maxPrice });
  }
  return <div className="filters filter-panel catalog-filter-panel">
    <div className="catalog-filter-panel__heading"><h2>فیلترها</h2><button type="button" onClick={() => { setPriceError(null); setResetVersion(value => value + 1); onClear(); }}>حذف فیلترها{activeCount ? ` (${activeCount.toLocaleString('fa-IR')})` : ''}</button></div>
    {referencesPending && <p role="status" className="catalog-reference-status">در حال دریافت گزینه‌ها…</p>}
    {referencesError && <div role="alert"><p>دریافت برخی گزینه‌های فیلتر ممکن نشد.</p><button type="button" onClick={onRetry}>تلاش دوباره</button></div>}
    {section('animal', 'نوع حیوان', choices('animal', [{ value: '', label: 'همهٔ حیوانات' }, ...petTypes.map(type => ({ value: String(type.id), label: type.name }))], String(filters.petTypeId ?? ''), value => onPatch({ petTypeId: value ? Number(value) : undefined })), petTypes.find(type => type.id === filters.petTypeId)?.name)}
    {section('brand', 'برند', choices('brand', [{ value: '', label: 'همهٔ برندها' }, ...brands.map(brand => ({ value: String(brand.id), label: publicRecordName(brand) }))], String(filters.brandId ?? ''), value => onPatch({ brandId: value ? Number(value) : undefined })), brands.find(brand => brand.id === filters.brandId)?.name)}
    {section('age', 'سن حیوان', choices('age', ages, filters.lifeStage ?? '', value => onPatch({ lifeStage: value || undefined })), ages.find(option => option.value === filters.lifeStage)?.label)}
    {section('size', 'جثهٔ حیوان', choices('size', sizes, filters.sizeClass ?? '', value => onPatch({ sizeClass: value || undefined })), sizes.find(option => option.value === filters.sizeClass)?.label)}
    {section('diet', 'نیازهای غذایی', <div className="catalog-filter-options">
      {dietTags.map(tag => <label key={tag.id}><input type="checkbox" checked={selectedTags.includes(String(tag.id))}
        onChange={event => onPatch({ tagIds: (event.target.checked ? [...selectedTags, String(tag.id)] : selectedTags.filter(value => value !== String(tag.id))).join(',') || undefined })} />{tag.name}</label>)}
      {!referencesPending && dietTags.length === 0 && <p>ویژگی رژیمی در دسترس نیست.</p>}
    </div>, selectedTags.length ? `${selectedTags.length.toLocaleString('fa-IR')} انتخاب` : undefined)}
    {section('price', 'محدودهٔ قیمت', <>
      <form className="price-filter" key={resetVersion} onSubmit={submitPrices}>
        <label htmlFor={`${id}-minPrice`}>از قیمت</label><TomanInput id={`${id}-minPrice`} name="minPrice" key={`min-${filters.minPrice ?? ''}`} defaultValue={filters.minPrice ?? ''} aria-invalid={priceError ? true : undefined} aria-describedby={priceError ? `${id}-price-error` : undefined} />
        <label htmlFor={`${id}-maxPrice`}>تا قیمت</label><TomanInput id={`${id}-maxPrice`} name="maxPrice" key={`max-${filters.maxPrice ?? ''}`} defaultValue={filters.maxPrice ?? ''} aria-invalid={priceError ? true : undefined} aria-describedby={priceError ? `${id}-price-error` : undefined} />
        <button className="filter-apply" type="submit">اعمال قیمت</button>
      </form>
      {priceError && <p role="alert" className="field__error" id={`${id}-price-error`}>{priceError}</p>}
    </>, filters.minPrice !== undefined || filters.maxPrice !== undefined ? 'انتخاب شده' : undefined)}
    {section('sort', 'مرتب‌سازی', choices('sort', sorts, filters.sort ?? 'newest', value => onPatch({ sort: value })), sorts.find(option => option.value === (filters.sort ?? 'newest'))?.label)}
    <label className="catalog-stock-filter"><input type="checkbox" checked={filters.inStock === true} onChange={event => onPatch({ inStock: event.target.checked })} /><span>فقط کالاهای موجود</span></label>
  </div>;
}
