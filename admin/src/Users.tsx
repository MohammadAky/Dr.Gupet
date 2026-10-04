import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import {
  errorMessage,
  formatDate,
  formatMoney,
  formatNumber,
  Notice,
  PageHeader,
  Paginator,
  QueryState,
  useDetail,
  usePaged,
} from "./management";
import "./management.css";

type UserRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  deletedAt: string | null;
  createdAt: string;
  isPhoneVerified: boolean;
  _count: {
    orders: number;
    pets: number;
    addresses: number;
    favorites?: number;
  };
};
type UserDetail = UserRow & {
  pets: {
    id: number;
    name: string;
    petType: { name: string };
    breed: { name: string } | null;
  }[];
  addresses: {
    id: number;
    title: string;
    province: string;
    city: string;
    fullAddress: string;
  }[];
  orders: {
    id: number;
    orderNumber: string;
    status: string;
    finalAmount: number;
    createdAt: string;
  }[];
};
const fullName = (user: UserRow) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || "بدون نام";

export function Users() {
  const { request, identity } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "BLOCKED">("ACTIVE");
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (applied) q.set("search", applied);
    if (role) q.set("role", role);
    if (status) q.set("status", status);
    return `/admin/users?${q}`;
  }, [page, applied, role, status]);
  const list = usePaged<UserRow>(path, revision);
  const detail = useDetail<UserDetail>(
    selected ? `/admin/users/${selected}` : null,
    revision,
  );
  useEffect(() => {
    if (!detail.data) return;
    queueMicrotask(() => {
      setFirstName(detail.data?.firstName || "");
      setLastName(detail.data?.lastName || "");
      if (detail.data) {
        setEditRole(detail.data.role);
        setEditStatus(detail.data.status);
      }
    });
  }, [detail.data]);

  async function mutate(
    method: "PATCH" | "DELETE",
    path: string,
    body: unknown,
    success: string,
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, { method, ...(body === undefined ? {} : { body }) });
      setRevision((value) => value + 1);
      setMessage(success);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/admin/users", {
        method: "POST",
        body: {
          phone: newPhone.trim(),
          role: newRole,
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
        },
      });
      setRevision((value) => value + 1);
      setNewPhone("");
      setNewFirstName("");
      setNewLastName("");
      setNewRole("USER");
      setCreating(false);
      setMessage("کاربر تازه ثبت شد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  }
  const user = detail.data;
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="جامعهٔ مشتریان"
        title="کاربران"
        description="پروندهٔ کاربران، نقش و وضعیت دسترسی را همراه با تاریخچهٔ مرتبط بررسی کنید."
      />
      <section className="manage-card" aria-label="افزودن کاربر">
        <div className="manage-actions">
          <button
            type="button"
            className="manage-primary"
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? "بستن فرم" : "افزودن کاربر"}
          </button>
        </div>
        {creating && (
          <form className="manage-toolbar" onSubmit={createUser}>
            <label>
              شماره موبایل
              <input
                dir="ltr"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder="09xxxxxxxxx"
                required
              />
            </label>
            <label>
              نام
              <input
                value={newFirstName}
                onChange={(event) => setNewFirstName(event.target.value)}
                placeholder="نام"
              />
            </label>
            <label>
              نام خانوادگی
              <input
                value={newLastName}
                onChange={(event) => setNewLastName(event.target.value)}
                placeholder="نام خانوادگی"
              />
            </label>
            <label>
              نقش
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(event.target.value as "USER" | "ADMIN")
                }
              >
                <option value="USER">کاربر</option>
                <option value="ADMIN">مدیر</option>
              </select>
            </label>
            <button type="submit" className="manage-primary" disabled={busy}>
              ثبت کاربر
            </button>
            <Notice message={error} />
            <Notice message={message} kind="success" />
          </form>
        )}
      </section>
      <section className="manage-card" aria-label="فهرست کاربران">
        <form className="manage-toolbar" onSubmit={apply}>
          <label>
            نام یا شماره
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کاربر"
            />
          </label>
          <label>
            نقش
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه</option>
              <option value="USER">کاربر</option>
              <option value="ADMIN">مدیر</option>
            </select>
          </label>
          <label>
            وضعیت
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه</option>
              <option value="ACTIVE">فعال</option>
              <option value="BLOCKED">مسدود</option>
            </select>
          </label>
          <button type="submit" className="manage-primary">
            جستجو
          </button>
        </form>
        <QueryState
          loading={list.loading}
          error={list.error}
          empty={!list.loading && list.data?.data.length === 0}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {list.data && list.data.data.length > 0 && (
          <>
            <div className="manage-table-wrap">
              <table className="manage-table">
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>شماره</th>
                    <th>نقش</th>
                    <th>وضعیت</th>
                    <th>سفارش / پت</th>
                    <th>عضویت</th>
                    <th>پرونده</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>{fullName(item)}</td>
                      <td dir="ltr">{item.phone}</td>
                      <td>{item.role === "ADMIN" ? "مدیر" : "کاربر"}</td>
                      <td>
                        {item.deletedAt
                          ? "حذف موقت"
                          : item.status === "BLOCKED"
                            ? "مسدود"
                            : "فعال"}
                      </td>
                      <td>
                        {formatNumber(item._count.orders)} /{" "}
                        {formatNumber(item._count.pets)}
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <button
                          className="manage-row-button"
                          type="button"
                          onClick={() => {
                            setSelected(item.id);
                            setError("");
                            setMessage("");
                          }}
                        >
                          بررسی
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator meta={list.data.meta} onPage={setPage} />
          </>
        )}
      </section>
      {selected && (
        <section className="manage-card" aria-label="پروندهٔ کاربر">
          <div className="manage-actions">
            <button type="button" onClick={() => setSelected(null)}>
              بستن پرونده
            </button>
          </div>
          <QueryState
            loading={detail.loading}
            error={detail.error}
            onRetry={() => setRevision((value) => value + 1)}
          />
          {user && (
            <>
              <h2>
                {fullName(user)} · <span dir="ltr">{user.phone}</span>
              </h2>
              <dl className="manage-facts">
                <div>
                  <dt>شناسه</dt>
                  <dd>{formatNumber(user.id)}</dd>
                </div>
                <div>
                  <dt>تأیید شماره</dt>
                  <dd>{user.isPhoneVerified ? "تأییدشده" : "تأییدنشده"}</dd>
                </div>
                <div>
                  <dt>سفارش‌ها</dt>
                  <dd>{formatNumber(user._count.orders)}</dd>
                </div>
                <div>
                  <dt>آدرس‌ها</dt>
                  <dd>{formatNumber(user._count.addresses)}</dd>
                </div>
              </dl>
              <div className="manage-columns">
                <div>
                  <h2>پت‌ها</h2>
                  <ul className="manage-sublist">
                    {user.pets.map((pet) => (
                      <li key={pet.id}>
                        {pet.name} · {pet.petType.name}
                        {pet.breed ? ` · ${pet.breed.name}` : ""}
                      </li>
                    ))}
                  </ul>
                  {user.pets.length === 0 && <p>پتی ثبت نشده است.</p>}
                </div>
                <div>
                  <h2>آدرس‌ها</h2>
                  <ul className="manage-sublist">
                    {user.addresses.map((address) => (
                      <li key={address.id}>
                        {address.title} · {address.province}، {address.city}،{" "}
                        {address.fullAddress}
                      </li>
                    ))}
                  </ul>
                  {user.addresses.length === 0 && <p>آدرسی ثبت نشده است.</p>}
                </div>
              </div>
              <h2>سفارش‌های اخیر</h2>
              <ul className="manage-sublist">
                {user.orders.map((order) => (
                  <li key={order.id}>
                    <span dir="ltr">{order.orderNumber}</span> ·{" "}
                    {formatMoney(order.finalAmount)} ·{" "}
                    {formatDate(order.createdAt)}
                  </li>
                ))}
              </ul>
              {user.orders.length === 0 && <p>سفارشی ثبت نشده است.</p>}
              <Notice message={error} />
              <Notice message={message} kind="success" />
              {!user.deletedAt && (
                <div className="manage-card">
                  <h2>ویرایش دسترسی و نام</h2>
                  <div className="manage-form">
                    <label>
                      نام
                      <input
                        maxLength={80}
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </label>
                    <label>
                      نام خانوادگی
                      <input
                        maxLength={80}
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </label>
                    <label>
                      نقش
                      <select
                        value={editRole}
                        onChange={(event) =>
                          setEditRole(event.target.value as "USER" | "ADMIN")
                        }
                      >
                        <option value="USER">کاربر</option>
                        <option value="ADMIN">مدیر</option>
                      </select>
                    </label>
                    <label>
                      وضعیت
                      <select
                        value={editStatus}
                        onChange={(event) =>
                          setEditStatus(
                            event.target.value as "ACTIVE" | "BLOCKED",
                          )
                        }
                      >
                        <option value="ACTIVE">فعال</option>
                        <option value="BLOCKED">مسدود</option>
                      </select>
                    </label>
                  </div>
                  <div className="manage-actions">
                    <button
                      type="button"
                      className="manage-primary"
                      disabled={
                        busy ||
                        (identity?.id === user.id &&
                          (editRole !== "ADMIN" || editStatus === "BLOCKED"))
                      }
                      onClick={() =>
                        void mutate(
                          "PATCH",
                          `/admin/users/${user.id}`,
                          {
                            firstName: firstName.trim() || null,
                            lastName: lastName.trim() || null,
                            role: editRole,
                            status: editStatus,
                          },
                          "اطلاعات کاربر ثبت شد.",
                          editRole !== user.role || editStatus !== user.status
                            ? "تغییر نقش یا وضعیت دسترسی این کاربر تأیید شود؟"
                            : undefined,
                        )
                      }
                    >
                      ذخیرهٔ تغییرات
                    </button>
                    <button
                      type="button"
                      className="manage-danger"
                      disabled={busy || identity?.id === user.id}
                      onClick={() =>
                        void mutate(
                          "DELETE",
                          `/admin/users/${user.id}`,
                          undefined,
                          "کاربر به‌صورت موقت حذف شد.",
                          "این کاربر موقتاً حذف و مسدود شود؟",
                        )
                      }
                    >
                      حذف موقت
                    </button>
                  </div>
                  {identity?.id === user.id && (
                    <p className="manage-notice manage-notice--info">
                      نقش و وضعیت حساب مدیر فعلی از این صفحه قابل کاهش نیست.
                    </p>
                  )}
                </div>
              )}
              {user.deletedAt && (
                <div className="manage-actions">
                  <button
                    type="button"
                    className="manage-primary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        "PATCH",
                        `/admin/users/${user.id}/restore`,
                        undefined,
                        "حساب کاربر بازیابی شد.",
                        "حساب کاربر دوباره فعال شود؟",
                      )
                    }
                  >
                    بازیابی حساب
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
