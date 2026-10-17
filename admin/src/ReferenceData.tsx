import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { CatalogReferencesManager, type CatalogReferences } from "./CatalogReferences";
import { type CatalogTag, type NamedRef } from "./catalog-model";
import { QueryState } from "./management";

/** Reference management has its own workspace; product forms still load their own references. */
export function ReferenceData() {
  const { request } = useAuth();
  const [refs, setRefs] = useState<CatalogReferences | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      void Promise.all([
        request<NamedRef[]>("/admin/brands"),
        request<NamedRef[]>("/admin/categories"),
        request<NamedRef[]>("/admin/pet-types"),
        request<NamedRef[]>("/admin/breeds"),
        request<CatalogTag[]>("/admin/tags"),
      ]).then(([brands, categories, petTypes, breeds, tags]) => {
        if (active) setRefs({ brands, categories, petTypes, breeds, tags });
      }).catch((problem: unknown) => {
        if (active) setError(problem instanceof Error ? problem.message : "داده‌های مرجع دریافت نشدند.");
      }).finally(() => {
        if (active) setLoading(false);
      });
    });
    return () => { active = false; };
  }, [request, revision]);

  return <>
    {!refs && <header className="manage-head"><div><span className="eyebrow">مدیریت فروشگاه</span><h1>داده‌های مرجع</h1></div></header>}
    <QueryState loading={loading} error={error} onRetry={() => setRevision(value => value + 1)} />
    {refs && <CatalogReferencesManager refs={refs} onChanged={() => setRevision(value => value + 1)} />}
  </>;
}
