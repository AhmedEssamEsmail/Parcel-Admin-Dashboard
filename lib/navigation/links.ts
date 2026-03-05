export function buildParcelDetailHref(
  warehouseCode: string | null | undefined,
  parcelId: string | number | null | undefined,
): string | null {
  if (!warehouseCode || parcelId === null || parcelId === undefined || parcelId === "") return null;
  return `/parcel/${encodeURIComponent(warehouseCode)}/${encodeURIComponent(String(parcelId))}`;
}
