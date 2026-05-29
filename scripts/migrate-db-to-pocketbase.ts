import fs from 'fs';
import path from 'path';
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

async function main() {
  await pb.collection('_superusers').authWithPassword(
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
        employeeId: p.employeeId || '',
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
