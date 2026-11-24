/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Designed for @firebase/rules-unit-testing against firestore.rules.
 */

export const DIRTY_DOZEN_SPECS = [
  { id: 1, name: 'Unauthenticated list /orders', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Non-admin get /orders/{orderId} PII leak', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Non-admin list /orderStatuses scrape', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow field injection on order create', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Status forgery on order create (Delivered)', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Orphan /orders create without /orderStatuses', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Backdated createdAt timestamp forgery', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Cross-customer cancellation with wrong trackingToken', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Customer self-approval of status=Cancelled', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Mutation of terminal Delivered order', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Non-admin menu item price tampering', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Admin privilege escalation with unverified/non-owner email', expected: 'PERMISSION_DENIED' },
] as const;
