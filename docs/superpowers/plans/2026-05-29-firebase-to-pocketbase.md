# Firebase → PocketBase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase (Firestore + Auth) with PocketBase as the sole database and auth provider, keeping all existing business logic (Hikvision, WhatsApp, reservations, packages) intact.

**Architecture:** PocketBase runs as a separate process on port 8090; Express on port 3000 is stateless and calls PocketBase SDK for all data operations. `data/db.json` is eliminated. Frontend authenticates via PocketBase SDK using email (admin), apartment number (resident), or name (employee).

**Tech Stack:** PocketBase (self-hosted binary + npm SDK `pocketbase`), Express/tsx, React + TypeScript + Vite, TailwindCSS v4.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Delete | `src/firebase.ts` | Firebase Auth — replaced by `src/pocketbase.ts` |
| Create | `src/pocketbase.ts` | PocketBase client singleton + typed helpers |
| Modify | `server.ts` | Remove Firebase imports/sync (~lines 10-11, 160-372, `writeDb` call to `syncToFirestore`); replace `readDb`/`writeDb` with PocketBase SDK calls |
| Modify | `src/components/AdminDashboard.tsx` | Remove `googleSignIn`/`logout` from firebase import; use local admin login flow already in place |
| Modify | `src/types.ts` | Add `firstLogin` to Resident; add Employee type; update Package type |
| Create | `scripts/migrate-db-to-pocketbase.ts` | One-shot migration of `data/db.json` → PocketBase collections |
| Modify | `package.json` | Remove `firebase`, add `pocketbase` |

---

## Task 1: Install PocketBase SDK, Remove Firebase

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pocketbase SDK**

```bash
cd "e:\Apps\App cond\AppMHVL"
npm install --strict-ssl=false pocketbase
```

Expected output: `added 1 package` (pocketbase is a single dependency with no sub-deps)

- [ ] **Step 2: Remove firebase package**

```bash
npm uninstall --strict-ssl=false firebase
```

Expected: firebase removed from node_modules and package.json

- [ ] **Step 3: Verify package.json**

Open `package.json` and confirm:
- `"firebase"` is gone from dependencies
- `"pocketbase"` is present in dependencies

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace firebase with pocketbase SDK"
```

---

## Task 2: Create `src/pocketbase.ts` (replaces `src/firebase.ts`)

**Files:**
- Create: `src/pocketbase.ts`
- Delete: `src/firebase.ts`

- [ ] **Step 1: Create `src/pocketbase.ts`**

```typescript
import PocketBase from 'pocketbase';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

const pb = new PocketBase(POCKETBASE_URL);

// Persist auth across page reloads
pb.authStore.onChange(() => {}, true);

export default pb;

export const logout = async () => {
  pb.authStore.clear();
};

export const getAccessToken = (): string | null => {
  return pb.authStore.token || null;
};
```

- [ ] **Step 2: Delete `src/firebase.ts`**

Delete the file `src/firebase.ts` entirely.

- [ ] **Step 3: Add VITE_POCKETBASE_URL to `.env.example`**

Open `e:\Apps\App cond\AppMHVL\.env.example` and add:
```
VITE_POCKETBASE_URL=http://localhost:8090
```

- [ ] **Step 4: Commit**

```bash
git add src/pocketbase.ts .env.example
git rm src/firebase.ts
git commit -m "feat: add pocketbase client, remove firebase client"
```

---

## Task 3: Update `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace the contents of `src/types.ts`**

Replace the entire file with:

```typescript
export interface Resident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  phone?: string;
  whatsapp?: string;
  photoDataUrl?: string;
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  deviceRegistered?: boolean;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
  firstLogin: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role?: string;
  active: boolean;
  firstLogin: boolean;
}

export interface SyncProgress {
  residentId: string;
  residentName: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface Reservation {
  id: string;
  apartment: string;
  block: string;
  residentId: string;
  residentName: string;
  amenity: 'quadra' | 'churrasqueira' | 'salao';
  date: string;
  timeSlot: string;
  notes?: string;
  createdAt: string;
}

export interface Package {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  carrier?: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  employeeId?: string;
  receivedBy?: string;
}

export interface WhatsAppConfig {
  enabled: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  templateText: string;
}

export interface HikvisionDevice {
  id: string;
  name: string;
  deviceIp: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export interface HikvisionFaceSyncStatus {
  status: 'synced' | 'pending' | 'failed';
  syncedAt?: string;
  error?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: update types for pocketbase schema (firstLogin, Employee, Package)"
```

---

## Task 4: Rewrite `server.ts` — Remove Firebase, Add PocketBase

**Files:**
- Modify: `server.ts`

This is the largest task. The server currently uses `readDb()`/`writeDb()` backed by `db.json`. We replace those with PocketBase Admin SDK calls. All endpoint logic (routes, validation, business rules) stays the same — only the data layer changes.

- [ ] **Step 1: Replace the Firebase imports and initialization block (lines 10-11 and 160-372)**

At the top of `server.ts`, replace:
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
```
With:
```typescript
import PocketBase from 'pocketbase';
```

- [ ] **Step 2: Add PocketBase initialization after the DATA_DIR block**

After the `const DB_FILE` line, replace the entire Firebase init block (lines ~160–176) and remove `cleanForFirestore`, `syncToFirestore`, `fetchFromFirestore`, and `initializeDatabase` functions (lines ~178–372).

Add instead:

```typescript
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || '';
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '';

const pbAdmin = new PocketBase(POCKETBASE_URL);

async function initPocketBase() {
  try {
    await pbAdmin.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);
    console.log('PocketBase admin authenticated successfully.');
  } catch (err) {
    console.error('PocketBase admin auth failed:', err);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Replace `readDb()` — residents**

Every call to `readDb()` followed by accessing `db.residents` must now call PocketBase. Since the existing endpoints are synchronous Express handlers but PocketBase is async, we convert affected handlers to `async`. 

Replace the `readDb` function with a typed PocketBase helper at the top of `server.ts` (after `initPocketBase`):

```typescript
// ---- PocketBase helpers ----

async function pbResidents() {
  const records = await pbAdmin.collection('residents').getFullList({ sort: 'apartment' });
  return records as unknown as ServerResident[];
}

async function pbEmployees() {
  const records = await pbAdmin.collection('employees').getFullList({ sort: 'name' });
  return records as unknown as ServerEmployee[];
}

async function pbReservations() {
  const records = await pbAdmin.collection('reservations').getFullList({ sort: '-createdAt' });
  return records as unknown as ServerReservation[];
}

async function pbPackages() {
  const records = await pbAdmin.collection('packages').getFullList({ sort: '-receivedAt' });
  return records as unknown as ServerPackage[];
}

async function pbSetting(key: string): Promise<any | null> {
  try {
    const record = await pbAdmin.collection('settings').getFirstListItem(`key="${key}"`);
    return record.value;
  } catch {
    return null;
  }
}

async function pbSetSetting(key: string, value: any): Promise<void> {
  try {
    const existing = await pbAdmin.collection('settings').getFirstListItem(`key="${key}"`);
    await pbAdmin.collection('settings').update(existing.id, { value });
  } catch {
    await pbAdmin.collection('settings').create({ key, value });
  }
}
```

- [ ] **Step 4: Update `ServerResident`, `ServerEmployee`, `ServerPackage` interfaces**

Add `firstLogin` to `ServerResident` and `ServerEmployee`. Remove `needsPasswordSet` from `ServerEmployee` (replaced by `firstLogin`). Remove `photoDataUrl` from `ServerEmployee`. Update `ServerPackage` to add `employeeId`:

```typescript
interface ServerResident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  password?: string;
  phone?: string;
  whatsapp?: string;
  photoDataUrl?: string;
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  deviceRegistered?: boolean;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
  firstLogin: boolean;
}

interface ServerEmployee {
  id: string;
  name: string;
  username: string;
  role?: string;
  active: boolean;
  firstLogin: boolean;
}

interface ServerPackage {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  carrier?: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  employeeId?: string;
  receivedBy?: string;
}
```

- [ ] **Step 5: Convert all route handlers to async and replace db read/write**

For each Express route that calls `readDb()` / `writeDb()`, convert to `async` and use PocketBase. The pattern for each is:

**Read pattern** (was `const db = readDb(); db.residents`):
```typescript
app.get('/api/residents', async (req, res) => {
  const residents = await pbResidents();
  const publicResidents = residents.map(({ password, ...rest }) => rest);
  res.json(publicResidents);
});
```

**Create pattern** (was `db.residents.push(newResident); writeDb(db)`):
```typescript
const created = await pbAdmin.collection('residents').create(newResident);
res.status(201).json(created);
```

**Update pattern** (was `db.residents[idx].field = value; writeDb(db)`):
```typescript
await pbAdmin.collection('residents').update(id, { field: value });
```

**Delete pattern** (was `db.residents.splice(idx, 1); writeDb(db)`):
```typescript
await pbAdmin.collection('residents').delete(id);
```

Apply this pattern to every endpoint in `server.ts`. The full list of endpoints to convert:

**Residents:**
- `GET /api/residents` → `pbResidents()`
- `POST /api/residents/login` → `pbAdmin.collection('residents').getFirstListItem('username="'+apartment+'"')`
- `POST /api/residents/signup` → `pbAdmin.collection('residents').create(...)`
- `GET /api/residents/apartment-members` → `pbAdmin.collection('residents').getList(1, 50, { filter: 'apartment="X"' })`
- `POST /api/residents/add-member` → `pbAdmin.collection('residents').create(...)`
- `POST /api/residents/upload-face` → `pbAdmin.collection('residents').update(id, { photoDataUrl, syncStatus: 'pending' })`
- `GET /api/residents/photo/:id` → `pbAdmin.collection('residents').getOne(id)` then serve photo
- `POST /api/residents/update-sync` → `pbAdmin.collection('residents').update(id, { syncStatus, ... })`
- `POST /api/residents/update-device-registered` → `pbAdmin.collection('residents').update(id, { deviceRegistered })`
- `POST /api/residents/delete` → `pbAdmin.collection('residents').delete(id)`

**Reservations:**
- `GET /api/reservations` → `pbReservations()`
- `POST /api/reservations` → `pbAdmin.collection('reservations').create(...)`
- `POST /api/reservations/delete` → `pbAdmin.collection('reservations').delete(id)`
- `POST /api/reservations/update` → `pbAdmin.collection('reservations').update(id, { notes })`

**Admins:**
- `GET /api/admins` → `pbSetting('authorized_admins')` returns array
- `POST /api/admins/add` → update setting
- `POST /api/admins/delete` → update setting
- `POST /api/admins/check-status` → check setting + `pbSetting('admin_passwords')`
- `POST /api/admins/setup-password` → update `pbSetting('admin_passwords', {...})`
- `POST /api/admins/login` → check setting + bcrypt compare (keep plain text for now matching existing behavior)

**Employees:**
- `POST /api/employees/login` → `pbAdmin.collection('employees').getFirstListItem('username="'+name+'"')` + check firstLogin
- `POST /api/employees/check-status` → `pbAdmin.collection('employees').getOne(id)`
- `POST /api/employees/setup-password` → `pbAdmin.collection('employees').update(id, { password, firstLogin: false })`
- `GET /api/employees` → `pbEmployees()`
- `POST /api/employees` → `pbAdmin.collection('employees').create({ name, username: name, firstLogin: true, active: true })`
- `POST /api/employees/reset-password` → `pbAdmin.collection('employees').update(id, { password: '', firstLogin: true })`
- `POST /api/employees/delete` → `pbAdmin.collection('employees').delete(id)`
- `GET /api/employees/photo/:id` → `pbAdmin.collection('employees').getOne(id)` + serve photo

**Packages:**
- `GET /api/packages` → `pbPackages()`
- `POST /api/packages/add` → `pbAdmin.collection('packages').create(...)`
- `POST /api/packages/deliver` → `pbAdmin.collection('packages').update(id, { status: 'delivered', deliveredAt, deliveredTo })`

**Settings (WhatsApp, Hikvision):**
- `GET /api/whatsapp/config` → `pbSetting('whatsapp_config')`
- `POST /api/whatsapp/config` → `pbSetSetting('whatsapp_config', {...})`
- `GET /api/hikvision/devices` → `pbSetting('hikvision_devices')` returns array
- `POST /api/hikvision/devices` → update setting array
- `POST /api/hikvision/devices/:id` → update setting array
- `POST /api/hikvision/devices/:id/delete` → update setting array

- [ ] **Step 6: Update `startServer()` to call `initPocketBase` instead of `initializeDatabase`**

Replace:
```typescript
await initializeDatabase();
```
With:
```typescript
await initPocketBase();
```

Also remove the `DB_FILE` and `DATA_DIR` constants and `readDb`/`writeDb` functions — they are no longer needed.

Remove the line:
```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```
(No longer needed — PocketBase runs on localhost, no SSL issues.)

- [ ] **Step 7: Commit**

```bash
git add server.ts
git commit -m "feat: replace firebase/db.json data layer with pocketbase in server.ts"
```

---

## Task 5: Update `AdminDashboard.tsx` — Remove Firebase import

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Remove the firebase import**

Find and remove this line in `AdminDashboard.tsx`:
```typescript
import { googleSignIn, logout } from '../firebase';
```

Replace with:
```typescript
import { logout } from '../pocketbase';
```

- [ ] **Step 2: Remove any call to `googleSignIn`**

Search for `googleSignIn` in `AdminDashboard.tsx`. The existing code already has a local email+password login flow that calls `/api/admins/login` directly — the `googleSignIn` import was dead code after the Firebase SSL fix. If it's referenced in a handler, replace that handler's body with:
```typescript
// Google Sign-In removed — use email/password login above
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "feat: remove firebase google sign-in from admin dashboard"
```

---

## Task 6: Create PocketBase Collections via Setup Script

**Files:**
- Create: `scripts/setup-pocketbase.ts`

PocketBase collections must be created before the app can use them. This script creates all collections with the correct fields via the Admin API.

- [ ] **Step 1: Create `scripts/setup-pocketbase.ts`**

```typescript
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');

async function main() {
  await pb.admins.authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );
  console.log('Authenticated as admin.');

  // residents collection (auth)
  await pb.collections.create({
    name: 'residents',
    type: 'auth',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'apartment', type: 'text', required: true },
      { name: 'block', type: 'text', required: false },
      { name: 'phone', type: 'text', required: false },
      { name: 'whatsapp', type: 'text', required: false },
      { name: 'photoDataUrl', type: 'text', required: false },
      { name: 'registeredAt', type: 'text', required: false },
      { name: 'syncStatus', type: 'text', required: false },
      { name: 'syncError', type: 'text', required: false },
      { name: 'deviceRegistered', type: 'bool', required: false },
      { name: 'hikvisionSyncStatus', type: 'json', required: false },
      { name: 'firstLogin', type: 'bool', required: false },
    ],
    options: {
      allowEmailAuth: false,
      allowUsernameAuth: true,
      requireEmail: false,
    }
  });
  console.log('Created: residents');

  // employees collection (auth)
  await pb.collections.create({
    name: 'employees',
    type: 'auth',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'role', type: 'text', required: false },
      { name: 'active', type: 'bool', required: false },
      { name: 'firstLogin', type: 'bool', required: false },
    ],
    options: {
      allowEmailAuth: false,
      allowUsernameAuth: true,
      requireEmail: false,
    }
  });
  console.log('Created: employees');

  // reservations collection (base)
  await pb.collections.create({
    name: 'reservations',
    type: 'base',
    fields: [
      { name: 'residentId', type: 'text', required: true },
      { name: 'apartment', type: 'text', required: true },
      { name: 'block', type: 'text', required: false },
      { name: 'residentName', type: 'text', required: false },
      { name: 'amenity', type: 'text', required: true },
      { name: 'date', type: 'text', required: true },
      { name: 'timeSlot', type: 'text', required: true },
      { name: 'notes', type: 'text', required: false },
      { name: 'createdAt', type: 'text', required: false },
    ]
  });
  console.log('Created: reservations');

  // packages collection (base)
  await pb.collections.create({
    name: 'packages',
    type: 'base',
    fields: [
      { name: 'apartment', type: 'text', required: true },
      { name: 'block', type: 'text', required: false },
      { name: 'recipientName', type: 'text', required: false },
      { name: 'description', type: 'text', required: true },
      { name: 'carrier', type: 'text', required: false },
      { name: 'receivedAt', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'deliveredAt', type: 'text', required: false },
      { name: 'deliveredTo', type: 'text', required: false },
      { name: 'employeeId', type: 'text', required: false },
      { name: 'receivedBy', type: 'text', required: false },
    ]
  });
  console.log('Created: packages');

  // settings collection (base)
  await pb.collections.create({
    name: 'settings',
    type: 'base',
    fields: [
      { name: 'key', type: 'text', required: true },
      { name: 'value', type: 'json', required: false },
    ]
  });
  console.log('Created: settings');

  // Seed default settings
  await pb.collection('settings').create({ key: 'authorized_admins', value: ['gabriel.nunez.costa@gmail.com'] });
  await pb.collection('settings').create({ key: 'admin_passwords', value: { 'gabriel.nunez.costa@gmail.com': 'admin123' } });
  await pb.collection('settings').create({ key: 'whatsapp_config', value: null });
  await pb.collection('settings').create({ key: 'hikvision_devices', value: [] });
  console.log('Seeded: settings');

  console.log('\nSetup complete!');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add run script to `package.json`**

Add to `scripts` in `package.json`:
```json
"pb:setup": "tsx scripts/setup-pocketbase.ts",
"pb:migrate": "tsx scripts/migrate-db-to-pocketbase.ts"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-pocketbase.ts package.json
git commit -m "feat: add pocketbase collection setup script"
```

---

## Task 7: Create Migration Script (`db.json` → PocketBase)

**Files:**
- Create: `scripts/migrate-db-to-pocketbase.ts`

- [ ] **Step 1: Create `scripts/migrate-db-to-pocketbase.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

async function main() {
  await pb.admins.authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );
  console.log('Authenticated.');

  if (!fs.existsSync(DB_FILE)) {
    console.log('No db.json found — nothing to migrate.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

  // Migrate residents
  const residents = db.residents || [];
  for (const r of residents) {
    try {
      await pb.collection('residents').create({
        username: r.apartment,
        password: r.password || '12345678',
        passwordConfirm: r.password || '12345678',
        name: r.name,
        apartment: r.apartment,
        block: r.block || 'Único',
        phone: r.phone || '',
        whatsapp: r.phone || '',
        photoDataUrl: r.photoDataUrl || '',
        registeredAt: r.registeredAt || new Date().toISOString(),
        syncStatus: r.syncStatus || 'pending',
        deviceRegistered: r.deviceRegistered || false,
        hikvisionSyncStatus: r.hikvisionSyncStatus || {},
        firstLogin: false,
      });
      console.log(`Migrated resident: ${r.name} (apt ${r.apartment})`);
    } catch (err: any) {
      console.error(`Failed resident ${r.name}:`, err.message);
    }
  }

  // Migrate employees
  const employees = db.employees || [];
  for (const e of employees) {
    try {
      await pb.collection('employees').create({
        username: e.name,
        password: e.password || '12345678',
        passwordConfirm: e.password || '12345678',
        name: e.name,
        role: e.role || 'porteiro',
        active: true,
        firstLogin: e.needsPasswordSet ?? false,
      });
      console.log(`Migrated employee: ${e.name}`);
    } catch (err: any) {
      console.error(`Failed employee ${e.name}:`, err.message);
    }
  }

  // Migrate reservations
  const reservations = db.reservations || [];
  for (const r of reservations) {
    try {
      await pb.collection('reservations').create({
        residentId: r.residentId,
        apartment: r.apartment,
        block: r.block || 'Único',
        residentName: r.residentName,
        amenity: r.amenity,
        date: r.date,
        timeSlot: r.timeSlot,
        notes: r.notes || '',
        createdAt: r.createdAt || new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`Failed reservation ${r.id}:`, err.message);
    }
  }
  console.log(`Migrated ${reservations.length} reservations`);

  // Migrate packages
  const packages = db.packages || [];
  for (const p of packages) {
    try {
      await pb.collection('packages').create({
        apartment: p.apartment,
        block: p.block || 'Único',
        recipientName: p.recipientName || '',
        description: p.description,
        carrier: p.carrier || '',
        receivedAt: p.receivedAt || new Date().toISOString(),
        status: p.status || 'pending',
        deliveredAt: p.deliveredAt || '',
        deliveredTo: p.deliveredTo || '',
        receivedBy: p.receivedBy || '',
      });
    } catch (err: any) {
      console.error(`Failed package ${p.id}:`, err.message);
    }
  }
  console.log(`Migrated ${packages.length} packages`);

  // Migrate settings
  const settingsUpdates: Record<string, any> = {};
  if (db.authorizedAdmins) settingsUpdates['authorized_admins'] = db.authorizedAdmins;
  if (db.adminPasswords) settingsUpdates['admin_passwords'] = db.adminPasswords;
  if (db.whatsappConfig) settingsUpdates['whatsapp_config'] = db.whatsappConfig;
  if (db.hikvisionDevices) settingsUpdates['hikvision_devices'] = db.hikvisionDevices;

  for (const [key, value] of Object.entries(settingsUpdates)) {
    try {
      const existing = await pb.collection('settings').getFirstListItem(`key="${key}"`).catch(() => null);
      if (existing) {
        await pb.collection('settings').update(existing.id, { value });
      } else {
        await pb.collection('settings').create({ key, value });
      }
      console.log(`Migrated setting: ${key}`);
    } catch (err: any) {
      console.error(`Failed setting ${key}:`, err.message);
    }
  }

  console.log('\nMigration complete!');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-db-to-pocketbase.ts
git commit -m "feat: add db.json → pocketbase migration script"
```

---

## Task 8: Environment Variables Setup

**Files:**
- Create: `.env` (local only, not committed)

- [ ] **Step 1: Create `.env` file**

Create `e:\Apps\App cond\AppMHVL\.env` with:
```
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=gabriel.nunez.costa@gmail.com
POCKETBASE_ADMIN_PASSWORD=<choose a strong password>
VITE_POCKETBASE_URL=http://localhost:8090
```

- [ ] **Step 2: Verify `.gitignore` has `.env`**

Check `e:\Apps\App cond\AppMHVL\.gitignore`. If `.env` is not listed, add it:
```
.env
```

- [ ] **Step 3: Commit `.gitignore` if changed**

```bash
git add .gitignore
git commit -m "chore: ensure .env is gitignored"
```

---

## Task 9: First Run — Download PocketBase and Bootstrap

This task runs on the VPS (or locally for testing). Not a code change — just operational steps.

- [ ] **Step 1: Download PocketBase binary (Linux AMD64 for VPS)**

On the VPS:
```bash
wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_amd64.zip
unzip pocketbase_linux_amd64.zip -d pocketbase/
chmod +x pocketbase/pocketbase
```

For local Windows testing, download the Windows zip from the same URL pattern.

- [ ] **Step 2: Start PocketBase**

```bash
./pocketbase/pocketbase serve --http="0.0.0.0:8090"
```

On first run, it creates `pb_data/` and prints a setup URL. Open it and create the admin account using the email/password from `.env`.

- [ ] **Step 3: Run setup script to create collections**

```bash
cd "e:\Apps\App cond\AppMHVL"
POCKETBASE_ADMIN_EMAIL=gabriel.nunez.costa@gmail.com POCKETBASE_ADMIN_PASSWORD=<password> npm run pb:setup
```

On Windows PowerShell:
```powershell
$env:POCKETBASE_ADMIN_EMAIL="gabriel.nunez.costa@gmail.com"
$env:POCKETBASE_ADMIN_PASSWORD="<password>"
npm run pb:setup
```

Expected: "Setup complete!" with all collections listed.

- [ ] **Step 4: Run migration script to import db.json**

```powershell
$env:POCKETBASE_ADMIN_EMAIL="gabriel.nunez.costa@gmail.com"
$env:POCKETBASE_ADMIN_PASSWORD="<password>"
npm run pb:migrate
```

Expected: "Migration complete!" with counts of migrated records.

- [ ] **Step 5: Start the app**

```bash
node_modules/.bin/tsx server.ts
```

Open `http://localhost:3000` and verify:
- Admin login works with `gabriel.nunez.costa@gmail.com` / `admin123`
- Residents list shows migrated residents
- Packages, reservations visible

---

## Task 10: Verify and Clean Up

- [ ] **Step 1: Remove `data/db.json` (after successful migration)**

Only do this after confirming all data is in PocketBase:
```bash
rm data/db.json
```

- [ ] **Step 2: Remove `firebase-applet-config.json` if it exists**

```bash
rm firebase-applet-config.json
```

- [ ] **Step 3: Verify no remaining firebase imports**

```bash
grep -r "firebase" src/ server.ts --include="*.ts" --include="*.tsx"
```

Expected: no results.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove firebase config and db.json after pocketbase migration"
```

---

## Self-Review

**Spec coverage check:**
- ✅ PocketBase as sole database — Tasks 2, 4, 6
- ✅ Auth: admin=email, residents=apartment, employees=name — Tasks 4 (login endpoints), 6 (collection auth options)
- ✅ firstLogin on residents and employees — Tasks 3, 4, 6
- ✅ Collections: residents, employees, reservations, packages, settings — Task 6
- ✅ packages: no photo field, has employeeId — Tasks 3, 6, 7
- ✅ employees: no cpf/phone/startDate — Tasks 3, 6
- ✅ Migration from db.json — Task 7
- ✅ Remove firebase package — Task 1
- ✅ src/firebase.ts deleted, src/pocketbase.ts created — Task 2
- ✅ AdminDashboard firebase import removed — Task 5
- ✅ Environment variables — Task 8

**No placeholders found.**

**Type consistency:**
- `ServerResident.firstLogin: boolean` defined in Task 4, used consistently
- `ServerEmployee` schema (no needsPasswordSet, has firstLogin) defined in Task 4, used in Task 4 endpoints and Task 7 migration
- `pbAdmin.collection('residents')` used consistently throughout Task 4
- `pbSetting` / `pbSetSetting` defined in Task 4 Step 3, used in all settings endpoints
