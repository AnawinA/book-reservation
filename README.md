# Book Borrowing System

A server-side web application for a network of book shops: customers donate books for points, owners lend and accept returns, and points are redeemed for shop rewards. Built for the KMITL Server-Side Web Development course (Units 1-14).

Node.js 20+, CommonJS, Express 4, MySQL 8 (`mysql2/promise`), EJS, JWT in an HttpOnly cookie, bcrypt, helmet, express-rate-limit, Jest + Supertest.

## Architecture

```
Request
  -> app.js (createApp: helmet, body parsers, cookie, static, health)
     -> routes/index.js
        -> middlewares/authMiddleware.js   attachUser (JWT cookie -> req.user)
        -> routes/authRoutes.js            /api/auth/*
        -> routes/customerRoutes.js        /api/customer/*        + /customer/dashboard
        -> routes/ownerShopRoutes.js       /api/shops/:id/*, /api/book-items/* + /shop/dashboard
        -> routes/adminRoutes.js           /api/admin/*           + /admin/dashboard
        -> routes/publicRoutes.js          / and /api/{shops,books,campaigns,rewards}
           -> controllers/*.js             thin: validate -> model -> response
              -> models/*.js               ALL SQL, parameterized, soft-delete aware
                 -> configs/db.js          pool + withTransaction (TCL + FOR UPDATE)
     -> middlewares/errorMiddleware.js     JSON or EJS error contract

utils/validators.js  pure validation + ISBN checksums
utils/pagination.js  page/limit parsing + meta
configs/jwt.js       access tokens + reward vouchers
views/               EJS pages (no inline scripts: helmet CSP)
public/              css + one JS file per page
```

Request flow for a page: EJS renders with its first data already in place, so the dashboard works without JavaScript. The page script in `/public/js` then calls the REST API for mutations and sends the HttpOnly cookie automatically (`credentials: 'same-origin'`).

## Architectural decisions

| ADR | Decision | Trade-off |
|---|---|---|
| **1. Shop ownership** | `users.shop_id` (nullable FK to `shops.id`) links an OwnerShop account to its shop; RBAC checks `req.user.shopId === :shopId` via `requireOwnShop` | The only schema addition; without it any owner could manage any shop |
| **2. Reward claim code** | Redemption issues a signed HS256 JWT voucher (`REWARD_CODE_SECRET`, `REWARD_CODE_TTL` = 72h, payload `typ/uid/rid/sid` + `jti`) instead of storing redemptions | A voucher can be claimed more than once while it is valid. The fix is a seventh `reward_redemptions` table with a unique `(voucher_id)` column |
| **3. Transactions** | `withTransaction(fn)` in `configs/db.js` sends literal `START TRANSACTION` / `COMMIT` / `ROLLBACK` and locks rows with `SELECT ... FOR UPDATE`; models own the transaction | Controllers stay thin; multi-table logic is unit-testable with a mocked connection |
| **4. Test isolation** | `app.js` (app factory) is separate from `index.js` (listener). Integration tests use Supertest with mocked models; unit tests mock `configs/db` | `npm test` needs no database; the real schema is verified by the Docker smoke test |

**Known limitation (ADR-2):** a reward voucher is a bearer token, so the same code can be presented more than once inside its 72-hour window. Introducing a `reward_redemptions` table (voucher `jti` unique, claimed_at) is the documented future fix.

## Quick start (Docker)

```bash
cp .env.example .env          # then set the two secrets
docker compose up --build
```

* App: http://localhost:3000 (`docker compose port app 3000` prints the actual host port; a `PORT` exported in your shell overrides it)
* MySQL: `localhost:3307` (container `bbs-db`)
* The `app` service waits for the `db` healthcheck, then runs `scripts/seed.js` when `SEED_ON_START=true`.

Then:

```bash
docker exec -it bbs-db mysql -u root -p book_borrowing -e "SHOW TABLES; SELECT username, role FROM users;"
```

## UI and theming

The interface is server-rendered EJS with a small design system in `public/css/styles.css`: a warm "library paper" light palette and a deep "after hours" dark palette, both driven by CSS custom properties. Typography pairs a serif display face for headings with a system sans for text, so there are no webfont requests.

`public/js/theme.js` is loaded synchronously in `<head>`, applies the saved theme (`localStorage` key `bbs-theme`) before first paint so there is no flash of the wrong palette, falls back to `prefers-color-scheme`, and listens for OS changes until the user picks a theme explicitly. The header toggle (`#themeToggle`) updates `data-theme` on `<html>`, `aria-pressed` and its own label. Because helmet's CSP blocks inline scripts, the toggle is a normal external script plus a button.

## Local development

```bash
cp .env.example .env
# point DB_HOST at 127.0.0.1 and DB_PORT at 3307 if MySQL runs in Docker
npm install
npm run seed
npm run dev            # nodemon
```

Health check: `curl http://localhost:3000/api/health` -> `{ "success": true, "data": { "db": "up", ... } }`

## npm scripts

| Script | What it does |
|---|---|
| `npm start` | Start the server (`node index.js`) |
| `npm run dev` | Start with nodemon |
| `npm run seed` | Run the idempotent seeder |
| `npm test` | Jest, 159 tests, no database needed |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Supertest integration tests only |
| `npm run test:coverage` | Coverage with the thresholds in `jest.config.js` |
| `npm run test:ui` | Browser smoke check against a running server (see below) |

## Seeded accounts

All seeded accounts use `SEED_DEFAULT_PASSWORD` (default `Passw0rd!`). Admin and OwnerShop accounts come from the seeder only; public registration always creates a Customer.

| Username | Phone | Role | Shop | Points |
|---|---|---|---|---|
| `admin` | 0800000001 | Admin | - | 0 |
| `owner_ladkrabang` | 0800000002 | OwnerShop | KMITL Library Corner | 0 |
| `owner_siam` | 0800000003 | OwnerShop | Siam Book Hub | 0 |
| `alice` | 0811111111 | Customer | - | 120 |
| `bob` | 0822222222 | Customer | - | 5 |

## Endpoints

Legend: A = authenticated (any role), C = Customer, O = OwnerShop (own shop), Ad = Admin.

| Method | Path | Role | Success | Main errors |
|---|---|---|---|---|
| GET | `/` | public | 200 HTML | - |
| GET | `/api/health` | public | 200 | 500 (db down) |
| POST | `/api/auth/register` | public | 201 | 400, 409, 429 |
| POST | `/api/auth/login` | public | 200 + cookie | 400, 401, 429 |
| POST | `/api/auth/logout` | public | 200 | - |
| GET | `/api/shops` | public | 200 | - |
| GET | `/api/books` | public | 200 + meta | 400 |
| GET | `/api/books/:isbn` | public | 200 | 400, 404 |
| GET | `/api/campaigns` | public | 200 | 400 |
| GET | `/api/rewards` | public | 200 | 400 |
| GET | `/customer/dashboard` | C | 200 HTML | 302, 403 |
| GET | `/api/customer/profile` | C | 200 | 401, 403, 404 |
| GET | `/api/customer/donations` | C | 200 | 401, 403 |
| GET | `/api/customer/borrows` | C | 200 | 401, 403 |
| POST | `/api/customer/rewards/:rewardId/redeem` | C | 201 + `redemptionCode` | 400, 401, 403, 404, 409 |
| GET | `/shop/dashboard` | O | 200 HTML | 302, 403 |
| GET | `/api/shops/:shopId/inventory` | O | 200 + meta | 400, 401, 403 |
| GET | `/api/book-items/:barcode` | O | 200 | 400, 401, 403, 404 |
| POST | `/api/shops/:shopId/donations` | O | 201 | 400, 401, 403, 404, 409 |
| POST | `/api/shops/:shopId/borrows` | O | 201 | 400, 401, 403, 404, 409 |
| POST | `/api/shops/:shopId/returns` | O | 200 (+ `wasOverdue`) | 400, 401, 403, 404, 409 |
| PATCH | `/api/book-items/:barcode/status` | O | 200 | 400, 401, 403, 404, 409 |
| PATCH | `/api/shops/:shopId/rewards/claim` | O | 200 | 400, 401, 403, 404 |
| GET | `/admin/dashboard` | Ad | 200 HTML | 302, 403 |
| POST | `/api/admin/shops` | Ad | 201 | 400, 401, 403, 409 |
| PUT | `/api/admin/shops/:shopId` | Ad | 200 | 400, 401, 403, 404, 409 |
| DELETE | `/api/admin/shops/:shopId` | Ad | 204 | 400, 401, 403, 404, 409 |
| POST | `/api/admin/books` | Ad | 201 | 400, 401, 403, 409 |
| PUT | `/api/admin/books/:collectionId` | Ad | 200 | 400, 401, 403, 404, 409 |
| POST | `/api/admin/campaigns` | Ad | 201 | 400, 401, 403 |
| PUT | `/api/admin/campaigns/:campaignId` | Ad | 200 | 400, 401, 403, 404 |
| POST | `/api/admin/rewards` | Ad | 201 | 400, 401, 403 |
| PUT | `/api/admin/rewards/:rewardId` | Ad | 200 | 400, 401, 403, 404 |
| GET | `/api/admin/reports/overdue` | Ad | 200 + meta | 401, 403 |

Response contract:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "field": "isbn", "message": "..." } ] } }
```

## Example curl session

```bash
# catalog
curl -s http://localhost:3000/api/books?q=code

# login as alice and keep the HttpOnly cookie
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"Passw0rd!"}'

# profile and borrows
curl -s -b cookies.txt http://localhost:3000/api/customer/profile
curl -s -b cookies.txt http://localhost:3000/api/customer/borrows

# redeem the Coffee Voucher (30 points) and claim it at the shop counter
CODE=$(curl -s -b cookies.txt -X POST http://localhost:3000/api/customer/rewards/1/redeem \
  -H 'Content-Type: application/json' -d '{}' | sed -E 's/.*"redemptionCode":"([^"]+)".*/\1/')

curl -s -c owner.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner_ladkrabang","password":"Passw0rd!"}'

curl -s -b owner.txt -X PATCH http://localhost:3000/api/shops/1/rewards/claim \
  -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}"

# donate a book (10 base + 20 campaign bonus), lend it, then return it
curl -s -b owner.txt -X POST http://localhost:3000/api/shops/1/donations \
  -H 'Content-Type: application/json' \
  -d '{"donorPhone":"0822222222","isbn":"9780132350884"}'

curl -s -b owner.txt -X POST http://localhost:3000/api/shops/1/borrows \
  -H 'Content-Type: application/json' \
  -d '{"barcode":"BK-0001","borrowerPhone":"0811111111","durationDays":14}'

curl -s -b owner.txt -X POST http://localhost:3000/api/shops/1/returns \
  -H 'Content-Type: application/json' -d '{"barcode":"BK-0001"}'

# admin
curl -s -c admin.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"Passw0rd!"}'
curl -s -b admin.txt http://localhost:3000/api/admin/reports/overdue
curl -s -b admin.txt -X DELETE http://localhost:3000/api/admin/shops/3 -i
```

## Testing

`npm test` runs 159 tests (101 unit, 58 integration) with no database and no network access. `npm run test:coverage` reports 94% lines / 91% statements / 92% functions / 74% branches, above the thresholds in `jest.config.js`.

| Layer | File | Tests | Focus |
|---|---|---|---|
| Unit | `validators.test.js` | 23 | password 7/8/72/73, username 2/3/30/31, phone, ISBN-10/13 checksums, barcode, durationDays, pagination, status enum, composed validators |
| Unit | `jwt.test.js` | 5 | sign/verify, tampered, expired, wrong `typ`, cookie options |
| Unit | `authMiddleware.test.js` | 8 | 401, 403, 302, 403 page, shop scope, invalid id, cookie clearing |
| Unit | `errorMiddleware.test.js` | 6 | AppError, ER_DUP_ENTRY, JSON parse, hidden 500, HTML render |
| Unit | `db.test.js` | 3 | COMMIT order, ROLLBACK on throw, release always called |
| Unit | `userModel.test.js` | 4 | conflicts, create, addPoints 404, no hash in public columns |
| Unit | `rewardModel.test.js` | 5 | redeem success, user/reward 404, out of stock, insufficient points + ROLLBACK |
| Unit | `bookItemModel.test.js` | 10 | donate with/without campaign, donor 404, borrow success/unavailable/wrong shop/limit, return, invalid transition |
| Unit | `modelQueries.test.js` | 24 | shop/book/campaign/reward/item read and write functions, soft-delete predicates, LIMIT/OFFSET |
| Unit | `branches.test.js` | 13 | env parsing and production guard, error mapping, auth edge cases, validator edges |
| Integration | `auth.test.js` | 9 | register 201/400/409, no escalation, login cookie flags, no token in body, 401, timing-safe compare, logout |
| Integration | `public.test.js` | 6 | shops, paging, limit=101, ISBN 200/400/404 |
| Integration | `customer.test.js` | 8 | 401, 403, profile, borrows meta, redeem 201/400/404/409 |
| Integration | `ownerShop.test.js` | 10 | foreign shop 403, inventory, donation, borrow 201/409, return, status 200/409, claim 200/400 |
| Integration | `admin.test.js` | 6 | create 201, invalid 400, update 404, delete 204/409, overdue report |
| Integration | `content.test.js` | 15 | campaigns/rewards filters, inventory filter, book/campaign/reward CRUD, all three dashboards |
| Integration | `pages.test.js` | 3 | catalog HTML, 302 redirect, 403 page for a wrong role |
| Integration | `health.test.js` | 1 | `/api/health` host details |

### UI smoke check

`npm run test:ui` drives the Chrome/Edge already installed on the machine through `playwright-core` (no browser download) and visits 4 pages × 2 themes × 2 viewports = 16 combinations. Each visit fails on: HTTP error status, a missing `.site-nav`, a theme that did not apply, and horizontal overflow — both `document.scrollWidth > innerWidth` and any element sticking past the viewport that is not inside a scroll container.

```bash
SMOKE_BASE_URL=http://localhost:32773 npm run test:ui   # defaults to http://localhost:3000
```

It logs in once per role and reuses the cookie, so it stays under the auth rate limit. Set `SMOKE_BROWSER` to a Chromium executable path or channel (for example `msedge`) if auto-detection fails.

Docker smoke test (real database):

```bash
docker compose down -v && docker compose up --build
# seeded data is visible, all three dashboards render, /api/health reports db "up"
```

## Security notes

* **XSS:** EJS escapes every dynamic value (`<%= %>`); helmet's default CSP blocks inline scripts, so all client code lives in `/public/js`.
* **CSRF:** the session cookie is `HttpOnly`, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=true`; the API only reads the cookie, never an `Authorization` header.
* **Passwords:** bcrypt with `BCRYPT_ROUNDS`; the hash never leaves the model layer, and login compares against a dummy hash for unknown users to keep timing flat.
* **SQL injection:** only parameterized `?` placeholders; the single dynamic exception is `LIMIT/OFFSET`, which is parsed to integers before interpolation.
* **Authorization:** `authenticate*` (401/302), `authorize*` (403), and `requireOwnShop` verify `req.user.shopId` server-side. Registration always creates a Customer, so a `role` field in the body cannot escalate.
* **Rate limiting:** 20 requests per 15 minutes per IP on register/login.
* **Audit trail:** production server errors are appended to `logs/error.log`; soft deletes keep every row recoverable.

## Course unit traceability

| Unit | Requirement | Delivered in |
|---|---|---|
| 1 & 4 | Express, Node core modules, npm scripts | `app.js`, `index.js` (`fs` logs dir, `os` health, `path` views), `errorMiddleware` (`fs` log), `package.json` |
| 2 | Git hygiene | `.gitignore`, `.dockerignore`, ADRs above |
| 3 | Docker | `Dockerfile` (non-root, HEALTHCHECK), `docker-compose.yml` (healthcheck, `service_healthy`, `db_data`) |
| 6 & 7 | dotenv, soft delete, DDL/DML, FK, joins, aggregates, TCL | `configs/env.js`, `db/init.sql`, `db/sample-queries.sql`, `models/*` + `withTransaction` |
| 8 | `mysql2/promise` pool | `configs/db.js` |
| 9 | Endpoints and status codes | `routes/*`, `controllers/*`, error contract |
| 10 & 11 | Jest/Supertest 60/40, positive/negative/boundary | `tests/unit`, `tests/integration` |
| 12 | MVC structure | full directory layout |
| 13 & 14 | JWT in HttpOnly cookie, RBAC, bcrypt | `configs/jwt.js`, `middlewares/authMiddleware.js`, `controllers/authController.js` |
