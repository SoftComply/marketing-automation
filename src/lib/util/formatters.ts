export function formatNumber(n: number) {
  if (n === 0) return '-';
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
