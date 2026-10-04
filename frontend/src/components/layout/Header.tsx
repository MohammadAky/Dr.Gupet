import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { shopApi, type Page } from '../../api/endpoints-shop';
import type { Clinic, Medicine, Pharmacy, ProductCard } from '../../api/types';
import type { AuthStatus } from '../../auth/auth-provider';

type SearchSource = 'desktop' | 'mobile';
type SuggestionGroup = 'products' | 'medicines' | 'pharmacies' | 'clinics';

interface Suggestion {
  key: string;
  group: SuggestionGroup;
  name: string;
  detail: string;
  to: string;
}

interface DirectoryResult<T> {
  items: T[];
  limited: boolean;
}

interface DirectoryCache<T> {
  promise: Promise<DirectoryResult<T>>;
  expiresAt: number;
}

const GROUP_LABELS: Record<SuggestionGroup, string> = {
  products: 'محصولات',
  medicines: 'داروها',
  pharmacies: 'داروخانه‌ها',
  clinics: 'کلینیک‌ها',
};
const GROUP_ORDER = Object.keys(GROUP_LABELS) as SuggestionGroup[];
const DIRECTORY_PAGE_SIZE = 50;
const DIRECTORY_MAX_PAGES = 5;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c|\u200d|\u200e|\u200f|ـ/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR');
}

function eligibleSearch(value: string): boolean {
  return Array.from(value).filter((character) => /\p{L}/u.test(character)).length >= 3;
}

async function fetchDirectory<T>(load: (page: number) => Promise<Page<T>>): Promise<DirectoryResult<T>> {
  const first = await load(1);
  const totalPages = first.meta?.totalPages ?? 1;
  const lastPage = Math.min(Math.max(totalPages, 1), DIRECTORY_MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) => load(index + 2)),
  );
  return {
    items: [first, ...rest].flatMap((page) => page.data),
    limited: !first.meta || totalPages > DIRECTORY_MAX_PAGES,
  };
}

function uniqueSuggestions(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function productSuggestion(item: ProductCard): Suggestion | null {
  if (!item.slug || typeof item.name !== 'string' || !item.name.trim()) return null;
  return {
    key: `products-${item.id}`,
    group: 'products',
    name: item.name,
    detail: item.brand?.name ?? '',
    to: `/products/${encodeURIComponent(item.slug)}`,
  };
}

function namedSuggestion(
  group: Exclude<SuggestionGroup, 'products'>,
  item: Medicine | Pharmacy | Clinic,
): Suggestion | null {
  if (!Number.isSafeInteger(item.id) || item.id < 1 || !item.name?.trim()) return null;
  return {
    key: `${group}-${item.id}`,
    group,
    name: item.name,
    detail: 'city' in item ? item.city : (item.activeIngredient ?? ''),
    to: `/${group}/${item.id}`,
  };
}

function SearchSuggestions({
  source,
  items,
  pending,
  failed,
  limited,
  activeIndex,
  onActiveIndex,
  onSelect,
}: {
  source: SearchSource;
  items: Suggestion[];
  pending: boolean;
  failed: boolean;
  limited: boolean;
  activeIndex: number;
  onActiveIndex: (index: number) => void;
  onSelect: (item: Suggestion) => void;
}) {
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex < 0) return;
    const option = listboxRef.current?.querySelector<HTMLElement>(`#${source}-search-option-${activeIndex}`);
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, source]);

  return (
    <div className="search-suggestions">
      <div ref={listboxRef} id={`${source}-search-suggestions`} role="listbox" aria-label="پیشنهادهای جست‌وجو">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div className="search-suggestions__group" role="group" aria-label={GROUP_LABELS[group]} key={group}>
              <span className="search-suggestions__heading" aria-hidden="true">{GROUP_LABELS[group]}</span>
              {groupItems.map((item) => {
                const index = items.indexOf(item);
                return (
                  <button
                    className="search-suggestions__option"
                    type="button"
                    role="option"
                    id={`${source}-search-option-${index}`}
                    aria-selected={activeIndex === index}
                    key={item.key}
                    onMouseEnter={() => onActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(item)}
                  >
                    <span>{item.name}</span>
                    {item.detail && <small>{item.detail}</small>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {pending && <p className="search-suggestions__status" role="status">در حال جست‌وجو…</p>}
      {!pending && !items.length && (
        <p className="search-suggestions__status" role="status">
          {failed ? 'دریافت نتایج ممکن نشد؛ دوباره تلاش کنید.' : 'در نتایج بررسی‌شده موردی پیدا نشد.'}
        </p>
      )}
      {!pending && failed && items.length > 0 && (
        <p className="search-suggestions__status" role="status">برخی دسته‌ها در دسترس نبودند.</p>
      )}
      {!pending && limited && (
        <p className="search-suggestions__status search-suggestions__status--muted">
          پیشنهادهای مراکز به فهرست بارگذاری‌شده محدودند.
        </p>
      )}
    </div>
  );
}

interface HeaderProps {
  status: AuthStatus;
  userName: string | null;
  cartCount: number;
  search: string;
  menuOpen: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onLogout: () => void;
}

function Icon({ name }: { name: 'search' | 'cart' | 'user' | 'menu' }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    cart: (
      <>
        <path d="M3 5h2l2 11h11l3-8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Header({
  status,
  userName,
  cartCount,
  search,
  menuOpen,
  onSearchChange,
  onSearchSubmit,
  onMenuToggle,
  onMenuClose,
  onLogout,
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef(0);
  const pharmacyCacheRef = useRef<DirectoryCache<Pharmacy> | null>(null);
  const clinicCacheRef = useRef<DirectoryCache<Clinic> | null>(null);
  const [activeSearch, setActiveSearch] = useState<SearchSource | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [limited, setLimited] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedSearch = normalizeSearchText(search);
  const canSuggest = eligibleSearch(normalizedSearch);

  const getPharmacies = useCallback(() => {
    const current = pharmacyCacheRef.current;
    if (current && current.expiresAt > Date.now()) return current.promise;
    const promise = fetchDirectory((page) => shopApi.pharmacies({ page, limit: DIRECTORY_PAGE_SIZE }));
    const entry = { promise, expiresAt: Date.now() + 120_000 };
    pharmacyCacheRef.current = entry;
    void promise.catch(() => {
      if (pharmacyCacheRef.current === entry) pharmacyCacheRef.current = null;
    });
    return promise;
  }, []);

  const getClinics = useCallback(() => {
    const current = clinicCacheRef.current;
    if (current && current.expiresAt > Date.now()) return current.promise;
    const promise = fetchDirectory((page) => shopApi.clinics({ page, limit: DIRECTORY_PAGE_SIZE }));
    const entry = { promise, expiresAt: Date.now() + 120_000 };
    clinicCacheRef.current = entry;
    void promise.catch(() => {
      if (clinicCacheRef.current === entry) clinicCacheRef.current = null;
    });
    return promise;
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    queueMicrotask(() => setActiveSearch(null));
  }, [location.pathname]);

  useEffect(() => {
    if (!activeSearch || !canSuggest) return;
    const generation = ++generationRef.current;
    const query = Array.from(normalizedSearch).slice(0, 100).join('');
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        shopApi.products({ q: query, limit: 5 }),
        shopApi.medicines({ q: query, limit: 5 }),
        getPharmacies(),
        getClinics(),
      ] as const).then(([products, medicines, pharmacies, clinics]) => {
        if (generationRef.current !== generation) return;
        const matches = (name: string) => normalizeSearchText(name).includes(query);
        const next = uniqueSuggestions([
          ...(products.status === 'fulfilled' ? products.value.data : [])
            .map(productSuggestion)
            .filter((item): item is Suggestion => item !== null),
          ...(medicines.status === 'fulfilled' ? medicines.value.data : [])
            .map((item) => namedSuggestion('medicines', item))
            .filter((item): item is Suggestion => item !== null),
          ...(pharmacies.status === 'fulfilled' ? pharmacies.value.items : [])
            .filter((item) => matches(item.name))
            .slice(0, 5)
            .map((item) => namedSuggestion('pharmacies', item))
            .filter((item): item is Suggestion => item !== null),
          ...(clinics.status === 'fulfilled' ? clinics.value.items : [])
            .filter((item) => matches(item.name))
            .slice(0, 5)
            .map((item) => namedSuggestion('clinics', item))
            .filter((item): item is Suggestion => item !== null),
        ]);
        setSuggestions(next);
        setActiveIndex(-1);
        setFailed([products, medicines, pharmacies, clinics].some((item) => item.status === 'rejected'));
        setLimited(
          (pharmacies.status === 'fulfilled' && pharmacies.value.limited) ||
          (clinics.status === 'fulfilled' && clinics.value.limited),
        );
        setPending(false);
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      generationRef.current += 1;
    };
  }, [activeSearch, canSuggest, normalizedSearch, getPharmacies, getClinics]);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchRef.current?.focus();
  }, [mobileSearchOpen]);

  function closeSuggestions() {
    generationRef.current += 1;
    setActiveSearch(null);
    setActiveIndex(-1);
    setPending(false);
  }

  function selectSuggestion(item: Suggestion) {
    closeSuggestions();
    setMobileSearchOpen(false);
    onMenuClose();
    navigate(item.to);
  }

  function updateSearch(value: string, source: SearchSource) {
    generationRef.current += 1;
    onSearchChange(value);
    setActiveSearch(source);
    setSuggestions([]);
    setActiveIndex(-1);
    setFailed(false);
    setLimited(false);
    setPending(eligibleSearch(normalizeSearchText(value)));
  }

  function focusSearch(source: SearchSource) {
    setActiveSearch(source);
    if (canSuggest) setPending(true);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    if (activeSearch && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
      return;
    }
    closeSuggestions();
    onSearchSubmit(event);
    setMobileSearchOpen(false);
  }

  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>, source: SearchSource) {
    if (event.key === 'Escape') {
      if (activeSearch === source || (source === 'mobile' && mobileSearchOpen)) {
        event.preventDefault();
        closeSuggestions();
        if (source === 'mobile') setMobileSearchOpen(false);
      }
      return;
    }
    if (activeSearch !== source || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    }
  }

  return (
    <header className="app-header">
      <div className="header-main site-container">
        <div className="header-brand">
          <button type="button" className="mobile-toggle" aria-expanded={menuOpen}
            aria-controls="main-navigation" aria-label={menuOpen ? 'بستن فهرست' : 'باز کردن فهرست'}
            onClick={() => { closeSuggestions(); setMobileSearchOpen(false); onMenuToggle(); }}>
            <Icon name="menu" />
          </button>
          <Link to="/" className="app-logo" aria-label="دکتر گوپت، صفحهٔ اصلی" onClick={() => { closeSuggestions(); onMenuClose(); }}>
            <img src="/brand/logo.jpg" alt="" width="55" height="55" />
            <span>
              دکتر گوپت<small>DR. GUPET</small>
            </span>
          </Link>
        </div>
        <form className="header-search" role="search" onSubmit={submitSearch}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSuggestions(); }}>
          <input
            value={search}
            maxLength={100}
            onChange={(event) => updateSearch(event.target.value, 'desktop')}
            onFocus={() => focusSearch('desktop')}
            onKeyDown={(event) => searchKeyDown(event, 'desktop')}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={activeSearch === 'desktop' && canSuggest}
            aria-controls={activeSearch === 'desktop' && canSuggest ? 'desktop-search-suggestions' : undefined}
            aria-activedescendant={activeSearch === 'desktop' && activeIndex >= 0 ? `desktop-search-option-${activeIndex}` : undefined}
            aria-label="جستجوی محصولات، داروها و مراکز"
            placeholder="جستجوی محصول، دارو یا مرکز"
          />
          <button type="submit" aria-label="جستجو">
            <Icon name="search" />
          </button>
          {activeSearch === 'desktop' && canSuggest && (
            <SearchSuggestions source="desktop" items={suggestions} pending={pending} failed={failed}
              limited={limited} activeIndex={activeIndex} onActiveIndex={setActiveIndex} onSelect={selectSuggestion} />
          )}
        </form>
        <div className="header-actions">
          <button
            className="mobile-search-trigger"
            type="button"
            aria-label={mobileSearchOpen ? 'بستن جستجو' : 'باز کردن جستجو'}
            aria-expanded={mobileSearchOpen}
            aria-controls="mobile-site-search"
            onClick={() => { closeSuggestions(); onMenuClose(); setMobileSearchOpen((open) => !open); }}
          >
            <Icon name="search" />
          </button>
          {status === 'authed' ? (
            <>
              <Link
                className="header-account-link"
                to="/profile"
                aria-label={userName ? `${userName}، حساب من` : 'حساب من'}
              >
                <Icon name="user" />
                <span className="header-label">{userName ?? 'حساب من'}</span>
              </Link>
              <button className="logout-button" type="button" onClick={onLogout}>
                خروج
              </button>
            </>
          ) : (
            <Link className="header-account-link" to="/login" aria-label="ورود">
              <Icon name="user" />
              <span className="header-label">ورود</span>
            </Link>
          )}
          <Link to="/cart" className="cart-link" aria-label={`سبد خرید، ${cartCount} کالا`}>
            <Icon name="cart" />
            <span className="header-label">سبد خرید</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </Link>
        </div>
      </div>
      <form
        id="mobile-site-search"
        className="mobile-search site-container"
        role="search"
        onSubmit={submitSearch}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSuggestions(); }}
        hidden={!mobileSearchOpen}
      >
        <input
          ref={mobileSearchRef}
          value={search}
          maxLength={100}
          onChange={(event) => updateSearch(event.target.value, 'mobile')}
          onFocus={() => focusSearch('mobile')}
          onKeyDown={(event) => searchKeyDown(event, 'mobile')}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={activeSearch === 'mobile' && canSuggest}
          aria-controls={activeSearch === 'mobile' && canSuggest ? 'mobile-search-suggestions' : undefined}
          aria-activedescendant={activeSearch === 'mobile' && activeIndex >= 0 ? `mobile-search-option-${activeIndex}` : undefined}
          aria-label="جستجوی محصولات، داروها و مراکز در موبایل"
          placeholder="جستجوی محصول، دارو یا مرکز"
        />
        <button type="submit">جستجو</button>
        {activeSearch === 'mobile' && canSuggest && (
          <SearchSuggestions source="mobile" items={suggestions} pending={pending} failed={failed}
            limited={limited} activeIndex={activeIndex} onActiveIndex={setActiveIndex} onSelect={selectSuggestion} />
        )}
      </form>
      <nav id="main-navigation" className={`app-nav${menuOpen ? ' is-open' : ''}`} aria-label="ناوبری اصلی">
        <div className="app-nav__inner site-container" onClick={onMenuClose}>
          <NavLink to="/" end>
            صفحهٔ اصلی
          </NavLink>
          <NavLink to="/products">محصولات</NavLink>
          <NavLink to="/medicines">اطلاعات داروها</NavLink>
          <NavLink to="/pharmacies">داروخانه‌ها</NavLink>
          <NavLink to="/clinics">کلینیک‌ها</NavLink>
          {status === 'authed' && <NavLink to="/recommendations">پیشنهادهای من</NavLink>}
          {status === 'authed' && <NavLink to="/favorites">علاقه‌مندی‌ها</NavLink>}
          {status === 'authed' && <NavLink to="/orders">سفارش‌ها</NavLink>}
          {status === 'authed' && (
            <button className="mobile-logout" type="button" onClick={onLogout}>
              خروج از حساب
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
