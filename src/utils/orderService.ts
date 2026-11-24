import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { INITIAL_MENU_ITEMS, RESTAURANT_INFO } from '../data/menuData';
import {
  CartItem,
  MenuItem,
  OrderLineItem,
  OrderRecord,
  OrderStatusRecord,
  OrderStatusValue,
  PaymentMethod,
  SavedCustomerOrderRef,
  StoreSettings,
} from '../types';

const LOCAL_ORDERS_KEY = 'jad_recent_orders_v1';

export function generateSecureId(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function generateOrderCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `JAD-${num}`;
}

export function formatINR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `₹${rounded}` : `₹${rounded.toFixed(2)}`;
}

export function formatDateTime(ts: OrderRecord['createdAt']): string {
  if (!ts) return 'Just now';
  let date: Date;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
    date = new Date(ts.seconds * 1000);
  } else {
    return 'Just now';
  }
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getSavedCustomerOrders(): SavedCustomerOrderRef[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomerOrderRef(ref: SavedCustomerOrderRef): SavedCustomerOrderRef[] {
  const existing = getSavedCustomerOrders().filter((o) => o.orderId !== ref.orderId);
  const updated = [ref, ...existing].slice(0, 15);
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota issues
  }
  return updated;
}

export function sanitizeDigits10(val: string): string {
  return val.replace(/\D/g, '').slice(-10);
}

export function buildWhatsAppOrderUrl(params: {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  customerName?: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  deliveryAddress?: string;
  landmark?: string;
  orderNotes?: string;
  paymentMethod?: PaymentMethod;
  orderCode?: string;
  upiTransactionId?: string;
}): string {
  const lines: string[] = [];
  lines.push(`*Namaste Jai Annapurna Devi!*`);
  if (params.orderCode) {
    lines.push(`*Order ID:* ${params.orderCode}`);
  } else {
    lines.push(`*New WhatsApp Order Request*`);
  }
  lines.push('');
  lines.push('*Order Items:*');
  params.items.forEach((item, idx) => {
    const variantLabel = item.variant === 'Standard' ? '' : ` (${item.variant})`;
    lines.push(`${idx + 1}. ${item.name}${variantLabel} x ${item.qty} = ${formatINR(item.price * item.qty)}`);
  });
  lines.push('');
  lines.push(`Subtotal: ${formatINR(params.subtotal)}`);
  lines.push(`Delivery: ${params.deliveryFee === 0 ? 'FREE' : formatINR(params.deliveryFee)}`);
  lines.push(`*Total Payable: ${formatINR(params.totalAmount)}*`);

  if (params.paymentMethod) {
    lines.push(
      `Payment: ${
        params.paymentMethod === 'UPI'
          ? `Online UPI (${RESTAURANT_INFO.upiNumber})${params.upiTransactionId ? ` · Ref: ${params.upiTransactionId}` : ''}`
          : 'Cash on Delivery (COD)'
      }`
    );
  }

  if (params.customerName || params.deliveryAddress) {
    lines.push('');
    lines.push('*Customer & Delivery Details:*');
    if (params.customerName) lines.push(`Name: ${params.customerName}`);
    if (params.mobileNumber) lines.push(`Mobile: ${params.mobileNumber}`);
    if (params.whatsappNumber) lines.push(`WhatsApp: ${params.whatsappNumber}`);
    if (params.deliveryAddress) lines.push(`Address: ${params.deliveryAddress}`);
    if (params.landmark) lines.push(`Landmark: ${params.landmark}`);
    if (params.orderNotes) lines.push(`Notes: ${params.orderNotes}`);
  }

  const encoded = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/91${RESTAURANT_INFO.whatsappNumber}?text=${encoded}`;
}

export function buildCustomerStatusWhatsAppUrl(
  order: Pick<OrderRecord, 'orderCode' | 'customerName' | 'whatsappNumber' | 'totalAmount' | 'paymentMethod'>,
  status: OrderStatusValue | 'Cancellation Approved' | 'Cancellation Rejected',
  ownerNote?: string
): string {
  const cleanNumber = sanitizeDigits10(order.whatsappNumber);
  const statusMessages: Record<string, string> = {
    Accepted: `Namaste ${order.customerName}! Your order *${order.orderCode}* (Total: ${formatINR(order.totalAmount)}) from *Jai Annapurna Devi* has been *ACCEPTED*! Our kitchen is now freshly preparing your meal.`,
    Preparing: `Namaste ${order.customerName}! Your order *${order.orderCode}* is currently being prepared hot & fresh at *Jai Annapurna Devi*.`,
    'Out for Delivery': `Namaste ${order.customerName}! Great news — your order *${order.orderCode}* (${formatINR(order.totalAmount)}) is *Out for Delivery* and will reach you shortly.`,
    Delivered: `Namaste ${order.customerName}! Your order *${order.orderCode}* has been *Delivered*. Thank you for ordering from *Jai Annapurna Devi*!`,
    Cancelled: `Namaste ${order.customerName}, your order *${order.orderCode}* has been *Cancelled*. Please reach out on ${RESTAURANT_INFO.whatsappDisplay} if you need help.`,
    'Cancellation Approved': `Namaste ${order.customerName}, your cancellation request for order *${order.orderCode}* has been *APPROVED*.`,
    'Cancellation Rejected': `Namaste ${order.customerName}, regarding order *${order.orderCode}*: your cancellation request could not be approved because preparation is already underway.${ownerNote ? ` Note: ${ownerNote}` : ''}`,
  };

  const text = statusMessages[status] || `Update on your Jai Annapurna Devi order ${order.orderCode}: ${status}`;
  return `https://wa.me/91${cleanNumber}?text=${encodeURIComponent(text)}`;
}

export async function placeOrderInFirestore(input: {
  customerName: string;
  mobileNumber: string;
  whatsappNumber: string;
  deliveryAddress: string;
  landmark: string;
  orderNotes: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  upiTransactionId: string;
}): Promise<SavedCustomerOrderRef> {
  const orderId = generateSecureId(24);
  const trackingToken = generateSecureId(28);
  const orderCode = generateOrderCode();

  const sanitizedItems: OrderLineItem[] = input.items.slice(0, 30).map((item) => ({
    id: item.id.slice(0, 64),
    name: item.name.trim().slice(0, 100),
    variant: item.variant.slice(0, 30),
    qty: Math.max(1, Math.min(50, Math.round(item.qty))),
    price: Math.max(1, Math.min(5000, Number(item.price))),
  }));

  const itemCount = sanitizedItems.reduce((sum, i) => sum + i.qty, 0);
  const paymentStatus =
    input.paymentMethod === 'UPI' ? 'Pending Verification' : 'Cash on Delivery';

  const orderDocData = {
    orderId,
    orderCode,
    customerName: input.customerName.trim().slice(0, 100),
    mobileNumber: sanitizeDigits10(input.mobileNumber),
    whatsappNumber: sanitizeDigits10(input.whatsappNumber),
    deliveryAddress: input.deliveryAddress.trim().slice(0, 400),
    landmark: input.landmark.trim().slice(0, 150),
    orderNotes: input.orderNotes.trim().slice(0, 300),
    items: sanitizedItems,
    subtotal: Number(input.subtotal),
    deliveryFee: Number(input.deliveryFee),
    totalAmount: Number(input.totalAmount),
    paymentMethod: input.paymentMethod,
    paymentStatus,
    upiTransactionId: input.upiTransactionId.trim().slice(0, 80),
    status: 'Pending',
    cancellationStatus: 'None',
    cancellationReason: '',
    ownerNote: '',
    trackingToken,
    customerUid: auth.currentUser?.uid || 'guest',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const orderStatusDocData = {
    orderId,
    orderCode,
    itemsSummary: sanitizedItems,
    itemCount,
    totalAmount: Number(input.totalAmount),
    paymentMethod: input.paymentMethod,
    paymentStatus,
    status: 'Pending',
    cancellationStatus: 'None',
    cancellationReason: '',
    ownerNote: '',
    trackingToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'orders', orderId), orderDocData);
  batch.set(doc(db, 'orderStatuses', orderId), orderStatusDocData);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
  }

  const ref: SavedCustomerOrderRef = {
    orderId,
    orderCode,
    trackingToken,
    totalAmount: Number(input.totalAmount),
    createdAtIso: new Date().toISOString(),
  };
  saveCustomerOrderRef(ref);
  return ref;
}

export async function requestOrderCancellation(
  orderStatus: OrderStatusRecord,
  reason: string
): Promise<void> {
  const path = `orderStatuses/${orderStatus.orderId}`;
  try {
    await updateDoc(doc(db, 'orderStatuses', orderStatus.orderId), {
      cancellationStatus: 'Requested',
      cancellationReason: reason.trim().slice(0, 300) || 'Customer requested cancellation',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateOrderStatus(
  orderId: string,
  newStatus: OrderStatusValue,
  paymentStatus?: OrderRecord['paymentStatus'],
  ownerNote?: string
): Promise<void> {
  const batch = writeBatch(db);
  const orderPatch: Record<string, unknown> = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };
  const statusPatch: Record<string, unknown> = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };

  if (paymentStatus) {
    orderPatch.paymentStatus = paymentStatus;
    statusPatch.paymentStatus = paymentStatus;
  }
  if (typeof ownerNote === 'string') {
    const cleanNote = ownerNote.trim().slice(0, 300);
    orderPatch.ownerNote = cleanNote;
    statusPatch.ownerNote = cleanNote;
  }

  batch.update(doc(db, 'orders', orderId), orderPatch);
  batch.update(doc(db, 'orderStatuses', orderId), statusPatch);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function adminHandleCancellation(
  orderId: string,
  decision: 'Approved' | 'Rejected',
  ownerNote: string
): Promise<void> {
  const batch = writeBatch(db);
  const cleanNote = ownerNote.trim().slice(0, 300);
  const orderPatch: Record<string, unknown> = {
    cancellationStatus: decision,
    ownerNote: cleanNote,
    updatedAt: serverTimestamp(),
  };
  const statusPatch: Record<string, unknown> = {
    cancellationStatus: decision,
    ownerNote: cleanNote,
    updatedAt: serverTimestamp(),
  };

  if (decision === 'Approved') {
    orderPatch.status = 'Cancelled';
    statusPatch.status = 'Cancelled';
  }

  batch.update(doc(db, 'orders', orderId), orderPatch);
  batch.update(doc(db, 'orderStatuses', orderId), statusPatch);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function seedMenuIfEmpty(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'menuItems'));
    if (!snap.empty) return snap.size;

    const batch = writeBatch(db);
    INITIAL_MENU_ITEMS.forEach((item) => {
      const payload = {
        ...item,
        updatedAt: serverTimestamp(),
      };
      batch.set(doc(db, 'menuItems', item.id), payload);
    });
    await batch.commit();
    return INITIAL_MENU_ITEMS.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'menuItems');
  }
}

export async function adminSaveMenuItem(item: MenuItem): Promise<void> {
  const path = `menuItems/${item.id}`;
  try {
    await setDoc(doc(db, 'menuItems', item.id), {
      id: item.id,
      name: item.name.trim().slice(0, 100),
      category: item.category,
      description: item.description.trim().slice(0, 240),
      image: item.image.trim().slice(0, 300),
      halfPrice: item.halfPrice !== null ? Number(item.halfPrice) : null,
      fullPrice: Number(item.fullPrice),
      originalHalfPrice: item.originalHalfPrice !== null ? Number(item.originalHalfPrice) : null,
      originalFullPrice: item.originalFullPrice !== null ? Number(item.originalFullPrice) : null,
      unitLabel: (item.unitLabel || '').trim().slice(0, 40),
      isAvailable: Boolean(item.isAvailable),
      isPopular: Boolean(item.isPopular),
      sortOrder: Number(item.sortOrder),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminSaveStoreSettings(settings: StoreSettings): Promise<void> {
  const path = 'storeSettings/main';
  try {
    await setDoc(doc(db, 'storeSettings', 'main'), {
      isOpen: Boolean(settings.isOpen),
      openingHours: settings.openingHours.trim().slice(0, 120),
      announcement: settings.announcement.trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAdminDeviceToken(token: string, label: string): Promise<void> {
  if (!auth.currentUser) return;
  const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || generateSecureId(24);
  const path = `adminDevices/${tokenId}`;
  try {
    await setDoc(doc(db, 'adminDevices', tokenId), {
      token: token.slice(0, 500),
      deviceLabel: label.slice(0, 100),
      ownerUid: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
