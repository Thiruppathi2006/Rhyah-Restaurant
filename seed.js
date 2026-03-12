import { listMenuItems, upsertMenuItem, getSetting, setSetting, uuid } from './db.js';
import { relatedImageUrl } from './images.js';

export async function ensureSeedData() {
  const existing = await listMenuItems();
  if (!existing || existing.length === 0) {
    const now = Date.now();
    const items = [
      { name: 'Idly', price: 30 },
      { name: 'Poori', price: 45 },
      { name: 'Rice', price: 60 },
      { name: 'Coffee', price: 20 },
    ].map(i => ({
      id: uuid(),
      name: i.name,
      price: i.price,
      imageDataUrl: null,
      imageUrl: relatedImageUrl(i.name),
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    }));

    for (const it of items) await upsertMenuItem(it);
  }

  const restaurantName = await getSetting('restaurantName');
  if (!restaurantName) await setSetting('restaurantName', 'Rhyah Restaurant');

  const taxRate = await getSetting('taxRate');
  if (!taxRate) await setSetting('taxRate', 0);

  const qrImage = await getSetting('upiQrImageDataUrl');
  if (!qrImage) await setSetting('upiQrImageDataUrl', '');
}

