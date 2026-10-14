import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { AdminSection } from "./navigation";
import { defaultSidebarOrder, isDefaultSidebarOrder, moveSidebarItem, readSidebarOrder, saveSidebarOrder, sidebarGroups, sidebarItems } from "./sidebar-order";
import "./sidebar-customization.css";

type RowGeometry = { id: AdminSection; top: number; height: number };
type Drag = {
  pointerId: number; item: AdminSection; startY: number; y: number; active: boolean;
  snapshot: AdminSection[]; rows: RowGeometry[]; gap: number; offset: number;
  scrollStart: number; scrollTop: number; scrollBottom: number;
};
type Props = {
  accountId: number | null; active: AdminSection; onSelect: (value: AdminSection) => void;
  open: boolean; onClose: () => void; mobile: boolean; brand: ReactNode;
  sidebarRef: RefObject<HTMLElement | null>; closeRef: RefObject<HTMLButtonElement | null>;
};

/** Account switches discard gesture state and read only that account's browser preference. */
export function AdminSidebar(props: Props) {
  return <SidebarForAccount key={props.accountId ?? "session"} {...props} />;
}

function SidebarForAccount({ accountId, active, onSelect, open, onClose, mobile, brand, sidebarRef, closeRef }: Props) {
  const [preference, setPreference] = useState(() => readSidebarOrder(accountId));
  const [editing, setEditing] = useState(false);
  const [grabbed, setGrabbed] = useState<AdminSection | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef(preference.order);
  const drag = useRef<Drag | null>(null);
  const keyboard = useRef<{ item: AdminSection; snapshot: AdminSection[] } | null>(null);
  const frame = useRef<number | null>(null);
  const floating = useRef<{ item: AdminSection; offset: number } | null>(null);
  const focusItem = useRef<AdminSection | null>(null);
  const mounted = useRef(false);
  const ignorePointerClick = useRef(false);
  const listId = useId();
  const orderedItems = preference.order.map(id => sidebarItems.find(item => item.id === id)!);
  const custom = !isDefaultSidebarOrder(preference.order);

  const row = useCallback((item: AdminSection) => {
    return listRef.current?.querySelector<HTMLElement>(`[data-sidebar-id="${item}"]`);
  }, []);
  const stopFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const clearVisual = useCallback(() => {
    if (floating.current) {
      const element = row(floating.current.item);
      element?.style.removeProperty("transform");
      element?.removeAttribute("data-floating");
    }
    floating.current = null;
  }, [row]);
  const present = useCallback((item: AdminSection, offset: number) => {
    if (floating.current && floating.current.item !== item) clearVisual();
    floating.current = { item, offset };
    const element = row(item);
    if (element) {
      element.style.transform = `translate3d(0, ${offset}px, 0)`;
      element.dataset.floating = "true";
    }
  }, [clearVisual, row]);
  const preview = useCallback((order: AdminSection[]) => {
    orderRef.current = order;
    setPreference(previous => ({ ...previous, order }));
  }, []);
  function persist(order: AdminSection[]) {
    orderRef.current = order;
    setPreference({ order, persistent: saveSidebarOrder(accountId, order) });
  }
  function describe(item: AdminSection, order = orderRef.current) {
    const label = sidebarItems.find(entry => entry.id === item)!.label;
    return `${label} در جایگاه ${(order.indexOf(item) + 1).toLocaleString("fa-IR")} از ${order.length.toLocaleString("fa-IR")}.`;
  }
  const release = useCallback((pointerId: number) => {
    if (listRef.current?.hasPointerCapture?.(pointerId)) listRef.current.releasePointerCapture(pointerId);
  }, []);
  const cancelInteraction = useCallback(() => {
    const pointer = drag.current;
    const keys = keyboard.current;
    drag.current = null; keyboard.current = null;
    stopFrame(); clearVisual();
    if (pointer) release(pointer.pointerId);
    if (pointer?.active || keys) {
      preview((pointer ?? keys)!.snapshot);
      setAnnouncement("جابه‌جایی لغو شد؛ ترتیب قبلی حفظ شد.");
    }
    setGrabbed(null);
  }, [clearVisual, preview, release, stopFrame]);
  function settleVisual() {
    stopFrame();
    const start = floating.current;
    if (!start || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { clearVisual(); return; }
    let started: number | null = null;
    const animate = (time: number) => {
      if (!mounted.current) return;
      started ??= time;
      const seconds = Math.max(0, (time - started) / 1000);
      // Critically damped spring: retain the current presentation, settle without bounce.
      const offset = start.offset * (1 + 26 * seconds) * Math.exp(-26 * seconds);
      present(start.item, offset);
      if (seconds >= .5 || Math.abs(offset) < .3) { frame.current = null; clearVisual(); }
      else frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
  }
  const dragPosition = useCallback((pointer: Drag) => {
    const scroller = sidebarRef.current;
    const scroll = (scroller?.scrollTop ?? pointer.scrollStart) - pointer.scrollStart;
    const original = pointer.rows.find(entry => entry.id === pointer.item)!;
    const center = pointer.y - pointer.startY + original.top + pointer.offset + original.height / 2;
    let target = 0;
    pointer.rows.forEach((entry, index) => {
      if (Math.abs(entry.top + entry.height / 2 - scroll - center) <
          Math.abs(pointer.rows[target]!.top + pointer.rows[target]!.height / 2 - scroll - center)) target = index;
    });
    const next = moveSidebarItem(orderRef.current, pointer.item, target);
    if (next.some((item, index) => item !== orderRef.current[index])) preview(next);
    const before = next.slice(0, next.indexOf(pointer.item));
    const top = pointer.rows[0]!.top - scroll + before.reduce((sum, item) => sum + pointer.rows.find(entry => entry.id === item)!.height + pointer.gap, 0);
    present(pointer.item, original.top + pointer.offset + pointer.y - pointer.startY - top);
  }, [present, preview, sidebarRef]);
  function scheduleDrag() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const pointer = drag.current;
      if (!pointer?.active) return;
      const scroller = sidebarRef.current;
      const previousScroll = scroller?.scrollTop ?? 0;
      if (scroller) {
        const step = pointer.y < pointer.scrollTop + 36 ? -10 : pointer.y > pointer.scrollBottom - 36 ? 10 : 0;
        if (step) scroller.scrollTop += step;
      }
      dragPosition(pointer);
      if (scroller && scroller.scrollTop !== previousScroll) scheduleDrag();
    });
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, item: AdminSection) {
    ignorePointerClick.current = false;
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0) || drag.current || keyboard.current) return;
    stopFrame();
    if (floating.current && floating.current.item !== item) clearVisual();
    const offset = floating.current?.offset ?? 0;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-sidebar-id]") ?? []).map(element => {
      const bounds = element.getBoundingClientRect();
      const id = element.dataset.sidebarId as AdminSection;
      return { id, top: bounds.top - (id === item ? offset : 0), height: bounds.height };
    });
    if (!rows.length) return;
    const scrollBounds = sidebarRef.current?.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId, item, startY: event.clientY, y: event.clientY, active: false,
      snapshot: [...orderRef.current], rows, gap: rows.length > 1 ? Math.max(0, rows[1]!.top - rows[0]!.top - rows[0]!.height) : 0,
      offset, scrollStart: sidebarRef.current?.scrollTop ?? 0,
      scrollTop: scrollBounds?.top ?? 0, scrollBottom: scrollBounds?.bottom ?? window.innerHeight,
    };
    event.currentTarget.focus({ preventScroll: true });
    listRef.current?.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = drag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { cancelInteraction(); return; }
    pointer.y = event.clientY;
    if (!pointer.active && Math.abs(pointer.y - pointer.startY) < 10) return;
    if (!pointer.active) { pointer.active = true; setGrabbed(pointer.item); }
    event.preventDefault(); scheduleDrag();
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const pointer = drag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (cancelled) { cancelInteraction(); return; }
    stopFrame(); pointer.y = event.clientY;
    if (pointer.active) {
      dragPosition(pointer);
      focusItem.current = pointer.item;
      persist([...orderRef.current]);
      setAnnouncement(describe(pointer.item));
    }
    drag.current = null; release(pointer.pointerId); setGrabbed(null);
    ignorePointerClick.current = true;
    if (!pointer.active) keyboardSelect(pointer.item);
    else settleVisual();
  }
  function keyboardSelect(item: AdminSection) {
    if (drag.current) return;
    stopFrame(); clearVisual();
    if (keyboard.current) {
      if (keyboard.current.item !== item) return;
      persist([...orderRef.current]); keyboard.current = null; setGrabbed(null);
      setAnnouncement(`ترتیب ثبت شد. ${describe(item)}`);
    } else {
      keyboard.current = { item, snapshot: [...orderRef.current] }; setGrabbed(item);
      setAnnouncement(`${describe(item)} با کلیدهای بالا و پایین جابه‌جا کنید.`);
    }
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, item: AdminSection) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault(); event.stopPropagation(); keyboardSelect(item); return;
    }
    if (event.key === "Escape" && (keyboard.current || drag.current)) {
      event.preventDefault(); event.stopPropagation(); cancelInteraction(); return;
    }
    if (keyboard.current?.item !== item || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = orderRef.current.indexOf(item);
    const target = event.key === "Home" ? 0 : event.key === "End" ? orderRef.current.length - 1 : index + (event.key === "ArrowUp" ? -1 : 1);
    moveSelection(item, target);
  }
  function moveSelection(item: AdminSection, target: number) {
    preview(moveSidebarItem(orderRef.current, item, target));
    focusItem.current = item;
    setAnnouncement(describe(item));
  }

  useLayoutEffect(() => {
    if (drag.current?.active) dragPosition(drag.current);
    if (focusItem.current) {
      const handle = row(focusItem.current)?.querySelector<HTMLButtonElement>(".sidebar-sort-handle");
      handle?.focus({ preventScroll: true });
      handle?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
      focusItem.current = null;
    }
  }, [preference.order, dragPosition, row]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopFrame(); clearVisual(); drag.current = null; keyboard.current = null; };
  }, [clearVisual, stopFrame]);
  useEffect(() => {
    if (mobile && !open) queueMicrotask(() => { if (mounted.current) cancelInteraction(); });
  }, [cancelInteraction, mobile, open]);

  function link(item: typeof sidebarItems[number], index = item.index) {
    return <button type="button" key={item.id}
      className={"sidebar-link" + (active === item.id ? " sidebar-link--active" : "")}
      aria-current={active === item.id ? "page" : undefined}
      onClick={() => { if (!drag.current?.active && !keyboard.current) onSelect(item.id); }}>
      <span className="sidebar-link__index" aria-hidden="true">{index}</span><span>{item.label}</span>
    </button>;
  }
  return <aside ref={sidebarRef} className={"sidebar" + (open ? " sidebar--open" : "")}
    id="admin-navigation" inert={mobile && !open}
    role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined}
    aria-label={mobile && open ? "فهرست مدیریت" : undefined} tabIndex={mobile && open ? -1 : undefined}>
    <div className="sidebar-brand-row">{brand}
      <button ref={closeRef} type="button" className="sidebar-close" onClick={() => { cancelInteraction(); onClose(); }} aria-label="بستن فهرست">×</button>
    </div>
    <div className="sidebar-order-tools">
      <button type="button" className="sidebar-order-toggle" aria-expanded={editing} aria-controls={listId}
        onClick={() => { cancelInteraction(); setEditing(value => !value); }}>{editing ? "پایان تنظیم ترتیب" : "تنظیم ترتیب"}</button>
      {editing && <>
        <button type="button" className="sidebar-order-reset" disabled={!custom && grabbed === null}
          onClick={() => { cancelInteraction(); persist([...defaultSidebarOrder]); setAnnouncement("ترتیب پیش‌فرض بازگردانده شد."); }}>بازگشت به ترتیب پیش‌فرض</button>
        {!preference.persistent && <p className="sidebar-order-warning" role="status">ذخیره در مرورگر ممکن نیست؛ چیدمان فقط برای همین بازدید حفظ می‌شود.</p>}
        {grabbed && keyboard.current && <div className="sidebar-order-steps" role="group" aria-label={`تغییر جایگاه ${sidebarItems.find(item => item.id === grabbed)!.label}`}>
          <button type="button" aria-label="انتقال گزینهٔ انتخاب‌شده به بالا" disabled={preference.order.indexOf(grabbed) === 0} onClick={() => moveSelection(grabbed, preference.order.indexOf(grabbed) - 1)}>↑</button>
          <button type="button" aria-label="انتقال گزینهٔ انتخاب‌شده به پایین" disabled={preference.order.indexOf(grabbed) === preference.order.length - 1} onClick={() => moveSelection(grabbed, preference.order.indexOf(grabbed) + 1)}>↓</button>
          <button type="button" onClick={() => keyboardSelect(grabbed)}>ثبت جایگاه</button>
          <button type="button" aria-label="لغو جابه‌جایی" onClick={cancelInteraction}>لغو</button>
        </div>}
      </>}
    </div>
    <nav aria-label="بخش‌های مدیریت" id={listId}>
      {!editing && !custom ? sidebarGroups.map(group => <div className="sidebar-group" key={group.title}>
        <span className="sidebar-label">{group.title}</span>{group.items.map(item => link(item))}
      </div>) : <div className="sidebar-group">
        <span className="sidebar-label">فهرست مدیریت</span>
        <div ref={listRef} className="sidebar-sort-list" onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}
          onLostPointerCapture={event => { if (event.target === event.currentTarget && drag.current?.pointerId === event.pointerId) cancelInteraction(); }}>
          {orderedItems.map((item, index) => <div className="sidebar-sort-row" key={item.id} data-sidebar-id={item.id}>
            {link(item, (index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 }))}
            {editing && <button className="sidebar-sort-handle" type="button" aria-label={`جابه‌جایی ${item.label}`}
              aria-pressed={grabbed === item.id} onPointerDown={event => pointerDown(event, item.id)} onKeyDown={event => keyDown(event, item.id)}
              onClick={event => { if (event.detail === 0 || !ignorePointerClick.current) keyboardSelect(item.id); ignorePointerClick.current = false; }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg>
            </button>}
          </div>)}
        </div>
      </div>}
    </nav>
    <p className="sidebar-sort-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    <p className="sidebar-note">دکتر گوپت<br /><span>فضای کار مدیریت فروشگاه</span></p>
  </aside>;
}
