const CART_KEY = 'rhyah_cart_v1';

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function readCart() {
  const raw = localStorage.getItem(CART_KEY);
  const cart = raw ? safeParse(raw, {}) : {};
  if (!cart || typeof cart !== 'object') return {};
  return cart;
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getCart() {
  return readCart();
}

export function clearCart() {
  writeCart({});
}

export function setQty(menuItemId, qty) {
  const cart = readCart();
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (n <= 0) delete cart[menuItemId];
  else cart[menuItemId] = n;
  writeCart(cart);
  return cart;
}

export function addOne(menuItemId) {
  const cart = readCart();
  cart[menuItemId] = (cart[menuItemId] || 0) + 1;
  writeCart(cart);
  return cart;
}

export function removeOne(menuItemId) {
  const cart = readCart();
  const cur = cart[menuItemId] || 0;
  if (cur <= 1) delete cart[menuItemId];
  else cart[menuItemId] = cur - 1;
  writeCart(cart);
  return cart;
}

export function cartCount(cart = readCart()) {
  return Object.values(cart).reduce((a, b) => a + (Number(b) || 0), 0);
}

