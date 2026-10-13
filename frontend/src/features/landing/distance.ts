export interface Coordinates {
  lat: number;
  lng: number;
}

export function hasCoordinates(value: {
  lat: number | null;
  lng: number | null;
}): value is Coordinates {
  return (
    typeof value.lat === 'number' &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 &&
    Math.abs(value.lng) <= 180
  );
}

/** Great-circle distance, not a road route or travel-time estimate. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
