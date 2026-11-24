import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Clock,
  FileImage,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Smartphone,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { BrandLogo } from './components/BrandLogo';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { CustomerOrderTracker } from './components/CustomerOrderTracker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MenuCard } from './components/MenuCard';
import { INITIAL_MENU_ITEMS, MENU_CATEGORIES, RESTAURANT_INFO } from './data/menuData';
import { db, testConnection } from './firebase';
import {
  CartItem,
  MenuCategory,
  MenuItem,
  PortionVariant,
  SavedCustomerOrderRef,
  StoreSettings,
} from './types';
import { formatINR, getSavedCustomerOrders } from './utils/orderService';

type ActiveView = 'store' | 'track' | 'admin';

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin') return 'admin';
      if (params.get('view') === 'track') return 'track';
    }
    return 'store';
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    isOpen: true,
    openingHours: RESTAURANT_INFO.openingHours,
    announcement: `Special Offer: ₹50 Off on all dishes above ₹150 · Order on WhatsApp ${RESTAURANT_INFO.whatsappNumber}`,
  });

  const [selectedCategory, setSelectedCategory] = useState<'All' | MenuCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('jad_cart_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showOriginalMenuModal, setShowOriginalMenuModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [savedOrders, setSavedOrders] = useState<SavedCustomerOrderRef[]>(() =>
    getSavedCustomerOrders()
  );
  const [selectedTrackOrderId, setSelectedTrackOrderId] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
  }, []);

  // Persist cart locally
  useEffect(() => {
    try {
      localStorage.setItem('jad_cart_v1', JSON.stringify(cart));
    } catch {
      // Ignore storage errors
    }
  }, [cart]);

  // Listen to public menuItems (fallback to INITIAL_MENU_ITEMS if collection is empty)
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const items: MenuItem[] = [];
          snap.forEach((d) => items.push(d.data() as MenuItem));
          setMenuItems(items);
        }
      },
      () => {
        // Fallback silently to static INITIAL_MENU_ITEMS on transient offline
      }
    );
    return () => unsub();
  }, []);

  // Listen to public storeSettings/main
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'storeSettings', 'main'),
      (snap) => {
        if (snap.exists()) {
          setStoreSettings(snap.data() as StoreSettings);
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const totalCartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalCartValue = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleAddToCart = (
    item: MenuItem,
    variant: PortionVariant,
    qty: number,
    price: number
  ) => {
    const cartKey = `${item.id}__${variant}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey);
      if (existing) {
        return prev.map((c) =>
          c.cartKey === cartKey ? { ...c, qty: Math.min(50, c.qty + qty), price } : c
        );
      }
      return [
        ...prev,
        {
          cartKey,
          id: item.id,
          name: item.name,
          variant,
          price,
          qty,
          image: item.image,
        },
      ];
    });
  };

  const handleUpdateQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.cartKey === cartKey ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey));
  };

  const handleOrderPlaced = (ref: SavedCustomerOrderRef) => {
    setSavedOrders(getSavedCustomerOrders());
    setSelectedTrackOrderId(ref.orderId);
    setActiveView('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (view: ActiveView, hash?: string) => {
    setActiveView(view);
    setMobileNavOpen(false);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#2A1810]">
        {/* Slim Announcement Strip */}
        {storeSettings.announcement && activeView === 'store' && (
          <div className="bg-[#991B1B] text-[#FDE68A] text-xs font-medium py-2 px-4 text-center">
            {storeSettings.announcement}
          </div>
        )}

        {/* Strict 3-Zone Top Bar Contract */}
        <header className="sticky top-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-sm border-b border-[#E5D9C5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Brand Wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('store');
              }}
              className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
            >
              <BrandLogo className="w-9 h-9 shrink-0" />
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#991B1B] whitespace-nowrap">
                Jai Annapurna Devi
              </span>
            </a>

            {/* Zone 2: 4 Concise Single-Line Nav Links */}
            <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#5C4332]">
              <button
                type="button"
                onClick={() => navigateTo('store', 'menu-section')}
                className={`hover:text-[#991B1B] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'store' ? 'text-[#991B1B]' : ''
                }`}
              >
                Menu
              </button>
              <button
                type="button"
                onClick={() => navigateTo('track')}
                className={`hover:text-[#991B1B] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'track' ? 'text-[#991B1B]' : ''
                }`}
              >
                Track Order{savedOrders.length > 0 ? ` (${savedOrders.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => navigateTo('store', 'contact-footer')}
                className="hover:text-[#991B1B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                className={`hover:text-[#991B1B] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'admin' ? 'text-[#991B1B]' : ''
                }`}
              >
                Owner Panel
              </button>
            </nav>

            {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 bg-[#991B1B] text-[#FFFDF9] text-xs font-semibold rounded-lg hover:bg-[#7F1D1D] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Cart ({totalCartCount})</span>
                {totalCartValue > 0 && (
                  <span className="font-mono-num text-[#FDE68A]">
                    · {formatINR(totalCartValue)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg border border-[#DFCBB2] text-[#5C4332]"
                aria-label="Toggle navigation menu"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Nav Drawer */}
          {mobileNavOpen && (
            <div className="md:hidden bg-[#FFFDF9] border-t border-[#E5D9C5] px-4 py-3 flex flex-col gap-2 text-sm font-semibold text-[#5C4332]">
              <button
                type="button"
                onClick={() => navigateTo('store', 'menu-section')}
                className="py-2 text-left hover:text-[#991B1B]"
              >
                Menu
              </button>
              <button
                type="button"
                onClick={() => navigateTo('track')}
                className="py-2 text-left hover:text-[#991B1B]"
              >
                Track Order{savedOrders.length > 0 ? ` (${savedOrders.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => navigateTo('store', 'contact-footer')}
                className="py-2 text-left hover:text-[#991B1B]"
              >
                Contact &amp; Hours
              </button>
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                className="py-2 text-left hover:text-[#991B1B]"
              >
                Owner Panel
              </button>
            </div>
          )}
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1">
          {activeView === 'store' && (
            <>
              {/* SECTION 1: HERO BANNER */}
              <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  {/* Left Editorial Column */}
                  <div className="lg:col-span-6 bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-6 sm:p-10 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="text-xs font-semibold text-[#B45309] flex items-center gap-2">
                        <span>100% Pure Vegetarian Cloud Kitchen</span>
                        <span aria-hidden="true">·</span>
                        <span>{storeSettings.isOpen ? 'Open Now' : 'Closed'}</span>
                      </div>

                      <h1
                        className="font-display font-bold text-[#2A1810] leading-[1.12] tracking-tight"
                        style={{ fontSize: 'clamp(2rem, 3.8vw, 3.25rem)', textWrap: 'balance' }}
                      >
                        Sacred Home-Style Indian Flavours, Delivered Hot
                      </h1>

                      <p className="text-base text-[#5C4332] leading-relaxed max-w-xl">
                        Prepared fresh per order at <strong>Jai Annapurna Devi</strong> with pure spices, rich paneer gravies, tawa Aloo Parathas, and steaming Pulao. Enjoy{' '}
                        <strong className="text-[#991B1B]">₹50 off on all menu dishes above ₹150</strong>.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href="#menu-section"
                          className="px-6 py-3 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] transition-colors whitespace-nowrap"
                        >
                          Order from Menu
                        </a>

                        <a
                          href={`https://wa.me/91${RESTAURANT_INFO.whatsappNumber}?text=${encodeURIComponent(
                            'Namaste Jai Annapurna Devi! I would like to place a food order.'
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-3 bg-[#15803D] text-white text-sm font-semibold rounded-xl hover:bg-[#166534] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Order on WhatsApp ({RESTAURANT_INFO.whatsappNumber})</span>
                        </a>
                      </div>

                      <div className="pt-3 border-t border-[#EFE5D5] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B4F3B]">
                        <span>
                          Online UPI / PhonePe / GPay:{' '}
                          <strong className="font-mono-num text-[#2A1810]">
                            {RESTAURANT_INFO.upiNumber}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowOriginalMenuModal(true)}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#991B1B] hover:underline cursor-pointer"
                        >
                          <FileImage className="w-3.5 h-3.5" />
                          <span>View Printed Menu Card</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Culinary Photography */}
                  <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-[#E5D9C5] min-h-[280px] lg:min-h-full bg-[#EFE5D5]">
                    <img
                      src="/src/assets/images/hero_indian_thali_1795527587477.jpg"
                      alt="Jai Annapurna Devi pure vegetarian Indian feast with Shahi Paneer, Dal Tadka, Jeera Rice, and Aloo Paratha"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-[#FFFDF9]">
                      <div className="text-xs text-[#FDE68A] font-medium">
                        Chef&apos;s Special · Fresh Tawa &amp; Handi Kitchen
                      </div>
                      <div className="font-display text-lg font-bold">
                        Shahi Paneer, Butter Paneer Masala &amp; Stuffed Aloo Paratha
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: MENU & FOOD CATEGORIES */}
              <section id="menu-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5D9C5] pb-5">
                  <div>
                    <p className="text-xs font-semibold text-[#B45309] mb-1">
                      Freshly Cooked Pure Veg Menu
                    </p>
                    <h2 className="font-display text-3xl font-bold text-[#2A1810]">
                      Explore Our Dishes
                    </h2>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-[#8E735E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Paneer, Paratha, Pulao, Maggi..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FFFDF9] border border-[#DFCBB2] rounded-xl focus:outline-none focus:border-[#991B1B]"
                    />
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div
                  className="flex items-center gap-2 overflow-x-auto pb-2"
                  role="tablist"
                  aria-label="Food Categories"
                >
                  {MENU_CATEGORIES.map((category) => {
                    const active = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#991B1B] text-[#FFFDF9]'
                            : 'bg-[#FFFDF9] border border-[#E5D9C5] text-[#5C4332] hover:border-[#991B1B] hover:text-[#991B1B]'
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>

                {/* Menu Grid */}
                {filteredMenu.length === 0 ? (
                  <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-10 text-center space-y-2">
                    <p className="text-sm font-semibold text-[#2A1810]">
                      No dishes matched &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                      }}
                      className="text-xs font-semibold text-[#991B1B] hover:underline"
                    >
                      Show all menu items
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMenu.map((item) => (
                      <MenuCard key={item.id} item={item} onAddToCart={handleAddToCart} />
                    ))}
                  </div>
                )}
              </section>

              {/* SECTION 3: ONLINE PAYMENT & WHATSAPP ENQUIRY */}
              <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
                <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#B45309]">
                      Fast Direct Ordering &amp; Payment
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#2A1810]">
                      Easy UPI Payment &amp; Direct WhatsApp Support
                    </h2>
                    <p className="text-sm text-[#5C4332] leading-relaxed">
                      Order seamlessly on the website with live kitchen tracking, or send your custom meal enquiry directly on WhatsApp. All online UPI payments (PhonePe, Google Pay, Paytm) are accepted on{' '}
                      <strong className="font-mono-num text-[#991B1B]">
                        {RESTAURANT_INFO.upiNumber}
                      </strong>
                      .
                    </p>
                  </div>

                  <div className="bg-[#FAF6F0] border border-[#DFCBB2] rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-[#E5D9C5] pb-3">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-5 h-5 text-[#991B1B]" />
                        <div>
                          <div className="text-xs text-[#7A5C46]">Online Payment &amp; WhatsApp No.</div>
                          <div className="font-mono-num text-lg font-bold text-[#2A1810]">
                            {RESTAURANT_INFO.whatsappNumber}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#15803D]">Verified</span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`https://wa.me/91${RESTAURANT_INFO.whatsappNumber}?text=${encodeURIComponent(
                          'Namaste Jai Annapurna Devi! I have an order enquiry.'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp Enquiry</span>
                      </a>
                      <a
                        href={`tel:+91${RESTAURANT_INFO.whatsappNumber}`}
                        className="py-2.5 px-4 bg-[#FFFDF9] border border-[#DFCBB2] text-[#2A1810] text-xs font-semibold rounded-lg hover:border-[#991B1B] inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Phone className="w-4 h-4 text-[#991B1B]" />
                        <span>Call Kitchen</span>
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeView === 'track' && (
            <CustomerOrderTracker
              savedOrders={savedOrders}
              selectedOrderId={selectedTrackOrderId}
              onSelectOrderId={setSelectedTrackOrderId}
              onBackToMenu={() => navigateTo('store')}
            />
          )}

          {activeView === 'admin' && (
            <AdminDashboard
              menuItems={menuItems}
              storeSettings={storeSettings}
              onBackToStore={() => navigateTo('store')}
            />
          )}
        </main>

        {/* SECTION 4: FOOTER */}
        <footer id="contact-footer" className="bg-[#2A1810] text-[#F5EFE6] mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <BrandLogo className="w-8 h-8" />
                <span className="font-display text-xl font-bold text-[#FDE68A]">
                  Jai Annapurna Devi
                </span>
              </div>
              <p className="text-xs text-[#D6C7B5] leading-relaxed max-w-xs">
                100% Pure Vegetarian Indian Cloud Kitchen serving homestyle Paneer curries, Parathas, Dal Tadka, Pulao, and freshly prepared snacks.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <h3 className="font-display text-base font-bold text-[#FDE68A]">
                Kitchen Address &amp; Hours
              </h3>
              <div className="flex items-start gap-2 text-[#E6D9C6]">
                <MapPin className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <span>{RESTAURANT_INFO.address}</span>
              </div>
              <div className="flex items-start gap-2 text-[#E6D9C6]">
                <Clock className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <span>{storeSettings.openingHours}</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <h3 className="font-display text-base font-bold text-[#FDE68A]">
                Phone, WhatsApp &amp; UPI Payment
              </h3>
              <div className="flex items-center gap-2 text-[#E6D9C6]">
                <Phone className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <a href={`tel:+91${RESTAURANT_INFO.whatsappNumber}`} className="font-mono-num hover:underline">
                  {RESTAURANT_INFO.phoneDisplay}
                </a>
              </div>
              <div className="flex items-center gap-2 text-[#E6D9C6]">
                <MessageCircle className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <a
                  href={`https://wa.me/91${RESTAURANT_INFO.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-num hover:underline"
                >
                  WhatsApp: {RESTAURANT_INFO.whatsappDisplay}
                </a>
              </div>
              <div className="text-[#D6C7B5]">
                Online UPI Payment Number:{' '}
                <strong className="font-mono-num text-[#FDE68A]">
                  {RESTAURANT_INFO.upiNumber}
                </strong>
              </div>
            </div>
          </div>
          <div className="border-t border-[#432B1F] py-4 px-4 text-center text-xs text-[#BFA992]">
            © {new Date().getFullYear()} Jai Annapurna Devi Pure Veg Cloud Kitchen · India
          </div>
        </footer>

        {/* Cart & Checkout Drawer */}
        <CartCheckoutDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onUpdateQty={handleUpdateQty}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCart([])}
          onOrderPlaced={handleOrderPlaced}
          isKitchenOpen={storeSettings.isOpen}
        />

        {/* Original Menu Card Modal */}
        {showOriginalMenuModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#FFFDF9] rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5D9C5] flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#2A1810]">
                  Original Printed Menu Card
                </h3>
                <button
                  type="button"
                  onClick={() => setShowOriginalMenuModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[#F3ECE1]"
                  aria-label="Close menu preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto bg-[#FAF6F0] text-center">
                <p className="text-xs text-[#991B1B] font-semibold mb-3">
                  Note: Website menu automatically applies ₹50 off on items above ₹150!
                </p>
                <img
                  src={RESTAURANT_INFO.originalMenuImage}
                  alt="Jai Annapurna Devi original menu card"
                  referrerPolicy="no-referrer"
                  className="w-full rounded-xl border border-[#DFCBB2]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
