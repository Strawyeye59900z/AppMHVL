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
