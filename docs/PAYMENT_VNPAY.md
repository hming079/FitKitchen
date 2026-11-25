# VNPay Sandbox online payment

The backend supports paying a single-meal order online through the [VNPay Sandbox](https://sandbox.vnpayment.vn/) (payment API v2.1.0). COD checkout is unchanged. The storefront UI still offers COD only; the payment-method selector and the `/payment/result` page are a separate frontend step.

## Flow

1. The customer checks out with `payment_method: "ONLINE"`. The order is created as `status = PENDING`, `payment_status = PENDING`, and the response includes a signed `payment.redirect_url`.
2. The frontend sends the browser to that URL on `https://sandbox.vnpayment.vn`.
3. VNPay calls the **IPN** endpoint server-to-server. The IPN is the only path that changes `customer_orders.payment_status` (to `PAID` or `FAILED`).
4. VNPay sends the browser to the **return** endpoint, which only verifies the signature and redirects to `PAYMENT_RESULT_URL?order_id=<id>&result=success|failed|invalid`.
5. The result page reads the real state from `GET /api/payments/orders/:orderId`; it must not trust the query string.

The order `status` stays `PENDING` after payment. An Admin confirms it as usual; ONLINE orders cannot move to `PREPARING` until they are `PAID`.

## Endpoints

| Method | Path                            | Auth          | Purpose                                                                                     |
| ------ | ------------------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/api/orders/checkout`          | CUSTOMER      | Existing checkout. With `ONLINE`, adds `payment: { provider: "VNPAY", redirect_url }`       |
| POST   | `/api/payments/vnpay`           | CUSTOMER      | Body `{ "order_id": "42" }`. Returns a payment URL for the customer's own ONLINE order      |
| GET    | `/api/payments/vnpay/ipn`       | None (VNPay)  | Verifies the signature, updates the attempt and order, answers `{ RspCode, Message }`       |
| GET    | `/api/payments/vnpay/return`    | None          | Verifies the signature and redirects (302) to `PAYMENT_RESULT_URL`; never writes            |
| GET    | `/api/payments/orders/:orderId` | CUSTOMER      | Order and payment state, latest attempt, and `can_retry`                                    |

`POST /api/payments/vnpay` accepts orders with `payment_method = ONLINE`, `status = PENDING` and `payment_status` `PENDING` or `FAILED`. Other orders return `409 PAYMENT_NOT_ALLOWED`; orders of another customer return `404 ORDER_NOT_FOUND`. If the URL cannot be created during checkout, the order is still created and `redirect_url` is `null`; the customer retries with this endpoint.

Related order rules:

- Admin `PENDING → PREPARING` on an unpaid ONLINE order returns `409 PAYMENT_REQUIRED`.
- A customer cannot cancel a paid ONLINE order: `409 ORDER_PAID` (there is no refund flow yet).

## Configuration

Set these in `backend/.env` (see `backend/.env.example`). All five are required for online payment; when any is missing or malformed, `POST /api/payments/vnpay` and the return endpoint answer `503 PAYMENT_NOT_CONFIGURED`, the IPN answers `99`, ONLINE checkout returns `redirect_url: null`, and COD keeps working.

| Variable             | Example / purpose                                                                    |
| -------------------- | ------------------------------------------------------------------------------------ |
| `VNP_TMN_CODE`       | Terminal code (`vnp_TmnCode`) from the sandbox merchant registration                 |
| `VNP_HASH_SECRET`    | Hash secret used for HMAC-SHA512; never commit it or expose it to the frontend       |
| `VNP_URL`            | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`                                 |
| `VNP_RETURN_URL`     | `http://localhost:3000/api/payments/vnpay/return`                                    |
| `PAYMENT_RESULT_URL` | `http://localhost:5173/payment/result`; the only destination of the return redirect  |

Register for sandbox credentials at <https://sandbox.vnpayment.vn/devreg/>. The IPN URL is configured in the sandbox merchant portal, not in this application.

## Payment attempts

Each attempt is a row in `payment_transactions` (`db/init/06_payment_transactions.sql`, `db/migrations/006_payment_transactions.sql`):

- `txn_ref` is `<orderId>A<attempt>T<yyyyMMddHHmmss>` and unique.
- `amount` is in VNPay units (VND × 100), copied from the order total in the database; client input never sets it.
- `vnp_create_date` and `expires_at` (creation + 15 minutes) are stored so an unexpired attempt can be reused. Dates are formatted in `Asia/Ho_Chi_Minh` regardless of the server time zone.
- `status` is `PENDING`, `SUCCESS` or `FAILED`. IPN details (`vnp_TransactionNo`, bank code, response and transaction status, pay date) and the callback payload without signature fields are kept for reconciliation.

To avoid paying twice, `POST /api/payments/vnpay` locks the order row. If a `PENDING` attempt has at least one minute left, it rebuilds the same URL (same `txn_ref` and dates) instead of creating a new attempt. A new `txn_ref` is created only when no such attempt exists.

## Signature

The backend signs and verifies with HMAC-SHA512 over all `vnp_*` parameters except `vnp_SecureHash` and `vnp_SecureHashType`, sorted by key, with values encoded by `encodeURIComponent` and `%20` replaced by `+`, joined as `key=value&...`. Verification uses a constant-time comparison and ignores hex letter case.

## IPN response codes

The IPN always answers HTTP 200 with JSON. Checks run in this order inside one database transaction with row locks (order, then attempt), so repeated or concurrent notifications take effect once.

| RspCode | Message                 | When                                                                                    |
| ------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `97`    | Invalid Checksum        | Missing or wrong `vnp_SecureHash`                                                       |
| `01`    | Order not found         | No attempt with this `vnp_TxnRef`                                                       |
| `04`    | Invalid amount          | `vnp_Amount` differs from the stored attempt amount                                     |
| `02`    | Order already confirmed | The attempt is no longer `PENDING`, or the order is already `PAID`                      |
| `00`    | Confirm Success         | Recorded. `vnp_ResponseCode = 00` and `vnp_TransactionStatus = 00` → `PAID`, else `FAILED` |
| `99`    | Unknown error           | Unexpected failure or missing configuration; only a sanitized error code is logged      |

When an older attempt reports a payment after the order was already paid, the attempt is recorded, the IPN answers `02`, and a warning asks for a manual refund. A payment received for a cancelled order is recorded as `PAID` with the same warning.

## Testing

Unit tests (no database), from `backend`:

```bash
npm test
```

Integration tests need a disposable PostgreSQL database; they create and drop a random schema:

```bash
TEST_DATABASE_URL='postgresql://<user>:<password>@127.0.0.1:<port>/<test_db>' npm run test:integration
```

In PowerShell:

```powershell
$env:TEST_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:<port>/<test_db>"; npm run test:integration
```

### Local IPN simulation

VNPay Sandbox cannot call `localhost`. After creating a payment URL locally, send a correctly signed fake IPN to the running backend:

```bash
node scripts/simulate-vnpay-ipn.js <txn_ref> success
node scripts/simulate-vnpay-ipn.js <txn_ref> failed
```

The script reads the attempt amount from the configured database and the secret from `backend/.env`. Set `API_BASE_URL` if the backend is not at `http://localhost:3000`. Get `txn_ref` from `GET /api/payments/orders/:orderId` (`latest_transaction.txn_ref`).

### End-to-end with the real sandbox

1. Expose the backend, for example `ngrok http 3000`.
2. In the sandbox merchant portal, set the IPN URL to `https://<tunnel-host>/api/payments/vnpay/ipn`.
3. Set `VNP_RETURN_URL` to `https://<tunnel-host>/api/payments/vnpay/return` and restart the backend.
4. Pay with a test card listed on the [VNPay Sandbox](https://sandbox.vnpayment.vn/apis/vnpay-demo/) pages.

## Known limitations

- **No rate limit on `POST /api/payments/vnpay`.** The existing `createRateLimiter` in `backend/src/middleware/security.js` returns a message written for login attempts, so it was not reused here.
- **Refunds are manual.** There is no refund status or VNPay refund API call. Duplicate payments and payments for cancelled orders are only logged; an Admin can still cancel a paid `PENDING` order, which also needs a manual refund.
- **Return result is display only.** `result` in the redirect comes from the signed browser return; the authoritative state is the IPN-updated order.
- **`vnp_IpAddr`** uses `req.ip`. The app does not enable `trust proxy`, so behind a tunnel or proxy it is the proxy's address.
- **Scope.** Subscription checkout still supports COD only, and the storefront payment UI is not implemented yet.
