import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { RESTAURANT_INFO } from '../data/menuData';
import { CartItem, PaymentMethod, SavedCustomerOrderRef } from '../types';
import {
  buildWhatsAppOrderUrl,
  formatINR,
  placeOrderInFirestore,
  sanitizeDigits10,
} from '../utils/orderService';

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  onOrderPlaced: (ref: SavedCustomerOrderRef) => void;
  isKitchenOpen: boolean;
}

type DrawerStep = 'cart' | 'checkout' | 'confirmed';

export function CartCheckoutDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  isKitchenOpen,
}: CartCheckoutDrawerProps) {
  const [step, setStep] = useState<DrawerStep>('cart');
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<{
    ref: SavedCustomerOrderRef;
    whatsappUrl: string;
    paymentMethod: PaymentMethod;
  } | null>(null);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee =
    subtotal === 0 || subtotal >= RESTAURANT_INFO.freeDeliveryThreshold
      ? 0
      : RESTAURANT_INFO.standardDeliveryFee;
  const totalAmount = subtotal + deliveryFee;

  const effectiveWhatsapp = sameAsMobile ? mobileNumber : whatsappNumber;
  const upiUri = `upi://pay?pa=${encodeURIComponent(
    RESTAURANT_INFO.upiId
  )}&pn=${encodeURIComponent(RESTAURANT_INFO.name)}&am=${totalAmount.toFixed(
    2
  )}&cu=INR&tn=${encodeURIComponent('Food Order - Jai Annapurna Devi')}`;

  const whatsappDirectCartUrl = buildWhatsAppOrderUrl({
    items: cart,
    subtotal,
    deliveryFee,
    totalAmount,
    customerName: customerName || undefined,
    mobileNumber: sanitizeDigits10(mobileNumber) || undefined,
    whatsappNumber: sanitizeDigits10(effectiveWhatsapp) || undefined,
    deliveryAddress: deliveryAddress || undefined,
    landmark: landmark || undefined,
    orderNotes: orderNotes || undefined,
    paymentMethod: step === 'checkout' ? paymentMethod : undefined,
    upiTransactionId: upiTransactionId || undefined,
  });

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(RESTAURANT_INFO.upiNumber);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cart.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    const cleanName = customerName.trim();
    const cleanMobile = sanitizeDigits10(mobileNumber);
    const cleanWhatsapp = sanitizeDigits10(effectiveWhatsapp);
    const cleanAddress = deliveryAddress.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!/^[0-9]{10}$/.test(cleanWhatsapp)) {
      setErrorMsg('Please enter a valid 10-digit WhatsApp number.');
      return;
    }
    if (cleanAddress.length < 5) {
      setErrorMsg('Please enter your complete delivery address.');
      return;
    }

    setSubmitting(true);
    try {
      const ref = await placeOrderInFirestore({
        customerName: cleanName,
        mobileNumber: cleanMobile,
        whatsappNumber: cleanWhatsapp,
        deliveryAddress: cleanAddress,
        landmark: landmark.trim(),
        orderNotes: orderNotes.trim(),
        items: cart,
        subtotal,
        deliveryFee,
        totalAmount,
        paymentMethod,
        upiTransactionId: upiTransactionId.trim(),
      });

      const waUrl = buildWhatsAppOrderUrl({
        items: cart,
        subtotal,
        deliveryFee,
        totalAmount,
        customerName: cleanName,
        mobileNumber: cleanMobile,
        whatsappNumber: cleanWhatsapp,
        deliveryAddress: cleanAddress,
        landmark: landmark.trim(),
        orderNotes: orderNotes.trim(),
        paymentMethod,
        orderCode: ref.orderCode,
        upiTransactionId: upiTransactionId.trim(),
      });

      setConfirmedOrder({
        ref,
        whatsappUrl: waUrl,
        paymentMethod,
      });
      onClearCart();
      setStep('confirmed');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? 'Could not place order right now. Please check your details or order directly on WhatsApp.'
          : 'Failed to place order.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = () => {
    if (step === 'confirmed') {
      setStep('cart');
      setConfirmedOrder(null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={handleCloseDrawer}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className="relative z-10 w-full max-w-lg bg-[#FAF6F0] h-full flex flex-col shadow-2xl border-l border-[#DFCBB2]"
        aria-label="Shopping Cart and Checkout"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#FFFDF9] border-b border-[#E5D9C5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="p-1.5 rounded-lg text-[#5C4332] hover:bg-[#F3ECE1]"
                aria-label="Back to cart"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display text-xl font-bold text-[#2A1810]">
              {step === 'cart' && 'Your Food Cart'}
              {step === 'checkout' && 'Delivery & Payment'}
              {step === 'confirmed' && 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseDrawer}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5C4332] hover:bg-[#F3ECE1] transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!isKitchenOpen && step !== 'confirmed' && (
            <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              Kitchen is currently marked closed, but you can still place a pre-order or message us on WhatsApp ({RESTAURANT_INFO.whatsappDisplay}).
            </div>
          )}

          {/* STEP 1: CART */}
          {step === 'cart' && (
            <>
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#EFE5D5] flex items-center justify-center text-[#991B1B]">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#2A1810]">
                    Your thali is empty
                  </h3>
                  <p className="text-sm text-[#6B4F3B] max-w-xs mx-auto">
                    Add fresh Shahi Paneer, Aloo Paratha, Dal Tadka, or snacks from our pure veg menu.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="mt-2 px-5 py-2.5 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-lg hover:bg-[#7F1D1D]"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.cartKey}
                      className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-3.5 flex items-center gap-3.5"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-lg object-cover bg-[#EFE5D5] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-[#2A1810] truncate">
                          {item.name}
                        </h4>
                        <div className="text-xs text-[#7A5C46] flex items-center gap-1.5 mt-0.5">
                          {item.variant !== 'Standard' && (
                            <>
                              <span>{item.variant}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="font-mono-num">{formatINR(item.price)} each</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center border border-[#DFCBB2] rounded-lg bg-[#FAF6F0]">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.cartKey, -1)}
                              aria-label="Decrease quantity"
                              className="w-7 h-7 flex items-center justify-center text-[#5C4332] hover:text-[#991B1B]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono-num w-6 text-center text-xs font-semibold">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.cartKey, 1)}
                              aria-label="Increase quantity"
                              className="w-7 h-7 flex items-center justify-center text-[#5C4332] hover:text-[#991B1B]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="font-mono-num text-sm font-bold text-[#991B1B]">
                            {formatINR(item.price * item.qty)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.cartKey)}
                        className="p-1.5 text-[#8E735E] hover:text-[#991B1B] self-start"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Bill Breakdown */}
                  <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-[#5C4332]">
                      <span>Item Subtotal</span>
                      <span className="font-mono-num font-medium">{formatINR(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#5C4332]">
                      <span>Delivery Fee</span>
                      <span className="font-mono-num font-medium">
                        {deliveryFee === 0 ? (
                          <span className="text-[#15803D] font-semibold">FREE</span>
                        ) : (
                          formatINR(deliveryFee)
                        )}
                      </span>
                    </div>
                    {deliveryFee > 0 && (
                      <p className="text-xs text-[#B45309]">
                        Add {formatINR(RESTAURANT_INFO.freeDeliveryThreshold - subtotal)} more for FREE delivery.
                      </p>
                    )}
                    <div className="pt-2 border-t border-[#EFE5D5] flex justify-between text-base font-bold text-[#2A1810]">
                      <span>Grand Total</span>
                      <span className="font-mono-num text-[#991B1B]">{formatINR(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: CHECKOUT FORM */}
          {step === 'checkout' && (
            <form id="jad-checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]">
                  {errorMsg}
                </div>
              )}

              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4 space-y-3.5">
                <h3 className="font-display text-base font-bold text-[#2A1810]">
                  Customer Details
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#5C4332]">
                        WhatsApp Number *
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] text-[#991B1B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsMobile}
                          onChange={(e) => setSameAsMobile(e.target.checked)}
                          className="accent-[#991B1B]"
                        />
                        <span>Same</span>
                      </label>
                    </div>
                    <input
                      type="tel"
                      required
                      disabled={sameAsMobile}
                      maxLength={10}
                      value={sameAsMobile ? mobileNumber : whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit WhatsApp"
                      className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B] disabled:opacity-65"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                    Complete Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    maxLength={400}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="House / Flat No., Street, Colony, Sector"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                      Landmark
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Near temple, school, park"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                      Order Notes
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Less spicy, extra chutney"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF6F0] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4 space-y-3.5">
                <h3 className="font-display text-base font-bold text-[#2A1810]">
                  Payment Method · <span className="font-mono-num text-[#991B1B]">{formatINR(totalAmount)}</span>
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'UPI'
                        ? 'border-[#991B1B] bg-[#FEF2F2]/60 text-[#2A1810]'
                        : 'border-[#DFCBB2] bg-[#FAF6F0] text-[#5C4332]'
                    }`}
                  >
                    <div className="text-xs font-bold">Online UPI Payment</div>
                    <div className="text-[11px] text-[#7A5C46] mt-0.5">
                      PhonePe / GPay / Paytm
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'COD'
                        ? 'border-[#991B1B] bg-[#FEF2F2]/60 text-[#2A1810]'
                        : 'border-[#DFCBB2] bg-[#FAF6F0] text-[#5C4332]'
                    }`}
                  >
                    <div className="text-xs font-bold">Cash on Delivery</div>
                    <div className="text-[11px] text-[#7A5C46] mt-0.5">
                      Pay when food arrives
                    </div>
                  </button>
                </div>

                {paymentMethod === 'UPI' && (
                  <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#DFCBB2] space-y-3">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2 bg-white rounded-lg border border-[#E5D9C5] shrink-0">
                        <QRCodeSVG value={upiUri} size={96} level="M" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-xs font-semibold text-[#2A1810]">
                          Pay Online on Mobile / UPI Number
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-num text-base font-bold text-[#991B1B]">
                            {RESTAURANT_INFO.upiNumber}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyNumber}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#FFFDF9] border border-[#DFCBB2] rounded-md inline-flex items-center gap-1 hover:border-[#991B1B]"
                          >
                            {copiedUpi ? (
                              <>
                                <Check className="w-3 h-3 text-[#15803D]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-[#6B4F3B] leading-relaxed">
                          Scan QR or pay <strong className="font-mono-num">{formatINR(totalAmount)}</strong> to{' '}
                          <strong className="font-mono-num">{RESTAURANT_INFO.upiNumber}</strong> via PhonePe, Google Pay, or Paytm.
                        </p>
                        <a
                          href={upiUri}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#EA580C] hover:underline"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Open UPI App to Pay</span>
                        </a>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#5C4332] mb-1">
                        UPI Transaction ID / UTR (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={upiTransactionId}
                        onChange={(e) => setUpiTransactionId(e.target.value)}
                        placeholder="Enter 12-digit UTR or payment ref after paying"
                        className="w-full px-3 py-2 text-xs font-mono-num bg-[#FFFDF9] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: CONFIRMED */}
          {step === 'confirmed' && confirmedOrder && (
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#15803D]">
                  Order Saved to Kitchen Dashboard
                </p>
                <h3 className="font-display text-2xl font-bold text-[#2A1810]">
                  Thank you for your order!
                </h3>
                <p className="text-sm text-[#5C4332]">
                  Order Code:{' '}
                  <span className="font-mono-num font-bold text-[#991B1B]">
                    {confirmedOrder.ref.orderCode}
                  </span>{' '}
                  · Total:{' '}
                  <span className="font-mono-num font-bold">
                    {formatINR(confirmedOrder.ref.totalAmount)}
                  </span>
                </p>
              </div>

              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-xl p-4 text-left text-xs text-[#5C4332] space-y-2 leading-relaxed">
                <p>
                  Our kitchen at <strong>Jai Annapurna Devi</strong> has received your order in real time. As soon as we tap <strong>Accept</strong>, your live order tracker will chime and update automatically.
                </p>
                {confirmedOrder.paymentMethod === 'UPI' && (
                  <p className="text-[#991B1B] font-medium">
                    If you paid online to {RESTAURANT_INFO.upiNumber}, you can also share the payment screenshot directly on WhatsApp below.
                  </p>
                )}
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const ref = confirmedOrder.ref;
                    handleCloseDrawer();
                    onOrderPlaced(ref);
                  }}
                  className="w-full py-3 px-4 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] transition-colors"
                >
                  Track Live Order Status
                </button>

                <a
                  href={confirmedOrder.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-[#15803D] text-white text-sm font-semibold rounded-xl hover:bg-[#166534] transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {confirmedOrder.paymentMethod === 'UPI'
                      ? 'Send Order & Payment Screenshot on WhatsApp'
                      : 'Send Order Copy on WhatsApp'}
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 'cart' && cart.length > 0 && (
          <div className="p-4 bg-[#FFFDF9] border-t border-[#E5D9C5] space-y-2.5">
            <button
              type="button"
              onClick={() => setStep('checkout')}
              className="w-full py-3 px-4 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] transition-colors flex items-center justify-between"
            >
              <span>Proceed to Checkout</span>
              <span className="font-mono-num">{formatINR(totalAmount)}</span>
            </button>
            <a
              href={whatsappDirectCartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-[#FAF6F0] border border-[#15803D] text-[#15803D] text-xs font-semibold rounded-xl hover:bg-[#DCFCE7]/50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Order Directly on WhatsApp ({RESTAURANT_INFO.whatsappNumber})</span>
            </a>
          </div>
        )}

        {step === 'checkout' && (
          <div className="p-4 bg-[#FFFDF9] border-t border-[#E5D9C5] space-y-2.5">
            <button
              type="submit"
              form="jad-checkout-form"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-xl hover:bg-[#7F1D1D] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Placing Order...' : `Confirm & Place Order · ${formatINR(totalAmount)}`}
            </button>
            <a
              href={whatsappDirectCartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-[#FAF6F0] border border-[#15803D] text-[#15803D] text-xs font-semibold rounded-xl hover:bg-[#DCFCE7]/50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Or Send This Order via My WhatsApp</span>
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}
