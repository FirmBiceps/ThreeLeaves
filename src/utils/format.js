export function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export function formatMoneyWhole(value) {
  return Number(value || 0).toFixed(0);
}
