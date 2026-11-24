export type MenuCategory =
  | 'Paneer'
  | 'Maggi & Noodles'
  | 'Rice & Pulao'
  | 'Pasta'
  | 'Paratha'
  | 'Dal & Vegetables'
  | 'Raita & Salad'
  | 'Roti & Breakfast'
  | 'Beverages & Extras';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  image: string;
  halfPrice: number | null;
  fullPrice: number;
  originalHalfPrice: number | null;
  originalFullPrice: number | null;
  unitLabel?: string;
  isAvailable: boolean;
  isPopular: boolean;
  sortOrder: number;
}

export type PortionVariant = 'Half' | 'Full' | 'Standard';

export interface CartItem {
  cartKey: string;
  id: string;
  name: string;
  variant: PortionVariant;
  price: number;
  qty: number;
  image: string;
}

export type OrderStatusValue =
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type CancellationStatusValue = 'None' | 'Requested' | 'Approved' | 'Rejected';

export type PaymentMethod = 'UPI' | 'COD';
export type PaymentStatus = 'Pending Verification' | 'Paid' | 'Cash on Delivery';

export interface OrderLineItem {
  id: string;
  name: string;
  variant: string;
  qty: number;
  price: number;
}

export interface OrderRecord {
  orderId: string;
  orderCode: string;
  customerName: string;
  mobileNumber: string;
  whatsappNumber: string;
  deliveryAddress: string;
  landmark: string;
  orderNotes: string;
  items: OrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  upiTransactionId: string;
  status: OrderStatusValue;
  cancellationStatus: CancellationStatusValue;
  cancellationReason: string;
  ownerNote: string;
  trackingToken: string;
  customerUid: string;
  createdAt?: { seconds: number; nanoseconds: number } | Date | null;
  updatedAt?: { seconds: number; nanoseconds: number } | Date | null;
}

export interface OrderStatusRecord {
  orderId: string;
  orderCode: string;
  itemsSummary: OrderLineItem[];
  itemCount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatusValue;
  cancellationStatus: CancellationStatusValue;
  cancellationReason: string;
  ownerNote: string;
  trackingToken: string;
  createdAt?: { seconds: number; nanoseconds: number } | Date | null;
  updatedAt?: { seconds: number; nanoseconds: number } | Date | null;
}

export interface SavedCustomerOrderRef {
  orderId: string;
  orderCode: string;
  trackingToken: string;
  totalAmount: number;
  createdAtIso: string;
}

export interface StoreSettings {
  isOpen: boolean;
  openingHours: string;
  announcement: string;
}
