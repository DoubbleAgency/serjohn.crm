export function fmtPrice(n) {
  if (n === null || n === undefined || n === '') return '€ —';
  return '€' + Number(n).toLocaleString('pt-PT');
}

export function fmtKm(n) {
  if (n === null || n === undefined || n === '') return '— km';
  return Number(n).toLocaleString('pt-PT') + ' km';
}

export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-PT');
  } catch {
    return '—';
  }
}

export function hoje() {
  return new Date().toISOString().slice(0, 10);
}
