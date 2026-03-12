import { ensureSeedData } from './seed.js';
import { getSetting, listPaidOrdersInRange, listOrderItemsByOrderId } from './db.js';
import { money } from './billing.js';

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;' }[c]));
}

function startEndForMonth(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
  const end = new Date(y, m, 1, 0, 0, 0, 0).getTime();
  return { start, end };
}

async function runReport(yyyyMm) {
  const { start, end } = startEndForMonth(yyyyMm);
  const orders = await listPaidOrdersInRange(start, end);

  const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  el('ordersCount').textContent = String(orders.length);
  el('revenue').textContent = money(revenue);
  el('avgOrder').textContent = money(orders.length ? revenue / orders.length : 0);

  const byItem = new Map(); // name -> {name, qty, revenue}
  for (const o of orders) {
    const items = await listOrderItemsByOrderId(o.id);
    for (const it of items) {
      const k = it.nameSnapshot;
      const cur = byItem.get(k) || { name: k, qty: 0, revenue: 0 };
      cur.qty += Number(it.qty) || 0;
      cur.revenue += Number(it.lineTotal) || 0;
      byItem.set(k, cur);
    }
  }

  const rows = [...byItem.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty || a.name.localeCompare(b.name));
  const wrap = el('topItems');
  wrap.innerHTML = '';

  if (rows.length === 0) {
    el('topEmpty').style.display = 'block';
    return;
  }
  el('topEmpty').style.display = 'none';

  for (const r of rows.slice(0, 15)) {
    const div = document.createElement('div');
    div.className = 'cartLine';
    div.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(r.name)}</div>
        <div class="muted" style="font-size:12px">Qty: ${r.qty}</div>
      </div>
      <div style="font-weight:750">${money(r.revenue)}</div>
    `;
    wrap.appendChild(div);
  }
}

async function main() {
  await ensureSeedData();

  const nameRow = await getSetting('restaurantName');
  const restaurantName = nameRow?.value || 'Rhyah Restaurant';
  document.title = `${restaurantName} — Monthly Report`;
  el('restaurantName').textContent = restaurantName;

  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  el('month').value = yyyyMm;

  const msg = (t) => { el('reportMsg').textContent = t || ''; };

  const run = async () => {
    msg('Running...');
    try {
      await runReport(el('month').value);
      msg('');
    } catch (e) {
      console.error(e);
      msg('Could not run report.');
    }
  };

  el('runBtn').addEventListener('click', run);
  await run();
}

main().catch((e) => {
  console.error(e);
  alert('App error. Please refresh the page.');
});

