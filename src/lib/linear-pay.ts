/** Reusable handling for rights-managed entries that remain in other catalogs. */
export function isLinearPayCategory(categories: string[] | null | undefined) {
  return Boolean(
    categories?.some((c) => /^(LinearPay|Rights)$/i.test(c)),
  );
}
