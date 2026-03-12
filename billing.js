export function money(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);
}

export function calcTotals(lines, taxRatePct = 0) {
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);
  const rate = Math.max(0, Number(taxRatePct) || 0) / 100;
  const tax = round2(subtotal * rate);
  const total = round2(subtotal + tax);
  return { subtotal: round2(subtotal), tax, total };
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

