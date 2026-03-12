import { ensureSeedData } from './seed.js';
import { getSetting, listMenuItems } from './db.js';
import { addOne, clearCart, getCart, removeOne, cartCount } from './cartStore.js';
import { calcTotals, money } from './billing.js';
import { placeholderDataUrl, relatedImageUrl } from './images.js';

function el(id) { return document.getElementById(id); }

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

function setBestImage(imgEl, item) {
  const primary = item.imageDataUrl || item.imageUrl || relatedImageUrl(item.name);
  const fallback = placeholderDataUrl(item.name);
  imgEl.referrerPolicy = 'no-referrer';
  imgEl.src = primary || fallback;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = fallback;
  };
}

function renderMenu(items) {
  const grid = el('menuGrid');
  grid.innerHTML = '';
  for (const it of items) {
    const div = document.createElement('div');
    div.className = `item ${it.isAvailable ? '' : 'unavailable'}`.trim();
    div.tabIndex = 0;
    div.role = 'button';
    div.setAttribute('aria-label', `Add ${it.name}`);

    const img = document.createElement('img');
    img.alt = it.name;
    img.loading = 'lazy';
    setBestImage(img, it);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div class="name">${escapeXml(it.name)}</div>
      <div class="price">${money(it.price)}</div>
      <div class="badge">${it.isAvailable ? 'Available' : 'Unavailable'}</div>
    `;

    div.appendChild(img);
    div.appendChild(meta);

    const add = () => {
      if (!it.isAvailable) return;
      addOne(it.id);
      refreshCartSummary();
    };
    div.addEventListener('click', add);
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        add();
      }
    });

    grid.appendChild(div);
  }
}

let allMenu = [];
let taxRate = 0;

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

function renderCartSummary(cart, lines) {
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
          <div style="font-weight:650">${escapeXml(l.name)}</div>
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
        refreshCartSummary();
      });
      row.querySelector('[data-act="dec"]').addEventListener('click', () => {
        removeOne(l.menuItemId);
        refreshCartSummary();
      });
      wrap.appendChild(row);
    }
  }

  const totals = calcTotals(lines, taxRate);
  el('subtotal').textContent = money(totals.subtotal);
  el('tax').textContent = money(totals.tax);
  el('total').textContent = money(totals.total);
}

function refreshCartSummary() {
  const cart = getCart();
  const lines = cartLinesFrom(cart);
  renderCartSummary(cart, lines);
}

async function main() {
  await ensureSeedData();

  const nameRow = await getSetting('restaurantName');
  const name = nameRow?.value || 'Rhyah Restaurant';
  document.title = `${name} — Menu`;
  el('restaurantName').textContent = name;

  const taxRow = await getSetting('taxRate');
  taxRate = Number(taxRow?.value) || 0;

  allMenu = await listMenuItems();

  const search = el('search');
  const applyFilter = () => {
    const q = (search.value || '').trim().toLowerCase();
    const filtered = allMenu
      .filter(it => it.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    renderMenu(filtered);
    el('menuEmpty').style.display = filtered.length === 0 ? 'block' : 'none';
  };
  search.addEventListener('input', applyFilter);
  applyFilter();

  el('clearCartBtn').addEventListener('click', () => {
    clearCart();
    refreshCartSummary();
  });

  refreshCartSummary();
  window.addEventListener('storage', refreshCartSummary);
}

main().catch((e) => {
  console.error(e);
  alert('App error. Please refresh the page.');
});

