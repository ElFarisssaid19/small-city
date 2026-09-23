export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Money with a thousands separator, e.g. $12,500 or −$300. */
export function formatMoney(value: number): string {
  const amount = `$${formatNumber(Math.abs(value))}`;
  return value < 0 ? `−${amount}` : amount;
}
