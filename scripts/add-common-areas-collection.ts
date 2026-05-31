/**
 * Script de migração: cria a collection 'commonAreas' no PocketBase
 * e semente as 3 áreas padrão do condomínio.
 *
 * Uso:
 *   npx ts-node scripts/add-common-areas-collection.ts
 *
 * Requer as variáveis de ambiente (ou valores padrão abaixo):
 *   POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 */

import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '';

const DEFAULT_AREAS = [
  {
    name: 'Quadra de Esportes',
    slug: 'quadra',
    description: 'Quadra poliesportiva coberta',
    icon: 'Trophy',
    color: 'amber',
    active: true,
    maxPerDayPerApt: 4,
    slots: [
      '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
      '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
      '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
      '20:00 - 21:00', '21:00 - 22:00',
    ],
  },
  {
    name: 'Churrasqueira Coberta',
    slug: 'churrasqueira',
    description: 'Churrasqueira com área gourmet',
    icon: 'Flame',
    color: 'orange',
    active: true,
    maxPerDayPerApt: 1,
    slots: ['Dia Inteiro'],
  },
  {
    name: 'Salão de Festas',
    slug: 'salao',
    description: 'Salão para eventos e confraternizações',
    icon: 'Sparkles',
    color: 'purple',
    active: true,
    maxPerDayPerApt: 1,
    slots: ['Dia Inteiro'],
  },
];

async function run() {
  const pb = new PocketBase(POCKETBASE_URL);

  console.log(`Conectando ao PocketBase em ${POCKETBASE_URL}...`);
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Autenticado como admin.');

  // 1. Verifica se a collection já existe
  let collectionExists = false;
  try {
    await pb.collections.getOne('commonAreas');
    collectionExists = true;
    console.log('Collection "commonAreas" já existe. Pulando criação.');
  } catch {
    collectionExists = false;
  }

  // 2. Cria a collection se não existir
  if (!collectionExists) {
    console.log('Criando collection "commonAreas"...');
    await pb.collections.create({
      name: 'commonAreas',
      type: 'base',
      fields: [
        { name: 'name',           type: 'text',   required: true },
        { name: 'slug',           type: 'text',   required: true },
        { name: 'description',    type: 'text',   required: false },
        { name: 'icon',           type: 'text',   required: false },
        { name: 'color',          type: 'text',   required: false },
        { name: 'slots',          type: 'json',   required: false },
        { name: 'maxPerDayPerApt',type: 'number', required: false },
        { name: 'active',         type: 'bool',   required: false },
        { name: 'createdAt',      type: 'text',   required: false },
      ],
    });
    console.log('Collection "commonAreas" criada com sucesso!');
  }

  // 3. Verifica se já tem registros
  const existing = await pb.collection('commonAreas').getFullList();
  if (existing.length > 0) {
    console.log(`Já existem ${existing.length} área(s) cadastrada(s). Pulando semente.`);
  } else {
    console.log('Inserindo áreas padrão...');
    for (const area of DEFAULT_AREAS) {
      await pb.collection('commonAreas').create({
        ...area,
        createdAt: new Date().toISOString(),
      });
      console.log(`  ✓ ${area.name}`);
    }
    console.log('Áreas padrão inseridas com sucesso!');
  }

  console.log('\nMigração concluída.');
}

run().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
