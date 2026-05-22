/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

// Ensure the data directories exist
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'db.json');

// Interface representation on the server
interface ServerResident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  password?: string;
  phone?: string; // Optional resident phone number for WhatsApp alerts
  photoDataUrl?: string; // stored base64 image data url
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  driveFileId?: string;
  deviceRegistered?: boolean;
}

interface ServerReservation {
  id: string;
  apartment: string;
  block: string;
  residentId: string;
  residentName: string;
  amenity: 'quadra' | 'churrasqueira' | 'salao';
  date: string; // YYYY-MM-DD
  timeSlot: string;
  notes?: string;
  createdAt: string;
}

interface DriveConfig {
  sharedAccessToken?: string;
  sharedFolderId?: string;
  sharedAdminEmail?: string;
  tokenExpiresAt?: string;
}

interface DbSchema {
  residents: ServerResident[];
  reservations: ServerReservation[];
  authorizedAdmins?: string[];
  driveConfig?: DriveConfig;
  adminPasswords?: { [email: string]: string };
  employees?: ServerEmployee[];
  packages?: ServerPackage[];
  conciergePassword?: string;
}

interface ServerEmployee {
  id: string;
  name: string;
  password?: string;
  needsPasswordSet?: boolean;
  photoDataUrl?: string; // stored base64 image data url
}

interface ServerPackage {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  receivedBy?: string; // Name of the employee who checked in the package
}

// Database helper functions
function readDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        residents: parsed.residents || [],
        reservations: parsed.reservations || [],
        authorizedAdmins: parsed.authorizedAdmins || ['gabriel.nunez.costa@gmail.com'],
        driveConfig: parsed.driveConfig || {},
        adminPasswords: parsed.adminPasswords || {},
        employees: (parsed.employees || [{ id: 'emp_1', name: 'Porteiro Principal', password: '1234', needsPasswordSet: false }]).map((e: any) => ({
          ...e,
          password: e.password || e.pin // Migrate pin to password if needed
        })),
        packages: parsed.packages || []
      };
    }
  } catch (error) {
    console.error('Error reading database:', error);
  }
  return { 
    residents: [], 
    reservations: [], 
    authorizedAdmins: ['gabriel.nunez.costa@gmail.com'],
    driveConfig: {},
    adminPasswords: {},
    employees: [{ id: 'emp_1', name: 'Porteiro Principal', password: '1234', needsPasswordSet: false }],
    packages: []
  };
}

// Read firebase configuration
let firebaseApp: any;
let firestoreDb: any;

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log('Firebase initialized successfully in Express server.');
  } else {
    console.warn('Firebase config file missing inside backend. Falling back to local-only mode.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase for backend:', error);
}

// Helper to recursively strip undefined fields from objects before saving to Firestore
function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

// Background sync helper to save database state to Firestore
async function syncToFirestore(newData: DbSchema, oldData: DbSchema) {
  if (!firestoreDb) return;
  try {
    // 1. Sync residents
    const oldResidentsMap = new Map((oldData.residents || []).map(r => [r.id, r]));
    const newResidentsMap = new Map((newData.residents || []).map(r => [r.id, r]));

    for (const oldId of oldResidentsMap.keys()) {
      if (!newResidentsMap.has(oldId)) {
        await deleteDoc(doc(firestoreDb, 'residents', oldId));
      }
    }

    for (const [id, r] of newResidentsMap.entries()) {
      const oldR = oldResidentsMap.get(id);
      if (!oldR || JSON.stringify(oldR) !== JSON.stringify(r)) {
        await setDoc(doc(firestoreDb, 'residents', id), cleanForFirestore(r));
      }
    }

    // 2. Sync reservations
    const oldReservationsMap = new Map((oldData.reservations || []).map(r => [r.id, r]));
    const newReservationsMap = new Map((newData.reservations || []).map(r => [r.id, r]));

    for (const oldId of oldReservationsMap.keys()) {
      if (!newReservationsMap.has(oldId)) {
        await deleteDoc(doc(firestoreDb, 'reservations', oldId));
      }
    }

    for (const [id, r] of newReservationsMap.entries()) {
      const oldR = oldReservationsMap.get(id);
      if (!oldR || JSON.stringify(oldR) !== JSON.stringify(r)) {
        await setDoc(doc(firestoreDb, 'reservations', id), cleanForFirestore(r));
      }
    }

    // 3. Sync employees
    const oldEmployeesMap = new Map((oldData.employees || []).map(e => [e.id, e]));
    const newEmployeesMap = new Map((newData.employees || []).map(e => [e.id, e]));

    for (const oldId of oldEmployeesMap.keys()) {
      if (!newEmployeesMap.has(oldId)) {
        await deleteDoc(doc(firestoreDb, 'employees', oldId));
      }
    }

    for (const [id, e] of newEmployeesMap.entries()) {
      const oldE = oldEmployeesMap.get(id);
      if (!oldE || JSON.stringify(oldE) !== JSON.stringify(e)) {
        await setDoc(doc(firestoreDb, 'employees', id), cleanForFirestore(e));
      }
    }

    // 4. Sync packages
    const oldPackagesMap = new Map((oldData.packages || []).map(p => [p.id, p]));
    const newPackagesMap = new Map((newData.packages || []).map(p => [p.id, p]));

    for (const oldId of oldPackagesMap.keys()) {
      if (!newPackagesMap.has(oldId)) {
        await deleteDoc(doc(firestoreDb, 'packages', oldId));
      }
    }

    for (const [id, p] of newPackagesMap.entries()) {
      const oldP = oldPackagesMap.get(id);
      if (!oldP || JSON.stringify(oldP) !== JSON.stringify(p)) {
        await setDoc(doc(firestoreDb, 'packages', id), cleanForFirestore(p));
      }
    }

    // 5. Sync metadata Config
    const oldConfig = {
      authorizedAdmins: oldData.authorizedAdmins || [],
      driveConfig: oldData.driveConfig || {},
      adminPasswords: oldData.adminPasswords || {},
      conciergePassword: oldData.conciergePassword ?? null
    };

    const newConfig = {
      authorizedAdmins: newData.authorizedAdmins || [],
      driveConfig: newData.driveConfig || {},
      adminPasswords: newData.adminPasswords || {},
      conciergePassword: newData.conciergePassword ?? null
    };

    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      await setDoc(doc(firestoreDb, 'settings', 'main'), cleanForFirestore(newConfig));
    }
  } catch (error) {
    console.error('Error in background Firestore sync:', error);
  }
}

// Fetch all database records from Firestore to cache locally on startup
async function fetchFromFirestore(): Promise<DbSchema> {
  const dbSchema: DbSchema = {
    residents: [],
    reservations: [],
    authorizedAdmins: ['gabriel.nunez.costa@gmail.com'],
    driveConfig: {},
    adminPasswords: {},
    employees: [],
    packages: []
  };

  if (!firestoreDb) return dbSchema;

  try {
    console.log('Fetching database files from decentralized Firestore...');
    
    const residentsSnap = await getDocs(collection(firestoreDb, 'residents'));
    residentsSnap.forEach((d) => {
      dbSchema.residents.push(d.data() as ServerResident);
    });

    const reservationsSnap = await getDocs(collection(firestoreDb, 'reservations'));
    reservationsSnap.forEach((d) => {
      dbSchema.reservations.push(d.data() as ServerReservation);
    });

    const employeesSnap = await getDocs(collection(firestoreDb, 'employees'));
    employeesSnap.forEach((d) => {
      dbSchema.employees!.push(d.data() as ServerEmployee);
    });

    const packagesSnap = await getDocs(collection(firestoreDb, 'packages'));
    packagesSnap.forEach((d) => {
      dbSchema.packages!.push(d.data() as ServerPackage);
    });

    const configSnap = await getDoc(doc(firestoreDb, 'settings', 'main'));
    if (configSnap.exists()) {
      const data = configSnap.data();
      dbSchema.authorizedAdmins = data.authorizedAdmins || ['gabriel.nunez.costa@gmail.com'];
      dbSchema.driveConfig = data.driveConfig || {};
      dbSchema.adminPasswords = data.adminPasswords || {};
      dbSchema.conciergePassword = data.conciergePassword;
    }
    
    console.log(`Firestore fetching complete successfully. Residents: ${dbSchema.residents.length}, Reservations: ${dbSchema.reservations.length}, Employees: ${dbSchema.employees?.length}, Packages: ${dbSchema.packages?.length}`);
  } catch (error) {
    console.error('Error downloading from Firestore database:', error);
  }

  if (!dbSchema.employees || dbSchema.employees.length === 0) {
    dbSchema.employees = [{ id: 'emp_1', name: 'Porteiro Principal', password: '1234', needsPasswordSet: false }];
  }

  return dbSchema;
}

// Ensure database states are bidirectionally consistent
async function initializeDatabase() {
  if (!firestoreDb) return;
  console.log('Checking database status...');
  const localDb = readDb();
  const firestoreDbData = await fetchFromFirestore();

  const isFirestoreEmpty = 
    firestoreDbData.residents.length === 0 && 
    firestoreDbData.reservations.length === 0 && 
    (firestoreDbData.employees || []).length <= 1 &&
    (firestoreDbData.packages || []).length === 0;

  const isLocalNotEmpty = 
    localDb.residents.length > 0 || 
    localDb.reservations.length > 0 || 
    (localDb.employees || []).length > 1 || 
    (localDb.packages || []).length > 0;

  if (isFirestoreEmpty && isLocalNotEmpty) {
    console.log('Local db has data but Firestore is empty. Mirroring current local db to Firestore persistent storage...');
    await syncToFirestore(localDb, {
      residents: [],
      reservations: [],
      authorizedAdmins: [],
      driveConfig: {},
      adminPasswords: {},
      employees: [],
      packages: []
    });
    console.log('Mirroring state to Firestore completed successfully.');
  } else {
    console.log('Writing Firestore database records to local db.json cache...');
    fs.writeFileSync(DB_FILE, JSON.stringify(firestoreDbData, null, 2), 'utf-8');
    console.log('Local db.json sync completed.');
  }
}

function writeDb(data: DbSchema) {
  try {
    const oldData = readDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    syncToFirestore(data, oldData).catch((err) => {
      console.error('Failed background sync to Firestore:', err);
    });
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Await the Firestore synchronization so that the server local cache is populated before serving routes
  await initializeDatabase();

  // Support up to 5MB payloads to handle base64 face captures comfortably
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // ================= API ENDPOINTS =================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get all residents (excluding passwords)
  app.get('/api/residents', (req, res) => {
    const db = readDb();
    const publicResidents = db.residents.map(({ password, ...rest }) => rest);
    res.json(publicResidents);
  });

  // Resident Login
  app.post('/api/residents/login', (req, res) => {
    const { apartment, password } = req.body;
    const block = req.body.block || 'Único';
    
    if (!apartment || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    const db = readDb();
    // Find primary resident with password
    const resident = db.residents.find(
      r => r.apartment.toLowerCase() === apartment.trim().toLowerCase() && 
           r.block.toLowerCase() === block.trim().toLowerCase() &&
           r.password
    );

    if (!resident) {
      return res.status(404).json({ 
        error: 'Apartamento não cadastrado. Crie um cadastro primeiro.',
        needsSignup: true 
      });
    }

    if (resident.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    // Return resident info (no password)
    const { password: _, ...safeResident } = resident;
    res.json(safeResident);
  });

  // Resident Signup
  app.post('/api/residents/signup', (req, res) => {
    const { name, apartment, password, phone } = req.body;
    const block = req.body.block || 'Único';

    if (!name || !apartment || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    const db = readDb();
    
    // Check if the apartment already has a login registered
    const exists = db.residents.some(
      r => r.apartment.toLowerCase() === apartment.trim().toLowerCase() && 
           r.block.toLowerCase() === block.trim().toLowerCase() &&
           r.password
    );

    if (exists) {
      return res.status(400).json({ error: 'Este apartamento já possui um cadastro ativo.' });
    }

    const newResident: ServerResident = {
      id: 'res_' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      apartment: apartment.trim(),
      block: block.trim(),
      password: password,
      phone: phone ? phone.trim() : undefined,
      registeredAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    db.residents.push(newResident);
    writeDb(db);

    const { password: _, ...safeResident } = newResident;
    res.status(201).json(safeResident);
  });

  // Get all family members of an apartment
  app.get('/api/residents/apartment-members', (req, res) => {
    const { apartment } = req.query;
    const block = (req.query.block as string) || 'Único';
    
    if (!apartment) {
      return res.status(400).json({ error: 'Apartamento é obrigatório.' });
    }
    
    const db = readDb();
    const members = db.residents.filter(
      r => r.apartment.toLowerCase() === (apartment as string).trim().toLowerCase() && 
           r.block.toLowerCase() === block.trim().toLowerCase()
    );
    
    res.json(members);
  });

  // Add a family member to an apartment
  app.post('/api/residents/add-member', (req, res) => {
    const { name, apartment } = req.body;
    const block = req.body.block || 'Único';

    if (!name || !apartment) {
      return res.status(400).json({ error: 'Nome e apartamento são obrigatórios.' });
    }

    const db = readDb();
    
    // Check if name is already registered under this apartment
    const exists = db.residents.some(
      r => r.apartment.toLowerCase() === apartment.trim().toLowerCase() && 
           r.block.toLowerCase() === block.trim().toLowerCase() &&
           r.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (exists) {
      return res.status(400).json({ error: 'Este familiar já está cadastrado neste apartamento.' });
    }

    const newMember: ServerResident = {
      id: 'res_' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      apartment: apartment.trim(),
      block: block.trim(),
      registeredAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    db.residents.push(newMember);
    writeDb(db);

    res.status(201).json(newMember);
  });

  // Upload or update facial photo
  app.post('/api/residents/upload-face', (req, res) => {
    const { id, photoDataUrl } = req.body;

    if (!id || !photoDataUrl) {
      return res.status(400).json({ error: 'ID do morador e dados da foto são obrigatórios.' });
    }

    // Verify image size (max 1MB).
    // Base64 length is roughly 4/3 of binary size.
    // 1MB is 1,048,576 bytes. Base64 length limit roughly 1,398,101 characters.
    const approximateSizeInBytes = (photoDataUrl.length * 3) / 4;
    if (approximateSizeInBytes > 1024 * 1024) {
      return res.status(400).json({ error: 'A imagem excede o tamanho limite de 1MB.' });
    }

    const db = readDb();
    const residentIndex = db.residents.findIndex(r => r.id === id);

    if (residentIndex === -1) {
      return res.status(404).json({ error: 'Morador não encontrado.' });
    }

    db.residents[residentIndex].photoDataUrl = photoDataUrl;
    db.residents[residentIndex].syncStatus = 'pending'; // Needs sync since photo updated
    db.residents[residentIndex].deviceRegistered = false; // Reset device registration for manual update
    delete db.residents[residentIndex].syncError;

    writeDb(db);

    const { password, ...safeResident } = db.residents[residentIndex];
    res.json(safeResident);
  });

  // Get photo of a resident
  app.get('/api/residents/photo/:id', (req, res) => {
    const db = readDb();
    const resident = db.residents.find(r => r.id === req.params.id);

    if (!resident || !resident.photoDataUrl) {
      return res.status(404).send('Photo not found');
    }

    // Photo is stored as base64 data URL: data:image/jpeg;base64,...
    const matches = resident.photoDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Invalid photo format');
    }

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.contentType(contentType);
    res.send(buffer);
  });

  // Update sync status on the server
  app.post('/api/residents/update-sync', (req, res) => {
    const { id, syncStatus, driveFileId, syncError } = req.body;

    if (!id || !syncStatus) {
      return res.status(400).json({ error: 'ID e status de sincronização são obrigatórios.' });
    }

    const db = readDb();
    const residentIndex = db.residents.findIndex(r => r.id === id);

    if (residentIndex === -1) {
      return res.status(404).json({ error: 'Morador não encontrado.' });
    }

    db.residents[residentIndex].syncStatus = syncStatus;
    if (driveFileId) db.residents[residentIndex].driveFileId = driveFileId;
    if (syncError) db.residents[residentIndex].syncError = syncError;
    else delete db.residents[residentIndex].syncError;

    writeDb(db);
    res.json({ message: 'Status de sincronização atualizado com sucesso.' });
  });

  // Update physical device registration status
  app.post('/api/residents/update-device-registered', (req, res) => {
    const { id, deviceRegistered } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID do morador é obrigatório.' });
    }

    const db = readDb();
    const residentIndex = db.residents.findIndex(r => r.id === id);

    if (residentIndex === -1) {
      return res.status(404).json({ error: 'Morador não encontrado.' });
    }

    db.residents[residentIndex].deviceRegistered = !!deviceRegistered;

    writeDb(db);
    res.json({ message: 'Status de cadastro do dispositivo atualizado com sucesso.' });
  });

  // Delete resident (Requires admin check or credentials, client will request)
  app.post('/api/residents/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID do morador é obrigatório.' });
    }

    const db = readDb();
    const index = db.residents.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Morador não encontrado.' });
    }

    db.residents.splice(index, 1);
    writeDb(db);
    res.json({ success: true, message: 'Morador removido com sucesso.' });
  });

  // ================= RESERVATION ENDPOINTS =================

  // Get all reservations
  app.get('/api/reservations', (req, res) => {
    const db = readDb();
    res.json(db.reservations || []);
  });

  // Create a new reservation with collision validation
  app.post('/api/reservations', (req, res) => {
    const { apartment, residentId, residentName, amenity, date, timeSlot, notes } = req.body;
    const block = req.body.block || 'Único';

    if (!apartment || !residentId || !residentName || !amenity || !date || !timeSlot) {
      return res.status(400).json({ error: 'Todos os campos de reserva são obrigatórios.' });
    }

    const db = readDb();

    // 1. Validate advance booking (max 3 months) and prevent past dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (date < todayStr) {
      return res.status(400).json({ error: 'Não é possível reservar datas passadas.' });
    }

    const maxLimitDate = new Date();
    maxLimitDate.setMonth(maxLimitDate.getMonth() + 3);
    const maxLimitStr = maxLimitDate.toISOString().split('T')[0];
    if (date > maxLimitStr) {
      return res.status(400).json({ error: 'Instrução: As reservas só podem ser feitas com no máximo 3 meses de antecedência.' });
    }

    // 2. Limit squad court (quadra) to maximum 4 periods per day per apartment
    if (amenity === 'quadra' && residentId !== 'admin') {
      const apartmentReservationsCount = db.reservations.filter(
        r => r.amenity === 'quadra' &&
             r.date === date &&
             r.apartment.toLowerCase() === apartment.trim().toLowerCase() &&
             (r.block || 'Único').toLowerCase() === block.trim().toLowerCase()
      ).length;

      if (apartmentReservationsCount >= 4) {
        return res.status(400).json({ error: 'A reserva da quadra é limitada a no máximo 4 períodos por dia por apartamento.' });
      }
    }

    // Check availability collision
    const isBooked = db.reservations.some(
      r => r.amenity === amenity && 
           r.date === date && 
           r.timeSlot === timeSlot
    );

    if (isBooked) {
      return res.status(400).json({ error: 'Este horário já está reservado por outro morador.' });
    }

    const newReservation: ServerReservation = {
      id: 'rev_' + Math.random().toString(36).substring(2, 11),
      apartment: apartment.trim(),
      block: block.trim(),
      residentId,
      residentName: residentName.trim(),
      amenity,
      date,
      timeSlot,
      notes: notes ? notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    db.reservations.push(newReservation);
    writeDb(db);

    res.status(201).json(newReservation);
  });

  // Cancel/Delete reservation with authorization check (Admin or specific apartment)
  app.post('/api/reservations/delete', (req, res) => {
    const { id, requesterApartment, requesterBlock, isAdmin } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID da reserva é obrigatório.' });
    }

    const db = readDb();
    const index = db.reservations.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const resv = db.reservations[index];

    // Check if requester is authorized (is admin or matches the original apartment and block)
    const isAuthorized = isAdmin || (
      requesterApartment && 
      resv.apartment.toLowerCase() === requesterApartment.trim().toLowerCase() &&
      (resv.block || 'Único').toLowerCase() === (requesterBlock || 'Único').trim().toLowerCase()
    );

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para cancelar esta reserva.' });
    }

    db.reservations.splice(index, 1);
    writeDb(db);

    res.json({ success: true, message: 'Reserva cancelada com sucesso.' });
  });

  // Edit/Update reservation with authorization check
  app.post('/api/reservations/update', (req, res) => {
    const { id, notes, requesterApartment, requesterBlock, isAdmin } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID da reserva é obrigatório.' });
    }

    const db = readDb();
    const index = db.reservations.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const resv = db.reservations[index];

    // Check authorization
    const isAuthorized = isAdmin || (
      requesterApartment && 
      resv.apartment.toLowerCase() === requesterApartment.trim().toLowerCase() &&
      (resv.block || 'Único').toLowerCase() === (requesterBlock || 'Único').trim().toLowerCase()
    );

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para editar esta reserva.' });
    }

    resv.notes = notes ? notes.trim() : '';
    writeDb(db);

    res.json({ success: true, reservation: resv });
  });

  // ================= ADMIN & DRIVE SETTINGS =================

  // Get dynamic admin email list
  app.get('/api/admins', (req, res) => {
    const db = readDb();
    res.json(db.authorizedAdmins || ['gabriel.nunez.costa@gmail.com']);
  });

  // Add dynamic admin email
  app.post('/api/admins/add', (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail de administrador inválido.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = readDb();
    if (!db.authorizedAdmins) {
      db.authorizedAdmins = ['gabriel.nunez.costa@gmail.com'];
    }
    if (db.authorizedAdmins.includes(cleanEmail)) {
      return res.status(400).json({ error: 'Este e-mail já possui acesso de administrador.' });
    }
    db.authorizedAdmins.push(cleanEmail);
    writeDb(db);
    res.json({ success: true, authorizedAdmins: db.authorizedAdmins });
  });

  // Delete dynamic admin email
  app.post('/api/admins/delete', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === 'gabriel.nunez.costa@gmail.com') {
      return res.status(400).json({ error: 'Não é possível remover o administrador principal.' });
    }
    const db = readDb();
    if (!db.authorizedAdmins) {
      db.authorizedAdmins = ['gabriel.nunez.costa@gmail.com'];
    }
    const index = db.authorizedAdmins.indexOf(cleanEmail);
    if (index === -1) {
      return res.status(404).json({ error: 'Administrador não encontrado.' });
    }
    db.authorizedAdmins.splice(index, 1);
    writeDb(db);
    res.json({ success: true, authorizedAdmins: db.authorizedAdmins });
  });

  // Get default shared Drive configurations
  app.get('/api/drive-config', (req, res) => {
    const db = readDb();
    res.json(db.driveConfig || {});
  });

  // Store default shared Drive configurations
  app.post('/api/drive-config', (req, res) => {
    const { accessToken, folderId, email, expiresAt } = req.body;
    const db = readDb();
    db.driveConfig = {
      sharedAccessToken: accessToken || '',
      sharedFolderId: folderId || '',
      sharedAdminEmail: email || '',
      tokenExpiresAt: expiresAt || ''
    };
    writeDb(db);
    res.json({ success: true, driveConfig: db.driveConfig });
  });

  // ================= ADMIN CREDENTIALS & EMPLOYEES =================

  // Check admin email status
  app.post('/api/admins/check-status', (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail de administrador inválido.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = readDb();
    
    // Check if authorized
    const isAuthorized = (db.authorizedAdmins || []).includes(cleanEmail);
    if (!isAuthorized) {
      return res.json({ authorized: false, error: 'Acesso Negado: Este e-mail não possui privilégios de administrador.' });
    }

    const hasPassword = !!(db.adminPasswords && db.adminPasswords[cleanEmail]);
    res.json({ authorized: true, needsSetup: !hasPassword });
  });

  // Setup admin first-access password
  app.post('/api/admins/setup-password', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 4) {
      return res.status(400).json({ error: 'E-mail e senha (mínimo de 4 caracteres) são obrigatórios.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = readDb();

    // Verify permission
    const isAuthorized = (db.authorizedAdmins || []).includes(cleanEmail);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'E-mail não está cadastrado na lista de administradores autorizados.' });
    }

    if (!db.adminPasswords) {
      db.adminPasswords = {};
    }

    // Set password
    db.adminPasswords[cleanEmail] = password;
    writeDb(db);

    res.json({ success: true, message: 'Senha cadastrada com sucesso!' });
  });

  // Local Admin Login
  app.post('/api/admins/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = readDb();

    const isAuthorized = (db.authorizedAdmins || []).includes(cleanEmail);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'E-mail não cadastrado como administrador.' });
    }

    const storedPassword = db.adminPasswords && db.adminPasswords[cleanEmail];
    if (!storedPassword || storedPassword !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    res.json({
      success: true,
      user: {
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        isLocalAdmin: true
      }
    });
  });

  // Employee Login
  app.post('/api/employees/login', (req, res) => {
    const { employeeId, password } = req.body;
    
    if (!employeeId || !password) {
      return res.status(400).json({ error: 'Funcionário e senha são obrigatórios.' });
    }

    const db = readDb();
    const employee = db.employees?.find(e => e.id === employeeId);
    
    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    // Check if employee needs setup
    if (employee.needsPasswordSet || !employee.password) {
      return res.status(403).json({ 
        error: 'Este é seu primeiro acesso. Sua senha será definida agora.',
        needsSetup: true 
      });
    }

    if (employee.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    res.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name
      }
    });
  });

  // Update Shared Concierge Password (Admin)
  app.post('/api/concierge/password', (req, res) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Senha é obrigatória.' });
    }
    const db = readDb();
    db.conciergePassword = password;
    writeDb(db);
    res.json({ success: true });
  });

  // Check employee status (mirror admin check-status)
  app.post('/api/employees/check-status', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

    const db = readDb();
    const employee = db.employees?.find(e => e.id === id);

    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    const hasPassword = !!employee.password;
    res.json({ authorized: true, needsSetup: !hasPassword || employee.needsPasswordSet });
  });

  // Setup employee password
  app.post('/api/employees/setup-password', (req, res) => {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ error: 'ID e Senha são obrigatórios.' });
    }

    const db = readDb();
    const employee = db.employees?.find(e => e.id === employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    employee.password = password;
    employee.needsPasswordSet = false;
    writeDb(db);

    res.json({ success: true, message: 'Senha definida com sucesso!' });
  });

  // Get all employees (for selecting who received packages and admin view)
  app.get('/api/employees', (req, res) => {
    const db = readDb();
    res.json(db.employees || []);
  });

  // Create standard employee (called by Admins)
  app.post('/api/employees', (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const db = readDb();
    if (!db.employees) db.employees = [];

    const newEmployee: ServerEmployee = {
      id: 'emp_' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      needsPasswordSet: true
    };

    db.employees.push(newEmployee);
    writeDb(db);

    res.status(201).json(newEmployee);
  });

  // Upload employee photo
  app.post('/api/employees/upload-photo', (req, res) => {
    const { id, photoDataUrl } = req.body;

    if (!id || !photoDataUrl) {
      return res.status(400).json({ error: 'ID e foto são obrigatórios.' });
    }

    const db = readDb();
    const empIndex = db.employees?.findIndex(e => e.id === id);

    if (empIndex === undefined || empIndex === -1) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    db.employees![empIndex].photoDataUrl = photoDataUrl;
    writeDb(db);

    res.json({ success: true, employee: db.employees![empIndex] });
  });

  // Reset employee password (called by Admin)
  app.post('/api/employees/reset-password', (req, res) => {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID é obrigatório.' });
    }

    const db = readDb();
    const empIndex = db.employees?.findIndex(e => e.id === id);

    if (empIndex === undefined || empIndex === -1) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    // Reset password and flag for setup
    db.employees![empIndex].password = undefined;
    db.employees![empIndex].needsPasswordSet = true;
    writeDb(db);

    res.json({ success: true });
  });

  // Get photo of an employee
  app.get('/api/employees/photo/:id', (req, res) => {
    const db = readDb();
    const employee = db.employees?.find(e => e.id === req.params.id);

    if (!employee || !employee.photoDataUrl) {
      return res.status(404).send('Photo not found');
    }

    const matches = employee.photoDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Invalid photo format');
    }

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.contentType(contentType);
    res.send(buffer);
  });

  // Delete employee (called by Admins)
  app.post('/api/employees/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID do funcionário é obrigatório.' });
    }

    const db = readDb();
    if (!db.employees) db.employees = [];

    const index = db.employees.findIndex(e => e.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    // Don't allow deleting the last employee to prevent lockout
    if (db.employees.length <= 1) {
      return res.status(400).json({ error: 'Não é possível remover o único funcionário cadastrado.' });
    }

    const removed = db.employees.splice(index, 1)[0];
    writeDb(db);

    res.json({ success: true, removed });
  });

  // Get packages
  app.get('/api/packages', (req, res) => {
    const db = readDb();
    res.json(db.packages || []);
  });

  // Add package (by Employee)
  app.post('/api/packages/add', (req, res) => {
    const { apartment, block, recipientName, description, receivedBy } = req.body;
    if (!apartment || !description) {
      return res.status(400).json({ error: 'Apartamento e descrição da encomenda são obrigatórios.' });
    }

    const db = readDb();
    const newPackage: ServerPackage = {
      id: 'pkg_' + Math.random().toString(36).substring(2, 11),
      apartment: apartment.trim(),
      block: block ? block.trim() : 'Único',
      recipientName: recipientName ? recipientName.trim() : 'Qualquer Morador',
      description: description.trim(),
      receivedAt: new Date().toISOString(),
      status: 'pending',
      receivedBy: receivedBy ? receivedBy.trim() : 'Porteiro Principal'
    };

    if (!db.packages) {
      db.packages = [];
    }

    db.packages.push(newPackage);
    writeDb(db);
    res.status(201).json(newPackage);
  });

  // Deliver package (Mark as delivered)
  app.post('/api/packages/deliver', (req, res) => {
    const { id, deliveredTo } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID da encomenda é obrigatório.' });
    }

    const db = readDb();
    if (!db.packages) db.packages = [];
    const index = db.packages.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Encomenda não encontrada.' });
    }

    db.packages[index].status = 'delivered';
    db.packages[index].deliveredAt = new Date().toISOString();
    db.packages[index].deliveredTo = deliveredTo ? deliveredTo.trim() : 'Morador do apartamento';

    writeDb(db);
    res.json({ success: true, package: db.packages[index] });
  });

  // ================= VITE OR STATIC SERVING =================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets from `dist`
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
