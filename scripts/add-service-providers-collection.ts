/**
 * Run this script once on an existing PocketBase instance to add the serviceProviders collection.
 * Usage: npx ts-node scripts/add-service-providers-collection.ts
 */
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');

async function main() {
  await pb.collection('_superusers').authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );
  console.log('Authenticated as admin.');

  await pb.collections.create({
    name: 'serviceProviders',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'serviceType', type: 'text', required: true },
      { name: 'residentId', type: 'text', required: true },
      { name: 'residentName', type: 'text', required: false },
      { name: 'apartment', type: 'text', required: false },
      { name: 'block', type: 'text', required: false },
      { name: 'accessDuration', type: 'text', required: false },
      { name: 'accessExpiry', type: 'text', required: false },
      { name: 'registrationToken', type: 'text', required: true },
      { name: 'tokenExpiry', type: 'text', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'photo', type: 'file', required: false },
      { name: 'hikvisionSyncStatus', type: 'json', required: false },
    ]
  });
  console.log('Collection "serviceProviders" created successfully!');
}

main().catch(err => { console.error(err.message); process.exit(1); });
