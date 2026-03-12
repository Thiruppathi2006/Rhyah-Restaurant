import { ensureSeedData } from './seed.js';
import { getOrder, listOrderItemsByOrderId, updateOrder, getSetting } from './db.js';
import { clearCart } from './cartStore.js';
import { money } from './billing.js';

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;' }[c]));
}

function getOrderIdFromUrl() {
  const u = new URL(location.href);
  return u.searchParams.get('orderId') || '';
}

function renderOrderItems(items) {
  const wrap = el('orderItems');
  wrap.innerHTML = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'cartLine';
    row.innerHTML = `
      <div>
        <div style="font-weight:650">${escapeHtml(it.nameSnapshot)}</div>
        <div class="muted" style="font-size:12px">${it.qty} × ${money(it.priceSnapshot)}</div>
      </div>
      <div style="min-width:88px;text-align:right;font-weight:650">${money(it.lineTotal)}</div>
    `;
    wrap.appendChild(row);
  }
}

function buildReceipt({ restaurantName, order, items }) {
  const created = new Date(order.createdAt);
  const paid = order.paidAt ? new Date(order.paidAt) : null;

  const itemRows = items.map(it => `
    <div class="ritem">
      <div class="left">
        <div>${escapeHtml(it.nameSnapshot)}</div>
        <div class="sub">${it.qty} × ${money(it.priceSnapshot)}</div>
      </div>
      <div>${money(it.lineTotal)}</div>
    </div>
  `).join('');

  return `
    <h3>${escapeHtml(restaurantName)}</h3>
    <p class="small">Order: ${escapeHtml(order.id)}</p>
    <p class="small">Created: ${escapeHtml(created.toLocaleString())}</p>
    ${paid ? `<p class="small">Paid: ${escapeHtml(paid.toLocaleString())}</p>` : `<p class="small">Status: OPEN</p>`}
    <div class="sep"></div>
    <div class="ritems">${itemRows}</div>
    <div class="sep"></div>
    <div class="rline"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
    <div class="rline"><span>Tax</span><span>${money(order.tax)}</span></div>
    <div class="rline"><strong>Total</strong><strong>${money(order.total)}</strong></div>
    <div class="sep"></div>
    <div class="footer">Thank you!</div>
  `;
}

function printReceipt(html) {
  const receipt = el('receipt');
  receipt.innerHTML = html;
  receipt.style.display = 'block';
  window.print();
  receipt.style.display = 'none';
}

async function main() {
  await ensureSeedData();

  const orderId = getOrderIdFromUrl();
  if (!orderId) {
    el('statusMsg').textContent = 'Missing orderId.';
    el('markPaidBtn').disabled = true;
    el('printBtn').disabled = true;
    return;
  }
  el('orderId').textContent = orderId;

  const nameRow = await getSetting('restaurantName');
  const restaurantName = nameRow?.value || 'Rhyah Restaurant';
  document.title = `${restaurantName} — Pay`;
  el('restaurantName').textContent = restaurantName;

  const qrRow = await getSetting('upiQrImageDataUrl');
  const qr = (qrRow?.value || '').trim();
  const qrImg = el('qrImg');
  if (qr) {
    qrImg.src = qr;
    el('qrHint').textContent = 'Scan the QR to pay. (Customer enters amount manually.)';
  } else {
    qrImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="#0f1420"/><text x="50%" y="52%" text-anchor="middle" font-family="system-ui" font-size="26" fill="#e9eefc">Set UPI QR in Admin</text></svg>`);
    el('qrHint').innerHTML = `No QR configured. Open <a href="./admin.html" style="text-decoration:underline">Manage Menu</a> → Settings.`;
  }

  let order = await getOrder(orderId);
  if (!order) {
    el('statusMsg').textContent = 'Order not found.';
    el('markPaidBtn').disabled = true;
    el('printBtn').disabled = true;
    return;
  }
  const items = await listOrderItemsByOrderId(orderId);

  renderOrderItems(items);
  el('subtotal').textContent = money(order.subtotal);
  el('tax').textContent = money(order.tax);
  el('total').textContent = money(order.total);

  const setStatus = (msg) => { el('statusMsg').textContent = msg; };
  const syncButtons = () => {
    const paid = order.status === 'PAID';
    el('markPaidBtn').disabled = paid;
    el('markPaidBtn').textContent = paid ? 'Paid' : 'Mark paid';
  };
  syncButtons();

  el('markPaidBtn').addEventListener('click', async () => {
    el('markPaidBtn').disabled = true;
    try {
      order.status = 'PAID';
      order.paidAt = Date.now();
      await updateOrder(order);
      clearCart();
      setStatus('Marked as paid. Cart cleared.');
    } catch (e) {
      console.error(e);
      setStatus('Could not mark paid. Try again.');
      order = await getOrder(orderId) || order;
    } finally {
      syncButtons();
    }
  });

  el('printBtn').addEventListener('click', () => {
    const html = buildReceipt({ restaurantName, order, items });
    printReceipt(html);
  });
}

main().catch((e) => {
  console.error(e);
  alert('App error. Please refresh the page.');
});

