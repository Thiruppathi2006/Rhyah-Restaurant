# Rhyah Restaurant (Vanilla POS)

Pure **HTML/CSS/JS** single-device restaurant menu + billing app.

## Features
- Menu with images + availability
- Click item → add to cart → bill updates
- Clear cart
- Pay now → shows **UPI static QR**
- Mark paid (stores order as PAID)
- Print bill/receipt
- Monthly sales report (paid orders)
- Manage menu (CRUD) + settings (restaurant name, tax rate, QR image)

## Run
Because the JS uses ES modules, open via a local static server (recommended).

### Option A: Python
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000/menu.html`.

### Option B: Node (if installed)
```bash
npx serve .
```

## Pages
- `menu.html` menu
- `cart.html` cart + totals + pay/print
- `pay.html` QR + mark paid + print
- `admin.html` manage menu + settings
- `report.html` monthly sales report

## Data storage
All data is stored on this device using **IndexedDB** (menu + orders) and **localStorage** (current cart).

