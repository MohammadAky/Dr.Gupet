export interface AddressSnapshot {
  title: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  fullAddress: string;
  postalCode: string | null;
}

/** MySQL stores historical snapshots as TEXT; API callers receive a validated object. */
export function parseAddressSnapshot(value: unknown): AddressSnapshot | null {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const fields = [
    'title',
    'receiverName',
    'receiverPhone',
    'province',
    'city',
    'fullAddress',
  ] as const;
  if (fields.some((field) => typeof record[field] !== 'string')) return null;
  if (record.postalCode != null && typeof record.postalCode !== 'string') return null;
  return {
    title: record.title as string,
    receiverName: record.receiverName as string,
    receiverPhone: record.receiverPhone as string,
    province: record.province as string,
    city: record.city as string,
    fullAddress: record.fullAddress as string,
    postalCode: (record.postalCode as string | null) ?? null,
  };
}
