# Security Specification — Jai Annapurna Devi Firestore Rules

## 1. Data Invariants
1. **PII Isolation**: Customer personal information (`customerName`, `mobileNumber`, `whatsappNumber`, `deliveryAddress`, `landmark`, `orderNotes`) lives strictly in `/orders/{orderId}`. Non-admin clients can NEVER `get` or `list` `/orders`.
2. **Atomic Split-Collection Creation**: An `/orders/{orderId}` document cannot be created without an accompanying `/orderStatuses/{orderId}` document in the same atomic batch (`existsAfter`), and vice versa.
3. **Unpredictable Tracking IDs & Token Verification**: Both `orderId` and `trackingToken` must be at least 20 characters (`^[a-zA-Z0-9_-]{20,64}$`). `list` on `/orderStatuses` is strictly forbidden for non-admins.
4. **Customer Cancellation Scoping**: A customer can only request cancellation on `/orderStatuses/{orderId}` when presenting the matching `trackingToken`, while `status` is in `['Pending', 'Accepted', 'Preparing']` and `cancellationStatus == 'None'`, and only changing `['cancellationStatus', 'cancellationReason', 'updatedAt']`.
5. **Terminal State Locking**: Once `status` reaches `'Delivered'` or `'Cancelled'`, non-admin clients cannot mutate `/orderStatuses/{orderId}` at all.
6. **Strict Admin Verification**: `isAdmin()` requires `request.auth != null && request.auth.token.email_verified == true` AND either the bootstrapped owner email (`itzofficialksstudio@gmail.com`) or existence in `/admins/{request.auth.uid}`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated PII Scrape (`list /orders`)**: Non-admin attempts `getDocs(collection(db, 'orders'))` -> `PERMISSION_DENIED`.
2. **Unauthenticated PII Read (`get /orders/{orderId}`)**: Customer who placed order attempts `getDoc(doc(db, 'orders', orderId))` -> `PERMISSION_DENIED`.
3. **OrderStatus Collection Scrape (`list /orderStatuses`)**: Customer attempts `getDocs(collection(db, 'orderStatuses'))` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create (`isAdmin: true` or `discount: 999`)**: Payload adds unexpected key on `/orders/{orderId}` -> blocked by `keys().hasOnly(...)` -> `PERMISSION_DENIED`.
5. **Status Forgery on Create (`status: 'Delivered'`)**: Customer creates `/orders/{orderId}` with `status: 'Delivered'` -> blocked by `incoming().status == 'Pending'` -> `PERMISSION_DENIED`.
6. **Orphan Order Create (No `/orderStatuses/{orderId}`)**: Attacker creates `/orders/{orderId}` outside batch without `/orderStatuses/{orderId}` -> blocked by `existsAfter(...)` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery (`createdAt` backdated)**: Customer supplies past timestamp instead of `serverTimestamp()` -> blocked by `incoming().createdAt == request.time` -> `PERMISSION_DENIED`.
8. **Cross-Customer Cancellation Hijack**: Attacker sends wrong `trackingToken` to cancel someone else's order -> blocked by `incoming().trackingToken == existing().trackingToken` -> `PERMISSION_DENIED`.
9. **Customer Self-Approval of Cancellation (`cancellationStatus: 'Approved'` or `status: 'Cancelled'`)**: Customer attempts to directly set `status: 'Cancelled'` -> blocked by `incoming().cancellationStatus == 'Requested' && incoming().status == existing().status` -> `PERMISSION_DENIED`.
10. **Terminal State Mutation**: Customer attempts to request cancellation after `status == 'Delivered'` -> blocked by `existing().status in ['Pending', 'Accepted', 'Preparing']` -> `PERMISSION_DENIED`.
11. **Menu Price Tampering**: Non-admin attempts to update `/menuItems/{itemId}` `fullPrice` to `1` -> blocked by `isAdmin()` -> `PERMISSION_DENIED`.
12. **Admin Privilege Escalation & Unverified Email Spoof**: Non-owner user attempts to create `/admins/{uid}` or use unverified email -> blocked by `isBootstrappedAdminEmail()` (`email_verified == true`) -> `PERMISSION_DENIED`.
