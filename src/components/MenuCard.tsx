import { useState } from 'react';
import { Check, Minus, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { MenuItem, PortionVariant } from '../types';
import { formatINR } from '../utils/orderService';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem, variant: PortionVariant, qty: number, price: number) => void;
}

export function MenuCard({ item, onAddToCart }: MenuCardProps) {
  const hasHalf = item.halfPrice !== null && item.halfPrice > 0;
  const [variant, setVariant] = useState<PortionVariant>(hasHalf ? 'Full' : 'Standard');
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const activePrice = variant === 'Half' && hasHalf ? item.halfPrice! : item.fullPrice;
  const originalPrice =
    variant === 'Half' && hasHalf ? item.originalHalfPrice : item.originalFullPrice;
  const hasDiscount = originalPrice !== null && originalPrice > activePrice;

  const handleAdd = () => {
    if (!item.isAvailable) return;
    onAddToCart(item, variant, qty, activePrice);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="group bg-[#FFFDF9] border border-[#E6D9C6] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* 4:3 Culinary Photography Container */}
      <div className="relative aspect-[4/3] w-full bg-[#EFE6D8] overflow-hidden">
        {!imgError ? (
          <img
            src={item.image}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              !item.isAvailable ? 'grayscale opacity-65' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F3E6D3] to-[#E9D3B4] text-[#7C2D12] p-4 text-center">
            <UtensilsCrossed className="w-8 h-8 mb-2 opacity-60" />
            <span className="font-display text-sm font-semibold">{item.name}</span>
          </div>
        )}

        {/* Scrim for high-contrast sold out state only */}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <span className="px-3 py-1 bg-[#FFFDF9] text-[#991B1B] text-xs font-semibold rounded-md">
              Currently Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          {/* Unboxed clean metadata kicker (Zero-Pill Discipline) */}
          <div className="flex items-center justify-between gap-2 text-xs text-[#7A5C46] mb-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 border border-[#15803D] rounded-[3px] shrink-0"
                title="Pure Veg"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
              </span>
              <span className="truncate">{item.category}</span>
              {item.isPopular && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#B45309] font-medium">House Favourite</span>
                </>
              )}
            </div>
            {item.unitLabel && !hasHalf && (
              <span className="text-[#7A5C46] shrink-0">{item.unitLabel}</span>
            )}
          </div>

          <h3 className="font-display text-lg font-bold text-[#2A1810] leading-snug">
            {item.name}
          </h3>
          <p className="text-sm text-[#6B4F3B] mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        <div className="space-y-3 pt-2 border-t border-[#EFE5D5]">
          {/* Portion Selector (Half / Full) if item has halfPrice */}
          {hasHalf && (
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-[#F3ECE1] rounded-lg"
              role="group"
              aria-label={`Select portion for ${item.name}`}
            >
              <button
                type="button"
                onClick={() => setVariant('Half')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  variant === 'Half'
                    ? 'bg-[#FFFDF9] text-[#991B1B] shadow-xs'
                    : 'text-[#6B4F3B] hover:text-[#2A1810]'
                }`}
              >
                Half · {formatINR(item.halfPrice!)}
              </button>
              <button
                type="button"
                onClick={() => setVariant('Full')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  variant === 'Full'
                    ? 'bg-[#FFFDF9] text-[#991B1B] shadow-xs'
                    : 'text-[#6B4F3B] hover:text-[#2A1810]'
                }`}
              >
                Full · {formatINR(item.fullPrice)}
              </button>
            </div>
          )}

          {/* Price + Quantity + Add to Cart */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-mono-num text-lg font-bold text-[#991B1B]">
                {formatINR(activePrice)}
              </span>
              {hasDiscount && (
                <span className="font-mono-num text-xs text-[#8E735E] line-through">
                  {formatINR(originalPrice!)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Quantity Stepper */}
              <div className="flex items-center border border-[#DFCBB2] rounded-lg bg-[#FAF6F0]">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={!item.isAvailable || qty <= 1}
                  aria-label="Decrease quantity"
                  className="w-8 h-9 flex items-center justify-center text-[#5C4332] hover:text-[#991B1B] disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono-num w-6 text-center text-xs font-semibold text-[#2A1810]">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(25, q + 1))}
                  disabled={!item.isAvailable}
                  aria-label="Increase quantity"
                  className="w-8 h-9 flex items-center justify-center text-[#5C4332] hover:text-[#991B1B] disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAdd}
                disabled={!item.isAvailable}
                className={`px-3.5 h-9 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  justAdded
                    ? 'bg-[#15803D] text-white'
                    : 'bg-[#991B1B] text-[#FFFDF9] hover:bg-[#7F1D1D]'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
