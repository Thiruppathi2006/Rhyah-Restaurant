import { ensureSeedData } from './seed.js';
import { deleteMenuItem, getMenuItem, getSetting, listMenuItems, setSetting, upsertMenuItem, uuid } from './db.js';
import { placeholderDataUrl, relatedImageUrl } from './images.js';

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;' }[c]));
}

async function fileToDataUrl(file, { maxW = 900, maxH = 900, quality = 0.82 } = {}) {
  if (!file) return null;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Image load failed'));
    i.src = URL.createObjectURL(file);
  });

  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  return canvas.toDataURL('image/jpeg', quality);
}

let allMenu = [];

function setAdminMsg(msg) { el('adminMsg').textContent = msg || ''; }
function setSettingsMsg(msg) { el('settingsMsg').textContent = msg || ''; }

function resetForm() {
  el('itemId').value = '';
  el('name').value = '';
  el('price').value = '';
  el('image').value = '';
  el('isAvailable').checked = true;
  el('saveBtn').textContent = 'Save';
}

function renderItems(items) {
  const wrap = el('itemsList');
  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `<div class="muted" style="margin-top:10px">No items.</div>`;
    return;
  }

  for (const it of items) {
    const imgSrc = it.imageDataUrl || it.imageUrl || relatedImageUrl(it.name) || placeholderDataUrl(it.name);
    const row = document.createElement('div');
    row.className = 'cartLine';
    row.innerHTML = `
      <div class="row" style="gap:12px;align-items:center">
        <img alt="" src="${imgSrc}" referrerpolicy="no-referrer" style="width:52px;height:42px;object-fit:cover;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.03)" />
        <div>
          <div style="font-weight:700">${escapeHtml(it.name)}</div>
          <div class="muted" style="font-size:12px">₹${Number(it.price || 0).toFixed(2)} • ${it.isAvailable ? 'Available' : 'Unavailable'}</div>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn" type="button" data-act="edit">Edit</button>
        <button class="btn danger" type="button" data-act="del">Delete</button>
      </div>
    `;

    row.querySelector('[data-act="edit"]').addEventListener('click', async () => {
      const full = await getMenuItem(it.id);
      el('itemId').value = full.id;
      el('name').value = full.name;
      el('price').value = String(full.price);
      el('isAvailable').checked = !!full.isAvailable;
      el('image').value = '';
      el('saveBtn').textContent = 'Update';
      setAdminMsg(`Editing: ${full.name}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    row.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm(`Delete "${it.name}"?`)) return;
      await deleteMenuItem(it.id);
      setAdminMsg('Deleted.');
      await refresh();
      resetForm();
    });

    wrap.appendChild(row);
  }
}

async function refresh() {
  allMenu = await listMenuItems();
  const q = (el('filter').value || '').trim().toLowerCase();
  const filtered = allMenu
    .filter(it => it.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  renderItems(filtered);
}

async function loadSettings() {
  const nameRow = await getSetting('restaurantName');
  const restaurantName = nameRow?.value || 'Rhyah Restaurant';
  document.title = `${restaurantName} — Admin`;
  el('restaurantName').textContent = restaurantName;
  el('settingRestaurantName').value = restaurantName;

  const taxRow = await getSetting('taxRate');
  el('settingTaxRate').value = String(Number(taxRow?.value) || 0);

  const qrRow = await getSetting('upiQrImageDataUrl');
  el('settingQrPreview').src = (qrRow?.value || '').trim() || placeholderDataUrl('UPI QR');
}

async function main() {
  await ensureSeedData();
  await loadSettings();
  await refresh();

  el('filter').addEventListener('input', refresh);
  el('resetBtn').addEventListener('click', () => {
    resetForm();
    setAdminMsg('');
  });

  el('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setAdminMsg('');

    const id = (el('itemId').value || '').trim() || uuid();
    const name = (el('name').value || '').trim();
    const price = Number(el('price').value);
    const isAvailable = !!el('isAvailable').checked;
    if (!name) return setAdminMsg('Name is required.');
    if (!Number.isFinite(price) || price < 0) return setAdminMsg('Price must be 0 or more.');

    const existing = await getMenuItem(id);
    const now = Date.now();

    let imageDataUrl = existing?.imageDataUrl || null;
    const file = el('image').files?.[0];
    if (file) {
      try {
        imageDataUrl = await fileToDataUrl(file);
      } catch {
        return setAdminMsg('Could not read image file.');
      }
    }

    await upsertMenuItem({
      id,
      name,
      price,
      imageDataUrl,
      isAvailable,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    setAdminMsg(existing ? 'Updated.' : 'Created.');
    resetForm();
    await refresh();
  });

  el('saveSettingsBtn').addEventListener('click', async () => {
    setSettingsMsg('');
    const name = (el('settingRestaurantName').value || '').trim() || 'Rhyah Restaurant';
    const taxRate = Number(el('settingTaxRate').value);
    if (!Number.isFinite(taxRate) || taxRate < 0) return setSettingsMsg('Tax rate must be 0 or more.');

    const qrFile = el('settingQrFile').files?.[0];
    let qrDataUrl = null;
    if (qrFile) {
      try {
        qrDataUrl = await fileToDataUrl(qrFile, { maxW: 900, maxH: 900, quality: 0.9 });
      } catch {
        return setSettingsMsg('Could not read QR image file.');
      }
    }

    await setSetting('restaurantName', name);
    await setSetting('taxRate', taxRate);
    if (qrDataUrl !== null) await setSetting('upiQrImageDataUrl', qrDataUrl);

    el('settingQrFile').value = '';
    setSettingsMsg('Saved.');
    await loadSettings();
  });
}

main().catch((e) => {
  console.error(e);
  alert('App error. Please refresh the page.');
});

