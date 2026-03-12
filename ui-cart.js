import { ensureSeedData } from './seed.js';
import { getSetting, listMenuItems, createOrder, uuid } from './db.js';
import { addOne, clearCart, getCart, removeOne, cartCount } from './cartStore.js';
import { calcTotals, money } from './billing.js';

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;' }[c]));
}

let allMenu = [];
let taxRate = 0;
let restaurantName = 'Rhyah Restaurant';

function cartLinesFrom(cart) {
  const lines = [];
  for (const [menuItemId, qty] of Object.entries(cart)) {
    const item = allMenu.find(m => m.id === menuItemId);
    if (!item) continue;
    const n = Number(qty) || 0;
    if (n <= 0) continue;
    lines.push({
      menuItemId,
      name: item.name,
      price: item.price,
      qty: n,
      lineTotal: (Number(item.price) || 0) * n,
    });
  }
  lines.sort((a, b) => a.name.localeCompare(b.name));
  return lines;
}

function renderCart(lines, cart) {
  el('cartCount').textContent = String(cartCount(cart));
  const wrap = el('cartLines');
  wrap.innerHTML = '';

  if (lines.length === 0) {
    el('cartEmpty').style.display = 'block';
  } else {
    el('cartEmpty').style.display = 'none';
    for (const l of lines) {
      const row = document.createElement('div');
      row.className = 'cartLine';
      row.innerHTML = `
        <div>
          <div style="font-weight:650">${escapeHtml(l.name)}</div>
          <div class="muted" style="font-size:12px">${money(l.price)} each</div>
        </div>
        <div class="row" style="justify-content:flex-end">
          <div class="qty">
            <button type="button" data-act="dec">-</button>
            <div class="n">${l.qty}</div>
            <button type="button" data-act="inc">+</button>
          </div>
          <div style="min-width:88px;text-align:right;font-weight:650">${money(l.lineTotal)}</div>
        </div>
      `;
      row.querySelector('[data-act="inc"]').addEventListener('click', () => {
        addOne(l.menuItemId);
        refresh();
      });
      row.querySelector('[data-act="dec"]').addEventListener('click', () => {
        removeOne(l.menuItemId);
        refresh();
      });
      wrap.appendChild(row);
    }
  }

  const totals = calcTotals(lines, taxRate);
  el('subtotal').textContent = money(totals.subtotal);
  el('tax').textContent = money(totals.tax);
  el('total').textContent = money(totals.total);

  el('payBtn').disabled = lines.length === 0;
  el('printBtn').disabled = lines.length === 0;
  el('clearCartBtn').disabled = lines.length === 0;
}

function buildReceipt(lines) {
  const now = new Date();
  const totals = calcTotals(lines, taxRate);
  const itemRows = lines.map(l => `
    <div class="ritem">
      <div class="left">
        <div>${escapeHtml(l.name)}</div>
        <div class="sub">${l.qty} × ${money(l.price)}</div>
      </div>
      <div>${money(l.lineTotal)}</div>
    </div>
  `).join('');

  return `
    <h3>${escapeHtml(restaurantName)}</h3>
    <p class="small">Bill preview • ${escapeHtml(now.toLocaleString())}</p>
    <div class="sep"></div>
    <div class="ritems">${itemRows}</div>
    <div class="sep"></div>
    <div class="rline"><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>
    <div class="rline"><span>Tax</span><span>${money(totals.tax)}</span></div>
    <div class="rline"><strong>Total</strong><strong>${money(totals.total)}</strong></div>
    <div class="sep"></div>
    <div class="footer">Thank you!</div>
  `;
}

function printReceipt(lines) {
  const receipt = el('receipt');
  receipt.innerHTML = buildReceipt(lines);
  receipt.style.display = 'block';
  window.print();
  receipt.style.display = 'none';
}

async function goPay(lines) {
  const totals = calcTotals(lines, taxRate);
  const orderId = uuid();
  const now = Date.now();

  const order = {
    id: orderId,
    status: 'OPEN',
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    createdAt: now,
    paidAt: null,
  };

  const orderItems = lines.map(l => ({
    id: uuid(),
    orderId,
    menuItemId: l.menuItemId,
    nameSnapshot: l.name,
    priceSnapshot: Number(l.price) || 0,
    qty: l.qty,
    lineTotal: Number(l.lineTotal) || 0,
  }));

  await createOrder(order, orderItems);
  location.href = `./pay.html?orderId=${encodeURIComponent(orderId)}`;
}

function refresh() {
  const cart = getCart();
  const lines = cartLinesFrom(cart);
  renderCart(lines, cart);
  return { cart, lines };
}

async function main() {
  await ensureSeedData();

  const nameRow = await getSetting('restaurantName');
  restaurantName = nameRow?.value || 'Rhyah Restaurant';
  document.title = `${restaurantName} — Cart`;
  el('restaurantName').textContent = restaurantName;

  const taxRow = await getSetting('taxRate');
  taxRate = Number(taxRow?.value) || 0;

  allMenu = await listMenuItems();

  el('clearCartBtn').addEventListener('click', () => {
    clearCart();
    refresh();
  });

  el('printBtn').addEventListener('click', () => {
    const { lines } = refresh();
    if (lines.length === 0) return;
    printReceipt(lines);
  });

  el('payBtn').addEventListener('click', async () => {
    const { lines } = refresh();
    if (lines.length === 0) return;
    el('payBtn').disabled = true;
    try {
      await goPay(lines);
    } catch (e) {
      console.error(e);
      alert('Could not start payment. Please try again.');
      el('payBtn').disabled = false;
    }
  });

  refresh();
  window.addEventListener('storage', refresh);
}

main().catch((e) => {
  console.error(e);
  alert('App error. Please refresh the page.');
});

