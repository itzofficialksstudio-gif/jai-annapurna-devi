const WHATSAPP_NUMBER = '917974068355';
const FREE_DELIVERY_MIN = 199;
const DELIVERY_FEE = 20;

const MENU_ITEMS = [
  { id: 'shahi-paneer', name: 'Shahi Paneer', category: 'Paneer', desc: 'Soft paneer cubes simmered in rich cashew, saffron, and cream gravy.', image: 'images/shahi-paneer.jpg', half: 150, full: 200, oldHalf: 200, oldFull: 250 },
  { id: 'butter-paneer-masala', name: 'Butter Paneer Masala', category: 'Paneer', desc: 'Cottage cheese cooked in velvety tomato-butter makhani masala.', image: 'images/butter-paneer.jpg', half: 200, full: 250, oldHalf: 250, oldFull: 300 },
  { id: 'chilli-paneer', name: 'Chilli Paneer', category: 'Paneer', desc: 'Crispy paneer tossed with bell peppers, onions, and spicy sauce.', image: 'images/chilli-paneer.jpg', half: 120, full: 170, oldHalf: 170, oldFull: 220 },
  { id: 'matar-paneer', name: 'Matar Paneer', category: 'Paneer', desc: 'Green peas and fresh paneer simmered in homestyle spiced curry.', image: 'images/matar-paneer.jpg', half: 150, full: 150, oldHalf: null, oldFull: 200 },

  { id: 'veg-maggi', name: 'Veg Maggi', category: 'Maggi & Noodles', desc: 'Steaming masala Maggi tossed with peas, sweet corn, and veggies.', image: 'images/veg-maggi.jpg', half: 140, full: 150, oldHalf: null, oldFull: null },
  { id: 'hakka-noodles', name: 'Hakka Noodles', category: 'Maggi & Noodles', desc: 'Wok-tossed veg noodles with cabbage, capsicum, and soy-pepper.', image: 'images/hakka-noodles.jpg', half: 150, full: 150, oldHalf: null, oldFull: 200 },
  { id: 'cheese-maggi', name: 'Cheese Maggi', category: 'Maggi & Noodles', desc: 'Rich melted cheese folded into hot masala Maggi.', image: 'images/cheese-maggi.jpg', half: 120, full: 150, oldHalf: null, oldFull: null },

  { id: 'veg-pulao', name: 'Veg Pulao', category: 'Rice & Pulao', desc: 'Fragrant basmati rice cooked with seasonal vegetables and whole spices.', image: 'images/veg-pulao.jpg', half: 120, full: 150, oldHalf: 170, oldFull: 200 },
  { id: 'matar-pulao', name: 'Matar Pulao', category: 'Rice & Pulao', desc: 'Aromatic basmati rice tempered with ghee and sweet green peas.', image: 'images/matar-pulao.jpg', half: 110, full: 130, oldHalf: 160, oldFull: 180 },
  { id: 'jeera-rice', name: 'Jeera Rice', category: 'Rice & Pulao', desc: 'Fluffy basmati rice tempered with crackling roasted cumin.', image: 'images/jeera-rice.jpg', half: 140, full: 150, oldHalf: null, oldFull: null },

  { id: 'delicious-spicy-pasta', name: 'Delicious Spicy Pasta', category: 'Pasta', desc: 'Penne tossed in spicy desi tomato-garlic masala and herbs.', image: 'images/spicy-pasta.jpg', half: 110, full: 130, oldHalf: 150, oldFull: 180 },
  { id: 'veg-pasta', name: 'Veg Pasta', category: 'Pasta', desc: 'Creamy vegetable pasta loaded with sweet peppers and oregano.', image: 'images/veg-pasta.jpg', half: null, full: 150, oldHalf: null, oldFull: null },

  { id: '2-aloo-paratha-curd', name: '2 Aloo Paratha with Curd', category: 'Paratha', desc: 'Two golden stuffed potato parathas served with cool fresh curd.', image: 'images/aloo-paratha-curd.jpg', half: null, full: 150, oldHalf: null, oldFull: null },
  { id: '1-aloo-paratha', name: '1 Aloo Paratha', category: 'Paratha', desc: 'Single crispy whole-wheat paratha stuffed with spiced potatoes.', image: 'images/aloo-paratha.jpg', half: null, full: 40.5, oldHalf: null, oldFull: null },
  { id: '2-aloo-paratha-chutney', name: '2 Aloo Paratha with Green Chutney', category: 'Paratha', desc: 'Two hot stuffed Aloo Parathas paired with fresh mint chutney.', image: 'images/aloo-paratha-chutney.jpg', half: null, full: 150, oldHalf: null, oldFull: null },
  { id: '2-aloo-paratha', name: '2 Aloo Paratha', category: 'Paratha', desc: 'Two hearty tawa-cooked Aloo Parathas brushed with butter.', image: 'images/aloo-paratha.jpg', half: null, full: 99.5, oldHalf: null, oldFull: null },

  { id: 'dal-tadka', name: 'Dal Tadka', category: 'Dal & Vegetables', desc: 'Yellow dal finished with sizzling desi ghee, cumin, and red chilli.', image: 'images/dal-tadka.jpg', half: 130, full: 150, oldHalf: null, oldFull: null },
  { id: 'dal-fry', name: 'Dal Fry', category: 'Dal & Vegetables', desc: 'Slow-simmered lentils sautéed with onions, tomatoes, and ginger.', image: 'images/dal-fry.jpg', half: null, full: 120, oldHalf: null, oldFull: null },
  { id: 'mix-veg', name: 'Mix Veg', category: 'Dal & Vegetables', desc: 'Seasonal garden vegetables cooked in rich North Indian gravy.', image: 'images/mix-veg.jpg', half: 110, full: 130, oldHalf: 150, oldFull: 180 },
  { id: 'aloo-matar', name: 'Aloo Matar', category: 'Dal & Vegetables', desc: 'Tender potatoes and green peas simmered in homestyle curry.', image: 'images/aloo-matar.jpg', half: 110, full: 130, oldHalf: 190, oldFull: 180 },

  { id: 'green-salad', name: 'Green Salad', category: 'Raita & Salad', desc: 'Freshly sliced cucumber, tomato, onion, carrot, and lemon.', image: 'images/green-salad.jpg', half: null, full: 55, oldHalf: null, oldFull: null },
  { id: 'boondi-raita', name: 'Boondi Raita', category: 'Raita & Salad', desc: 'Chilled whipped curd with crispy boondi and roasted jeera.', image: 'images/boondi-raita.jpg', half: null, full: 90, oldHalf: null, oldFull: null },
  { id: 'veg-raita', name: 'Veg Raita', category: 'Raita & Salad', desc: 'Creamy yogurt mixed with finely chopped cucumber and tomato.', image: 'images/veg-raita.jpg', half: null, full: 120, oldHalf: null, oldFull: null },
  { id: 'plain-curd', name: 'Plain Curd', category: 'Raita & Salad', desc: 'Fresh, thick homestyle dahi served chilled.', image: 'images/plain-curd.jpg', half: null, full: 80, oldHalf: null, oldFull: null },

  { id: 'sada-tawa-roti', name: 'Sada Tawa Roti', category: 'Roti & Breakfast', desc: 'Soft whole-wheat phulka puffed fresh on the iron tawa.', image: 'images/sada-roti.jpg', half: null, full: 13, oldHalf: null, oldFull: null },
  { id: 'butter-tawa-roti', name: 'Butter Tawa Roti', category: 'Roti & Breakfast', desc: 'Warm tawa roti generously brushed with melted butter.', image: 'images/butter-roti.jpg', half: null, full: 15, oldHalf: null, oldFull: null },
  { id: 'delicious-poha', name: 'Delicious Poha', category: 'Roti & Breakfast', desc: 'Flattened rice tempered with mustard seeds, peanuts, sev & lemon.', image: 'images/poha.jpg', half: 60, full: 80, oldHalf: null, oldFull: null },
  { id: '8-puri-aloo-sabzi', name: '8 Puri with Aloo Ki Sabzi', category: 'Roti & Breakfast', desc: 'Eight hot puffed puris served with traditional spiced potato curry.', image: 'images/puri-sabzi.jpg', half: null, full: 100, oldHalf: null, oldFull: null },

  { id: 'hot-milk', name: 'Hot Milk', category: 'Beverages & Extras', desc: 'Pure, steaming hot milk served fresh.', image: 'images/hot-milk.jpg', half: null, full: 50, oldHalf: null, oldFull: null },
  { id: 'tomato-ketchup', name: 'Tomato Ketchup', category: 'Beverages & Extras', desc: 'Extra pack of tangy tomato ketchup.', image: 'images/tomato-ketchup.jpg', half: null, full: 2, oldHalf: null, oldFull: null },
];

const CATEGORIES = ['All', ...new Set(MENU_ITEMS.map((item) => item.category))];
let activeCategory = 'All';
let searchTerm = '';
const selectedPortion = {};
let cart = JSON.parse(localStorage.getItem('jad_static_cart') || '[]');

function formatPrice(val) {
  return Number.isInteger(val) ? `₹${val}` : `₹${val.toFixed(2)}`;
}

function renderCategories() {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-tab ${cat === activeCategory ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderCategories();
      renderMenu();
    });
    container.appendChild(btn);
  });
}

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const filtered = MENU_ITEMS.filter((item) => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p>No dishes found matching your search.</p>';
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const hasHalf = item.half !== null;
      const portion = selectedPortion[item.id] || (hasHalf ? 'Full' : 'Standard');
      const price = portion === 'Half' && hasHalf ? item.half : item.full;
      const oldPrice = portion === 'Half' && hasHalf ? item.oldHalf : item.oldFull;

      return `
        <article class="dish-card">
          <img class="dish-img" src="${item.image}" alt="${item.name}" loading="lazy" />
          <div class="dish-body">
            <div>
              <div class="dish-cat">Pure Veg · ${item.category}</div>
              <h3 class="dish-title">${item.name}</h3>
              <p class="dish-desc">${item.desc}</p>
            </div>
            <div>
              ${
                hasHalf
                  ? `<div class="portion-row">
                      <button type="button" class="portion-btn ${portion === 'Half' ? 'active' : ''}" onclick="setPortion('${item.id}', 'Half')">Half · ${formatPrice(item.half)}</button>
                      <button type="button" class="portion-btn ${portion === 'Full' ? 'active' : ''}" onclick="setPortion('${item.id}', 'Full')">Full · ${formatPrice(item.full)}</button>
                    </div>`
                  : ''
              }
              <div class="dish-footer">
                <div>
                  <span class="price-now">${formatPrice(price)}</span>
                  ${oldPrice && oldPrice > price ? `<span class="price-old">${formatPrice(oldPrice)}</span>` : ''}
                </div>
                <button type="button" class="add-btn" onclick="addToCart('${item.id}')">Add to Cart</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

window.setPortion = function (id, portion) {
  selectedPortion[id] = portion;
  renderMenu();
};

window.addToCart = function (id) {
  const item = MENU_ITEMS.find((m) => m.id === id);
  if (!item) return;
  const hasHalf = item.half !== null;
  const variant = selectedPortion[id] || (hasHalf ? 'Full' : 'Standard');
  const price = variant === 'Half' && hasHalf ? item.half : item.full;
  const key = `${id}__${variant}`;

  const existing = cart.find((c) => c.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ key, name: item.name, variant, price, qty: 1 });
  }
  saveAndUpdateCart();
};

window.changeQty = function (key, delta) {
  cart = cart
    .map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
    .filter((c) => c.qty > 0);
  saveAndUpdateCart();
};

function saveAndUpdateCart() {
  localStorage.setItem('jad_static_cart', JSON.stringify(cart));
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotalMini').textContent = formatPrice(subtotal);
  document.getElementById('billSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('billDelivery').textContent = delivery === 0 ? 'FREE' : formatPrice(delivery);
  document.getElementById('billTotal').textContent = formatPrice(total);

  const container = document.getElementById('cartItemsContainer');
  const checkoutSection = document.getElementById('checkoutSection');

  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-cart">Your cart is empty. Add dishes from the menu to order on WhatsApp.</div>';
    checkoutSection.classList.add('hidden');
  } else {
    checkoutSection.classList.remove('hidden');
    container.innerHTML = cart
      .map(
        (c) => `
        <div class="cart-row">
          <div class="cart-row-info">
            <h4>${c.name}${c.variant !== 'Standard' ? ` (${c.variant})` : ''}</h4>
            <p>${formatPrice(c.price)} × ${c.qty} = <strong>${formatPrice(c.price * c.qty)}</strong></p>
          </div>
          <div class="qty-controls">
            <button type="button" onclick="changeQty('${c.key}', -1)">-</button>
            <span>${c.qty}</span>
            <button type="button" onclick="changeQty('${c.key}', 1)">+</button>
          </div>
        </div>
      `
      )
      .join('');
  }
}

function toggleDrawer(open) {
  document.getElementById('cartDrawer').classList.toggle('hidden', !open);
  document.getElementById('cartBackdrop').classList.toggle('hidden', !open);
}

document.getElementById('openCartBtn').addEventListener('click', () => toggleDrawer(true));
document.getElementById('closeCartBtn').addEventListener('click', () => toggleDrawer(false));
document.getElementById('cartBackdrop').addEventListener('click', () => toggleDrawer(false));

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderMenu();
});

document.getElementById('whatsappOrderForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (cart.length === 0) return;

  const name = document.getElementById('custName').value.trim();
  const mobile = document.getElementById('custMobile').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const payment = document.getElementById('custPayment').value;
  const notes = document.getElementById('custNotes').value.trim();

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  const lines = [
    '*Namaste Jai Annapurna Devi!*',
    '*New Food Order:*',
    '',
    ...cart.map(
      (c, i) =>
        `${i + 1}. ${c.name}${c.variant !== 'Standard' ? ` (${c.variant})` : ''} x ${c.qty} = ${formatPrice(c.price * c.qty)}`
    ),
    '',
    `Subtotal: ${formatPrice(subtotal)}`,
    `Delivery: ${delivery === 0 ? 'FREE' : formatPrice(delivery)}`,
    `*Total Amount: ${formatPrice(total)}*`,
    `Payment: ${payment}`,
    '',
    '*Customer Details:*',
    `Name: ${name}`,
    `Mobile: ${mobile}`,
    `Address: ${address}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean);

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  const fallback = document.getElementById('waFallbackLink');
  fallback.href = url;
  fallback.classList.remove('hidden');
  fallback.click();
});

document.getElementById('openMenuCardBtn').addEventListener('click', () => {
  document.getElementById('menuCardModal').classList.remove('hidden');
});
document.getElementById('closeMenuCardBtn').addEventListener('click', () => {
  document.getElementById('menuCardModal').classList.add('hidden');
});
document.getElementById('menuCardModal').addEventListener('click', (e) => {
  if (e.target.id === 'menuCardModal') {
    document.getElementById('menuCardModal').classList.add('hidden');
  }
});

document.getElementById('yearNow').textContent = new Date().getFullYear();
renderCategories();
renderMenu();
saveAndUpdateCart();
