const numbers = new Intl.NumberFormat("ru-MD", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-MD", { maximumFractionDigits: 1 });
export function amount(value: number | null, currency = false) {
  return value === null ? "Нет данных" : `${numbers.format(value)}${currency ? " MDL" : " шт."}`;
}
export function percent(value: number | null) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${decimal.format(value)}%`;
}
export function rate(value: number) {
  return decimal.format(value);
}
