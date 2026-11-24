import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock,
  MessageCircle,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { RESTAURANT_INFO } from '../data/menuData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { OrderStatusRecord, OrderStatusValue, SavedCustomerOrderRef } from '../types';
import { formatDateTime, formatINR, requestOrderCancellation } from '../utils/orderService';
import { playOrderAlertSound, showSystemNotification } from '../utils/soundAndNotifications';

interface CustomerOrderTrackerProps {
  savedOrders: SavedCustomerOrderRef[];
  selectedOrderId: string | null;
  onSelectOrderId: (id: string) => void;
  onBackToMenu: () => void;
}

const TIMELINE_STEPS: { status: OrderStatusValue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: 'Pending', label: 'Order Placed', icon: Clock },
  { status: 'Accepted', label: 'Accepted', icon: CheckCircle2 },
  { status: 'Preparing', label: 'Preparing', icon: ChefHat },
  { status: 'Out for Delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'Delivered', label: 'Delivered', icon: PackageCheck },
];

export function CustomerOrderTracker({
  savedOrders,
  selectedOrderId,
  onSelectOrderId,
  onBackToMenu,
}: CustomerOrderTrackerProps) {
  const activeId = selectedOrderId || savedOrders[0]?.orderId || null;
  const [liveStatus, setLiveStatus] = useState<OrderStatusRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');
  const prevStatusRef = useRef<OrderStatusValue | null>(null);
  const prevCancelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeId) {
      setLiveStatus(null);
      return;
    }

    setLoading(true);
    prevStatusRef.current = null;
    prevCancelRef.current = null;
    setStatusBanner(null);

    const path = `orderStatuses/${activeId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'orderStatuses', activeId),
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setLiveStatus(null);
          return;
        }
        const data = snap.data() as OrderStatusRecord;
        setLiveStatus(data);

        // Detect live status transition from owner action!
        if (prevStatusRef.current && prevStatusRef.current !== data.status) {
          playOrderAlertSound('accepted');
          if (data.status === 'Accepted') {
            const msg = `Order ${data.orderCode} Accepted! Jai Annapurna Devi is preparing your meal.`;
            setStatusBanner(msg);
            showSystemNotification('Order Accepted — Jai Annapurna Devi', msg, `cust-${data.orderId}`);
          } else {
            const msg = `Order ${data.orderCode} is now: ${data.status}`;
            setStatusBanner(msg);
            showSystemNotification('Order Update — Jai Annapurna Devi', msg, `cust-${data.orderId}`);
          }
        }

        if (prevCancelRef.current && prevCancelRef.current !== data.cancellationStatus) {
          if (data.cancellationStatus === 'Approved') {
            playOrderAlertSound('accepted');
            setStatusBanner(`Your cancellation request for ${data.orderCode} has been Approved.`);
          } else if (data.cancellationStatus === 'Rejected') {
            playOrderAlertSound('accepted');
            setStatusBanner(`Your cancellation request for ${data.orderCode} was declined by the kitchen.`);
          }
        }

        prevStatusRef.current = data.status;
        prevCancelRef.current = data.cancellationStatus;
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [activeId]);

  const handleRequestCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveStatus) return;
    setSubmittingCancel(true);
    setCancelMsg('');
    try {
      await requestOrderCancellation(liveStatus, cancelReason);
      setShowCancelForm(false);
      setCancelReason('');
      setCancelMsg('Cancellation request sent to the owner. Waiting for approval.');
    } catch {
      setCancelMsg('Could not submit cancellation request. Please contact us on WhatsApp.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const canRequestCancel =
    liveStatus &&
    ['Pending', 'Accepted', 'Preparing'].includes(liveStatus.status) &&
    liveStatus.cancellationStatus === 'None';

  const activeStepIndex = liveStatus
    ? TIMELINE_STEPS.findIndex((s) => s.status === liveStatus.status)
    : 0;

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309] mb-1">
            Live Kitchen Updates
          </p>
          <h1 className="font-display text-3xl font-bold text-[#2A1810]">
            Track Your Order
          </h1>
        </div>
        <button
          type="button"
          onClick={onBackToMenu}
          className="px-4 py-2 text-xs font-semibold border border-[#DFCBB2] bg-[#FFFDF9] text-[#5C4332] rounded-lg hover:border-[#991B1B] hover:text-[#991B1B] transition-colors"
        >
          Back to Menu
        </button>
      </div>

      {savedOrders.length === 0 ? (
        <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-10 text-center space-y-3">
          <Clock className="w-10 h-10 mx-auto text-[#B45309]" />
          <h2 className="font-display text-xl font-bold text-[#2A1810]">
            No recent orders found on this device
          </h2>
          <p className="text-sm text-[#6B4F3B] max-w-md mx-auto">
            Place an order from our menu to track its live status from Pending to Delivered in real time.
          </p>
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-2 px-5 py-2.5 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-lg hover:bg-[#7F1D1D]"
          >
            Explore Menu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Recent Orders Selector */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="text-xs font-semibold text-[#7A5C46]">
              Your Recent Orders
            </h2>
            <div className="space-y-2">
              {savedOrders.map((ord) => {
                const isSelected = ord.orderId === activeId;
                return (
                  <button
                    key={ord.orderId}
                    type="button"
                    onClick={() => onSelectOrderId(ord.orderId)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-[#FFFDF9] border-[#991B1B] shadow-xs'
                        : 'bg-[#F5EFE6] border-[#E5D9C5] hover:bg-[#FFFDF9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-bold text-[#2A1810]">
                        {ord.orderCode}
                      </span>
                      <span className="font-mono-num text-sm font-bold text-[#991B1B]">
                        {formatINR(ord.totalAmount)}
                      </span>
                    </div>
                    <div className="text-xs text-[#7A5C46] mt-1">
                      {new Date(ord.createdAtIso).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Status Card */}
          <div className="lg:col-span-8">
            {loading && !liveStatus ? (
              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-8 text-center text-sm text-[#6B4F3B]">
                Loading live order status...
              </div>
            ) : !liveStatus ? (
              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-8 text-center text-sm text-[#6B4F3B]">
                Order record not found.
              </div>
            ) : (
              <div className="bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-5 sm:p-6 space-y-6">
                {statusBanner && (
                  <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-[#166534] text-sm font-semibold flex items-center gap-2.5">
                    <BellRing className="w-4 h-4 shrink-0" />
                    <span>{statusBanner}</span>
                  </div>
                )}

                {cancelMsg && (
                  <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-semibold">
                    {cancelMsg}
                  </div>
                )}

                {/* Order Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#EFE5D5]">
                  <div>
                    <div className="text-xs text-[#7A5C46] flex items-center gap-2">
                      <span>Order Code</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(liveStatus.createdAt)}</span>
                    </div>
                    <h2 className="font-mono-num text-2xl font-bold text-[#2A1810] mt-0.5">
                      {liveStatus.orderCode}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#7A5C46]">
                      {liveStatus.paymentMethod === 'UPI' ? 'Online UPI' : 'Cash on Delivery'} ·{' '}
                      {liveStatus.paymentStatus}
                    </div>
                    <div className="font-mono-num text-xl font-bold text-[#991B1B] mt-0.5">
                      {formatINR(liveStatus.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Live Timeline or Cancelled State */}
                {liveStatus.status === 'Cancelled' ? (
                  <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-[#991B1B] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-[#991B1B]">
                        Order Cancelled
                      </div>
                      <p className="text-xs text-[#7F1D1D] mt-1">
                        {liveStatus.ownerNote ||
                          liveStatus.cancellationReason ||
                          'This order has been cancelled.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#5C4332]">
                      <span>Current Status: {liveStatus.status}</span>
                      <span>Live Auto-Updating</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isDone = idx <= activeStepIndex;
                        const isCurrent = idx === activeStepIndex;
                        return (
                          <div
                            key={step.status}
                            className={`p-3 rounded-xl border text-center transition-colors ${
                              isCurrent
                                ? 'bg-[#FEF2F2] border-[#991B1B] text-[#991B1B]'
                                : isDone
                                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
                                : 'bg-[#FAF6F0] border-[#E5D9C5] text-[#8E735E]'
                            }`}
                          >
                            <Icon className="w-5 h-5 mx-auto mb-1.5" />
                            <div className="text-[11px] font-semibold leading-tight">
                              {step.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cancellation Status Notice */}
                {liveStatus.cancellationStatus !== 'None' && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                      liveStatus.cancellationStatus === 'Approved'
                        ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                        : liveStatus.cancellationStatus === 'Rejected'
                        ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                        : 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        Cancellation Status: {liveStatus.cancellationStatus}
                      </div>
                      {liveStatus.cancellationReason && (
                        <div>Your Reason: {liveStatus.cancellationReason}</div>
                      )}
                      {liveStatus.ownerNote && (
                        <div>Kitchen Note: {liveStatus.ownerNote}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#7A5C46]">
                    Items Ordered ({liveStatus.itemCount})
                  </h3>
                  <div className="divide-y divide-[#EFE5D5] border border-[#E5D9C5] rounded-xl bg-[#FAF6F0]">
                    {liveStatus.itemsSummary.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div className="text-[#2A1810]">
                          <span className="font-medium">{item.name}</span>
                          {item.variant !== 'Standard' && (
                            <span className="text-[#7A5C46]"> ({item.variant})</span>
                          )}
                          <span className="text-[#7A5C46]"> × {item.qty}</span>
                        </div>
                        <span className="font-mono-num font-semibold text-[#2A1810]">
                          {formatINR(item.price * item.qty)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions: Request Cancellation + WhatsApp Enquiry */}
                <div className="pt-2 border-t border-[#EFE5D5] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {canRequestCancel && !showCancelForm && (
                      <button
                        type="button"
                        onClick={() => setShowCancelForm(true)}
                        className="px-4 py-2 text-xs font-semibold border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                      >
                        Request Order Cancellation
                      </button>
                    )}

                    <a
                      href={`https://wa.me/91${RESTAURANT_INFO.whatsappNumber}?text=${encodeURIComponent(
                        `Namaste Jai Annapurna Devi! Enquiry about my order ${liveStatus.orderCode} (Status: ${liveStatus.status}).`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-xs font-semibold bg-[#15803D] text-white rounded-lg hover:bg-[#166534] transition-colors inline-flex items-center gap-1.5 ml-auto"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Kitchen ({RESTAURANT_INFO.whatsappNumber})</span>
                    </a>
                  </div>

                  {showCancelForm && canRequestCancel && (
                    <form
                      onSubmit={handleRequestCancellation}
                      className="p-4 rounded-xl bg-[#FAF6F0] border border-[#FECACA] space-y-3"
                    >
                      <label className="block text-xs font-semibold text-[#991B1B]">
                        Reason for Cancellation Request
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={300}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g. Ordered by mistake / Need to change items"
                        className="w-full px-3 py-2 text-sm bg-[#FFFDF9] border border-[#DFCBB2] rounded-lg focus:outline-none focus:border-[#991B1B]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={submittingCancel}
                          className="px-4 py-2 text-xs font-semibold bg-[#991B1B] text-white rounded-lg hover:bg-[#7F1D1D] disabled:opacity-60"
                        >
                          {submittingCancel ? 'Sending...' : 'Submit Cancellation Request'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelForm(false)}
                          className="px-3 py-2 text-xs font-semibold text-[#5C4332] hover:text-[#2A1810]"
                        >
                          Keep Order
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
