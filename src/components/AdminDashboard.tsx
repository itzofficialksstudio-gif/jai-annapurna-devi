import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Utensils,
  Volume2,
  XCircle,
} from 'lucide-react';
import { MENU_CATEGORIES, RESTAURANT_INFO } from '../data/menuData';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  MenuCategory,
  MenuItem,
  OrderRecord,
  OrderStatusRecord,
  OrderStatusValue,
  StoreSettings,
} from '../types';
import {
  adminHandleCancellation,
  adminSaveMenuItem,
  adminSaveStoreSettings,
  adminUpdateOrderStatus,
  buildCustomerStatusWhatsAppUrl,
  formatDateTime,
  formatINR,
  restoreFullMenuCatalog,
  saveAdminDeviceToken,
  seedMenuIfEmpty,
} from '../utils/orderService';
import {
  enablePushAndFcmNotifications,
  playOrderAlertSound,
  showSystemNotification,
  subscribeForegroundFcm,
} from '../utils/soundAndNotifications';

interface AdminDashboardProps {
  menuItems: MenuItem[];
  storeSettings: StoreSettings;
  onBackToStore: () => void;
}

type AdminTab = 'orders' | 'menu' | 'settings';
type OrderFilter =
  | 'All'
  | OrderStatusValue
  | 'Cancellation Requests';

export function AdminDashboard({
  menuItems,
  storeSettings,
  onBackToStore,
}: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [ordersMap, setOrdersMap] = useState<Record<string, OrderRecord>>({});
  const [statusesMap, setStatusesMap] = useState<Record<string, OrderStatusRecord>>({});
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Notification & sound state
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [fcmStatusText, setFcmStatusText] = useState('');
  const [continuousRing, setContinuousRing] = useState(false);
  const [liveAlertBanner, setLiveAlertBanner] = useState<string | null>(null);
  const [acceptedWhatsAppPrompt, setAcceptedWhatsAppPrompt] = useState<{
    orderCode: string;
    customerName: string;
    whatsappUrl: string;
  } | null>(null);

  const initialLoadDoneRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const seenCancelRequestsRef = useRef<Set<string>>(new Set());

  // Menu editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editHalf, setEditHalf] = useState<string>('');
  const [editFull, setEditFull] = useState<string>('');
  const [seedingMenu, setSeedingMenu] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState<MenuCategory>('Paneer');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishDesc, setNewDishDesc] = useState('');

  // Settings form state
  const [kitchenOpen, setKitchenOpen] = useState(storeSettings.isOpen);
  const [openingHours, setOpeningHours] = useState(storeSettings.openingHours);
  const [announcement, setAnnouncement] = useState(storeSettings.announcement);
  const [savingSettings, setSavingSettings] = useState(false);
  const [ownerNotesInput, setOwnerNotesInput] = useState<Record<string, string>>({});

  useEffect(() => {
    setKitchenOpen(storeSettings.isOpen);
    setOpeningHours(storeSettings.openingHours);
    setAnnouncement(storeSettings.announcement);
  }, [storeSettings]);

  // Verify Auth & Admin Role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError('');

      if (!currentUser) {
        setIsAdminVerified(false);
        setAuthLoading(false);
        return;
      }

      if (!currentUser.emailVerified) {
        setIsAdminVerified(false);
        setAuthLoading(false);
        setAuthError('Your Google email must be verified to access the Owner Panel.');
        return;
      }

      const isBootstrapped =
        currentUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

      try {
        const adminRef = doc(db, 'admins', currentUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          setIsAdminVerified(true);
        } else if (isBootstrapped) {
          await setDoc(adminRef, {
            uid: currentUser.uid,
            email: currentUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
            role: 'owner',
            createdAt: serverTimestamp(),
          });
          setIsAdminVerified(true);
        } else {
          setIsAdminVerified(false);
        }
      } catch {
        setIsAdminVerified(isBootstrapped);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Attach Real-Time Orders & OrderStatuses Listeners ONLY when Admin is Verified
  useEffect(() => {
    if (!isAdminVerified) return;

    // Quietly restore any missing default dishes or stale image paths in Firestore
    seedMenuIfEmpty().catch(() => {});

    initialLoadDoneRef.current = false;
    seenOrderIdsRef.current = new Set();
    seenCancelRequestsRef.current = new Set();

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const nextMap: Record<string, OrderRecord> = {};
        const newlyAddedOrders: OrderRecord[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as OrderRecord;
          nextMap[docSnap.id] = data;

          if (!initialLoadDoneRef.current) {
            seenOrderIdsRef.current.add(docSnap.id);
          } else if (!seenOrderIdsRef.current.has(docSnap.id)) {
            seenOrderIdsRef.current.add(docSnap.id);
            newlyAddedOrders.push(data);
          }
        });

        setOrdersMap(nextMap);

        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
        } else if (newlyAddedOrders.length > 0) {
          const newest = newlyAddedOrders[0];
          playOrderAlertSound('new-order');
          const alertText = `New Order ${newest.orderCode} from ${newest.customerName} · ${formatINR(newest.totalAmount)}`;
          setLiveAlertBanner(alertText);
          showSystemNotification(
            'New Order — Jai Annapurna Devi',
            `${newest.customerName} ordered ${newest.items.length} item(s) for ${formatINR(newest.totalAmount)}`,
            `order-${newest.orderId}`
          );
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }
    );

    const unsubStatuses = onSnapshot(
      collection(db, 'orderStatuses'),
      (snapshot) => {
        const nextStatuses: Record<string, OrderStatusRecord> = {};
        snapshot.forEach((docSnap) => {
          const st = docSnap.data() as OrderStatusRecord;
          nextStatuses[docSnap.id] = st;

          if (
            st.cancellationStatus === 'Requested' &&
            !seenCancelRequestsRef.current.has(docSnap.id)
          ) {
            seenCancelRequestsRef.current.add(docSnap.id);
            if (initialLoadDoneRef.current) {
              playOrderAlertSound('new-order');
              const msg = `Cancellation requested for Order ${st.orderCode}: ${st.cancellationReason}`;
              setLiveAlertBanner(msg);
              showSystemNotification(
                'Cancellation Request — Jai Annapurna Devi',
                msg,
                `cancel-${st.orderId}`
              );
            }
          }
        });
        setStatusesMap(nextStatuses);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'orderStatuses');
      }
    );

    let unsubFcm: (() => void) | undefined;
    subscribeForegroundFcm((title, body) => {
      playOrderAlertSound('new-order');
      setLiveAlertBanner(`${title}: ${body}`);
      showSystemNotification(title, body);
    }).then((fn) => {
      unsubFcm = fn;
    });

    return () => {
      unsubOrders();
      unsubStatuses();
      if (unsubFcm) unsubFcm();
    };
  }, [isAdminVerified]);

  // Merge orders with live orderStatuses (so customer cancellation requests show up instantly!)
  const mergedOrders: OrderRecord[] = useMemo(() => {
    return Object.values(ordersMap)
      .map((ord) => {
        const liveSt = statusesMap[ord.orderId];
        if (!liveSt) return ord;
        return {
          ...ord,
          cancellationStatus: liveSt.cancellationStatus,
          cancellationReason: liveSt.cancellationReason || ord.cancellationReason,
        };
      })
      .sort((a, b) => {
        const aSec =
          a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt
            ? a.createdAt.seconds
            : 0;
        const bSec =
          b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt
            ? b.createdAt.seconds
            : 0;
        return bSec - aSec;
      });
  }, [ordersMap, statusesMap]);

  // Continuous ring option while any Pending order exists
  const pendingCount = useMemo(
    () => mergedOrders.filter((o) => o.status === 'Pending').length,
    [mergedOrders]
  );

  useEffect(() => {
    if (!isAdminVerified || !continuousRing || pendingCount === 0) return;
    const interval = setInterval(() => {
      playOrderAlertSound('new-order');
    }, 6000);
    return () => clearInterval(interval);
  }, [isAdminVerified, continuousRing, pendingCount]);

  const filteredOrders = useMemo(() => {
    return mergedOrders.filter((ord) => {
      if (orderFilter === 'Cancellation Requests') {
        if (ord.cancellationStatus !== 'Requested') return false;
      } else if (orderFilter !== 'All' && ord.status !== orderFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          ord.orderCode.toLowerCase().includes(q) ||
          ord.customerName.toLowerCase().includes(q) ||
          ord.mobileNumber.includes(q) ||
          ord.deliveryAddress.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mergedOrders, orderFilter, searchQuery]);

  const stats = useMemo(() => {
    const activeCount = mergedOrders.filter((o) =>
      ['Pending', 'Accepted', 'Preparing', 'Out for Delivery'].includes(o.status)
    ).length;
    const cancelReqCount = mergedOrders.filter(
      (o) => o.cancellationStatus === 'Requested'
    ).length;
    const totalRevenue = mergedOrders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    return { pendingCount, activeCount, cancelReqCount, totalRevenue };
  }, [mergedOrders, pendingCount]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.'
      );
    }
  };

  const handleEnablePush = async () => {
    await playOrderAlertSound('test');
    const result = await enablePushAndFcmNotifications();
    setNotifPermission(result.permission);
    if (result.fcmToken) {
      await saveAdminDeviceToken(result.fcmToken, navigator.userAgent.slice(0, 80));
      setFcmStatusText('Mobile & Desktop Push Notifications Active (FCM Connected)');
    } else if (result.permission === 'granted') {
      setFcmStatusText('Browser & Mobile Service Worker Alerts Enabled');
    } else if (result.permission === 'denied') {
      setFcmStatusText('Notifications blocked in browser settings. Enable them to receive background alerts.');
    }
  };

  const handleTestSoundAndAlert = async () => {
    const ok = await playOrderAlertSound('test');
    const shown = await showSystemNotification(
      'Test Alert — Jai Annapurna Devi',
      'New order sound and push alert are working properly!',
      'test-alert'
    );
    setLiveAlertBanner(
      ok
        ? `Sound test played! ${shown ? 'System notification also displayed.' : 'Click "Enable Push" to allow system notifications.'}`
        : 'Audio playback was blocked until page interaction.'
    );
  };

  const handleOrderStatusAction = async (order: OrderRecord, nextStatus: OrderStatusValue) => {
    await adminUpdateOrderStatus(order.orderId, nextStatus);
    if (nextStatus === 'Accepted') {
      setAcceptedWhatsAppPrompt({
        orderCode: order.orderCode,
        customerName: order.customerName,
        whatsappUrl: buildCustomerStatusWhatsAppUrl(order, 'Accepted'),
      });
    }
  };

  const handleSyncMenu = async () => {
    setSeedingMenu(true);
    try {
      const count = await restoreFullMenuCatalog();
      setLiveAlertBanner(`Full ${count}-dish menu restored to Firestore with fresh dish photos!`);
    } finally {
      setSeedingMenu(false);
    }
  };

  const handleSaveEditedPrice = async (item: MenuItem) => {
    const updated: MenuItem = {
      ...item,
      halfPrice: item.halfPrice !== null ? Math.max(1, Number(editHalf) || item.halfPrice) : null,
      fullPrice: Math.max(1, Number(editFull) || item.fullPrice),
    };
    await adminSaveMenuItem(updated);
    setEditingItemId(null);
  };

  const handleAddNewDish = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(newDishPrice);
    if (!newDishName.trim() || !priceNum || priceNum <= 0) return;
    const id = newDishName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    await adminSaveMenuItem({
      id: `${id}-${Date.now().toString().slice(-4)}`,
      name: newDishName.trim(),
      category: newDishCategory,
      description: newDishDesc.trim() || 'Freshly prepared pure vegetarian dish.',
      image: '/src/assets/images/dish_shahi_paneer_1795529029152.jpg',
      halfPrice: null,
      fullPrice: priceNum,
      originalHalfPrice: null,
      originalFullPrice: null,
      unitLabel: 'Full Plate',
      isAvailable: true,
      isPopular: false,
      sortOrder: menuItems.length + 1,
    });
    setNewDishName('');
    setNewDishPrice('');
    setNewDishDesc('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminSaveStoreSettings({
        isOpen: kitchenOpen,
        openingHours,
        announcement,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // 1. Auth Loading
  if (authLoading) {
    return (
      <section className="max-w-lg mx-auto px-4 py-16 text-center text-sm text-[#6B4F3B]">
        Verifying owner session...
      </section>
    );
  }

  // 2. Owner Login Screen
  if (!user) {
    return (
      <section className="max-w-md mx-auto px-4 py-14">
        <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#FEF2F2] text-[#991B1B] flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#2A1810]">
              Owner Admin Login
            </h1>
            <p className="text-sm text-[#6B4F3B] mt-1.5 leading-relaxed">
              Sign in with the verified Jai Annapurna Devi owner Google account to view live orders, accept orders, and manage menu prices.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs font-semibold text-[#7A5C46] hover:text-[#2A1810]"
          >
            Return to Customer Menu
          </button>
        </div>
      </section>
    );
  }

  // 3. Unauthorized User Guard
  if (!isAdminVerified) {
    return (
      <section className="max-w-md mx-auto px-4 py-14">
        <div className="bg-[#FFFDF9] border border-[#FECACA] rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <XCircle className="w-10 h-10 mx-auto text-[#991B1B]" />
          <h1 className="font-display text-2xl font-bold text-[#2A1810]">
            Owner Access Only
          </h1>
          <p className="text-sm text-[#6B4F3B]">
            Signed in as <strong>{user.email}</strong>. This account does not have owner permissions for Jai Annapurna Devi.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-4 py-2 text-xs font-semibold bg-[#991B1B] text-white rounded-lg hover:bg-[#7F1D1D]"
            >
              Sign Out & Switch Account
            </button>
            <button
              type="button"
              onClick={onBackToStore}
              className="px-4 py-2 text-xs font-semibold border border-[#DFCBB2] rounded-lg text-[#5C4332]"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 4. Verified Owner Dashboard
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Toolbar */}
      <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#7A5C46] flex items-center gap-2">
            <span>Owner Kitchen Panel</span>
            <span aria-hidden="true">·</span>
            <span>{user.email}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2A1810]">
            Jai Annapurna Devi Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTestSoundAndAlert}
            className="px-3.5 py-2 text-xs font-semibold bg-[#FFF7ED] border border-[#FDBA74] text-[#9A3412] rounded-lg hover:bg-[#FFEDD5] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Volume2 className="w-4 h-4" />
            <span>Test Alert Sound</span>
          </button>

          <button
            type="button"
            onClick={handleEnablePush}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${
              notifPermission === 'granted'
                ? 'bg-[#DCFCE7] border border-[#86EFAC] text-[#166534]'
                : 'bg-[#991B1B] text-white hover:bg-[#7F1D1D]'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>
              {notifPermission === 'granted' ? 'Mobile Push Active' : 'Enable Push Alerts'}
            </span>
          </button>

          <label className="px-3 py-2 text-xs font-semibold border border-[#DFCBB2] rounded-lg bg-[#FAF6F0] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={continuousRing}
              onChange={(e) => setContinuousRing(e.target.checked)}
              className="accent-[#991B1B]"
            />
            <span>Continuous Ring</span>
          </label>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="px-3 py-2 text-xs font-semibold border border-[#DFCBB2] rounded-lg text-[#5C4332] hover:text-[#991B1B] inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Status & Alert Banners */}
      {fcmStatusText && (
        <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-medium text-[#166534]">
          {fcmStatusText}
        </div>
      )}

      {liveAlertBanner && (
        <div className="p-4 rounded-xl bg-[#991B1B] text-[#FFFDF9] flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <BellRing className="w-5 h-5 shrink-0" />
            <span>{liveAlertBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setLiveAlertBanner(null)}
            className="px-3 py-1.5 bg-[#FFFDF9] text-[#991B1B] text-xs font-bold rounded-lg"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Instant Customer WhatsApp Prompt when Owner taps Accept */}
      {acceptedWhatsAppPrompt && (
        <div className="p-4 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[#166534]">
            <strong>Order {acceptedWhatsAppPrompt.orderCode} Accepted!</strong> Customer{' '}
            <strong>{acceptedWhatsAppPrompt.customerName}</strong>&apos;s live tracker has been updated. Send instant WhatsApp confirmation too:
          </div>
          <div className="flex items-center gap-2">
            <a
              href={acceptedWhatsAppPrompt.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send &ldquo;Order Accepted&rdquo; on WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => setAcceptedWhatsAppPrompt(null)}
              className="px-2.5 py-2 text-xs font-semibold text-[#166534]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5D9C5] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-[#991B1B] text-white'
              : 'bg-[#FFFDF9] border border-[#E5D9C5] text-[#5C4332]'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Orders ({mergedOrders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'menu'
              ? 'bg-[#991B1B] text-white'
              : 'bg-[#FFFDF9] border border-[#E5D9C5] text-[#5C4332]'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Menu &amp; Prices ({menuItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-[#991B1B] text-white'
              : 'bg-[#FFFDF9] border border-[#E5D9C5] text-[#5C4332]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Kitchen Settings</span>
        </button>
      </div>

      {/* TAB 1: ORDERS & HISTORY */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4">
              <div className="text-xs text-[#7A5C46]">Pending Approval</div>
              <div className="font-mono-num text-2xl font-bold text-[#991B1B] mt-1">
                {stats.pendingCount}
              </div>
            </div>
            <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4">
              <div className="text-xs text-[#7A5C46]">Active Kitchen Orders</div>
              <div className="font-mono-num text-2xl font-bold text-[#EA580C] mt-1">
                {stats.activeCount}
              </div>
            </div>
            <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4">
              <div className="text-xs text-[#7A5C46]">Cancellation Requests</div>
              <div className="font-mono-num text-2xl font-bold text-[#B45309] mt-1">
                {stats.cancelReqCount}
              </div>
            </div>
            <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4">
              <div className="text-xs text-[#7A5C46]">Total Revenue</div>
              <div className="font-mono-num text-2xl font-bold text-[#15803D] mt-1">
                {formatINR(stats.totalRevenue)}
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  'All',
                  'Pending',
                  'Accepted',
                  'Preparing',
                  'Out for Delivery',
                  'Delivered',
                  'Cancelled',
                  'Cancellation Requests',
                ] as OrderFilter[]
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                    orderFilter === f
                      ? 'bg-[#2A1810] text-[#FFFDF9]'
                      : 'bg-[#FFFDF9] border border-[#E5D9C5] text-[#5C4332] hover:border-[#991B1B]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-[#8E735E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order code, name, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFDF9] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
              />
            </div>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-10 text-center text-sm text-[#6B4F3B]">
              No orders match this filter yet. New customer orders appear here automatically.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <article
                  key={order.orderId}
                  className={`bg-[#FFFDF9] border rounded-2xl p-5 space-y-4 ${
                    order.status === 'Pending'
                      ? 'border-[#EA580C] shadow-sm'
                      : order.cancellationStatus === 'Requested'
                      ? 'border-[#B45309] shadow-sm'
                      : 'border-[#E5D9C5]'
                  }`}
                >
                  {/* Order Top Row */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-[#EFE5D5]">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#7A5C46]">
                        <span className="font-mono-num font-bold text-base text-[#2A1810]">
                          {order.orderCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTime(order.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#2A1810]">
                        {order.customerName}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-mono-num text-xl font-bold text-[#991B1B]">
                        {formatINR(order.totalAmount)}
                      </div>
                      <div className="text-xs font-semibold text-[#5C4332]">
                        Status: <span className="text-[#991B1B]">{order.status}</span> ·{' '}
                        {order.paymentMethod} ({order.paymentStatus})
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Request Review Box */}
                  {order.cancellationStatus === 'Requested' && (
                    <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-3">
                      <div className="text-xs font-bold text-[#92400E]">
                        Customer Requested Cancellation: &ldquo;{order.cancellationReason}&rdquo;
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          maxLength={200}
                          value={ownerNotesInput[order.orderId] || ''}
                          onChange={(e) =>
                            setOwnerNotesInput((prev) => ({
                              ...prev,
                              [order.orderId]: e.target.value,
                            }))
                          }
                          placeholder="Optional note for customer..."
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-[#FCD34D] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            adminHandleCancellation(
                              order.orderId,
                              'Approved',
                              ownerNotesInput[order.orderId] || 'Cancellation approved by kitchen'
                            )
                          }
                          className="px-3.5 py-1.5 bg-[#991B1B] text-white text-xs font-semibold rounded-lg hover:bg-[#7F1D1D]"
                        >
                          Approve Cancellation
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminHandleCancellation(
                              order.orderId,
                              'Rejected',
                              ownerNotesInput[order.orderId] || 'Order is already being prepared'
                            )
                          }
                          className="px-3.5 py-1.5 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534]"
                        >
                          Reject Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer Contact, Address & Items Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                    <div className="lg:col-span-5 space-y-2 text-[#5C4332]">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#991B1B] shrink-0" />
                        <span>Mobile: </span>
                        <a
                          href={`tel:+91${order.mobileNumber}`}
                          className="font-mono-num font-semibold text-[#2A1810] hover:underline"
                        >
                          +91 {order.mobileNumber}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                        <span>WhatsApp: </span>
                        <a
                          href={`https://wa.me/91${order.whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono-num font-semibold text-[#15803D] hover:underline"
                        >
                          +91 {order.whatsappNumber}
                        </a>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#EA580C] shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[#2A1810] font-medium">
                            {order.deliveryAddress}
                          </div>
                          {order.landmark && (
                            <div className="text-[#7A5C46]">Landmark: {order.landmark}</div>
                          )}
                          {order.orderNotes && (
                            <div className="text-[#9A3412] font-medium mt-0.5">
                              Note: {order.orderNotes}
                            </div>
                          )}
                        </div>
                      </div>
                      {order.upiTransactionId && (
                        <div className="font-mono-num text-[#15803D]">
                          UPI Ref / UTR: {order.upiTransactionId}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-7 bg-[#FAF6F0] border border-[#E5D9C5] rounded-xl p-3 space-y-1.5">
                      {order.items.map((item, i) => (
                        <div
                          key={`${item.id}-${i}`}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[#2A1810]">
                            <strong>{item.qty}×</strong> {item.name}
                            {item.variant !== 'Standard' ? ` (${item.variant})` : ''}
                          </span>
                          <span className="font-mono-num font-semibold text-[#2A1810]">
                            {formatINR(item.price * item.qty)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-1.5 border-t border-[#E5D9C5] flex justify-between text-xs text-[#7A5C46]">
                        <span>
                          Subtotal {formatINR(order.subtotal)} · Delivery{' '}
                          {order.deliveryFee === 0 ? 'FREE' : formatINR(order.deliveryFee)}
                        </span>
                        <span className="font-mono-num font-bold text-[#991B1B]">
                          Total {formatINR(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Controls + WhatsApp Customer Notification */}
                  <div className="pt-3 border-t border-[#EFE5D5] flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {order.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => handleOrderStatusAction(order, 'Accepted')}
                          className="px-4 py-2 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Accept Order</span>
                        </button>
                      )}
                      {order.status === 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => handleOrderStatusAction(order, 'Preparing')}
                          className="px-4 py-2 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C]"
                        >
                          Mark Preparing
                        </button>
                      )}
                      {order.status === 'Preparing' && (
                        <button
                          type="button"
                          onClick={() => handleOrderStatusAction(order, 'Out for Delivery')}
                          className="px-4 py-2 bg-[#B45309] text-white text-xs font-semibold rounded-lg hover:bg-[#92400E]"
                        >
                          Out for Delivery
                        </button>
                      )}
                      {order.status === 'Out for Delivery' && (
                        <button
                          type="button"
                          onClick={() =>
                            adminUpdateOrderStatus(order.orderId, 'Delivered', 'Paid')
                          }
                          className="px-4 py-2 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534]"
                        >
                          Mark Delivered
                        </button>
                      )}
                      {order.paymentMethod === 'UPI' && order.paymentStatus !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() =>
                            adminUpdateOrderStatus(order.orderId, order.status, 'Paid')
                          }
                          className="px-3 py-2 border border-[#15803D] text-[#15803D] text-xs font-semibold rounded-lg hover:bg-[#DCFCE7]/50"
                        >
                          Confirm UPI Paid
                        </button>
                      )}
                      {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleOrderStatusAction(order, 'Cancelled')}
                          className="px-3 py-2 border border-[#FECACA] text-[#991B1B] text-xs font-semibold rounded-lg hover:bg-[#FEF2F2]"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>

                    <a
                      href={buildCustomerStatusWhatsAppUrl(order, order.status)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[#FAF6F0] border border-[#15803D] text-[#15803D] text-xs font-semibold rounded-lg hover:bg-[#DCFCE7]/50 inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send {order.status} on Customer WhatsApp</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MENU & PRICE MANAGER */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4">
            <div className="text-xs text-[#5C4332]">
              Update dish prices, toggle availability, or sync the menu catalog to Firestore.
            </div>
            <button
              type="button"
              onClick={handleSyncMenu}
              disabled={seedingMenu}
              className="px-4 py-2 bg-[#991B1B] text-white text-xs font-semibold rounded-lg hover:bg-[#7F1D1D] inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{seedingMenu ? 'Restoring...' : 'Restore Full 30-Dish Menu to Firestore'}</span>
            </button>
          </div>

          {/* Add New Dish */}
          <form
            onSubmit={handleAddNewDish}
            className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                New Dish Name
              </label>
              <input
                type="text"
                required
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder="e.g. Kadhai Paneer"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                Category
              </label>
              <select
                value={newDishCategory}
                onChange={(e) => setNewDishCategory(e.target.value as MenuCategory)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
              >
                {MENU_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                required
                min={1}
                value={newDishPrice}
                onChange={(e) => setNewDishPrice(e.target.value)}
                placeholder="150"
                className="w-full px-3 py-2 text-xs font-mono-num bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={newDishDesc}
                onChange={(e) => setNewDishDesc(e.target.value)}
                placeholder="Rich spiced gravy..."
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534]"
            >
              Add Dish
            </button>
          </form>

          {/* Menu Table */}
          <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3ECE1] text-[#5C4332] font-semibold">
                <tr>
                  <th className="px-4 py-3">Dish Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Half (₹)</th>
                  <th className="px-4 py-3">Full / Price (₹)</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE5D5]">
                {menuItems.map((item) => {
                  const isEditing = editingItemId === item.id;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-[#2A1810]">{item.name}</td>
                      <td className="px-4 py-3 text-[#6B4F3B]">{item.category}</td>
                      <td className="px-4 py-3 font-mono-num">
                        {isEditing && item.halfPrice !== null ? (
                          <input
                            type="number"
                            value={editHalf}
                            onChange={(e) => setEditHalf(e.target.value)}
                            className="w-20 px-2 py-1 border border-[#DFCBB2] rounded bg-[#FAF6F0]"
                          />
                        ) : item.halfPrice !== null ? (
                          formatINR(item.halfPrice)
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono-num">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editFull}
                            onChange={(e) => setEditFull(e.target.value)}
                            className="w-20 px-2 py-1 border border-[#DFCBB2] rounded bg-[#FAF6F0]"
                          />
                        ) : (
                          formatINR(item.fullPrice)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            adminSaveMenuItem({ ...item, isAvailable: !item.isAvailable })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                            item.isAvailable
                              ? 'bg-[#DCFCE7] text-[#166534]'
                              : 'bg-[#FEF2F2] text-[#991B1B]'
                          }`}
                        >
                          {item.isAvailable ? 'In Stock' : 'Sold Out'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEditedPrice(item)}
                              className="px-2.5 py-1 bg-[#15803D] text-white rounded inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="text-[#7A5C46]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditHalf(item.halfPrice ? String(item.halfPrice) : '');
                              setEditFull(String(item.fullPrice));
                            }}
                            className="text-[#991B1B] font-semibold hover:underline"
                          >
                            Edit Price
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: KITCHEN SETTINGS */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-xl bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display text-xl font-bold text-[#2A1810]">
            Cloud Kitchen Operations
          </h2>
          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF6F0] border border-[#DFCBB2] cursor-pointer">
            <input
              type="checkbox"
              checked={kitchenOpen}
              onChange={(e) => setKitchenOpen(e.target.checked)}
              className="w-4 h-4 accent-[#15803D]"
            />
            <div>
              <div className="text-sm font-semibold text-[#2A1810]">
                Kitchen Currently Open for Orders
              </div>
              <div className="text-xs text-[#6B4F3B]">
                Uncheck to show a Closed notice on the storefront.
              </div>
            </div>
          </label>

          <div>
            <label className="block text-xs font-semibold text-[#5C4332] mb-1">
              Opening Hours
            </label>
            <input
              type="text"
              maxLength={120}
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C4332] mb-1">
              Homepage Announcement Banner
            </label>
            <input
              type="text"
              maxLength={240}
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder={`Special Offer: ₹50 Off on all dishes above ₹150! Online UPI & WhatsApp: ${RESTAURANT_INFO.whatsappNumber}`}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-[#991B1B] text-white text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] disabled:opacity-60"
          >
            {savingSettings ? 'Saving...' : 'Save Kitchen Settings'}
          </button>
        </form>
      )}
    </section>
  );
}
