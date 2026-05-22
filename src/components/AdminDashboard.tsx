/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderSync, 
  FolderOpen, 
  Trash2, 
  Eye, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Users, 
  RefreshCw, 
  LogOut,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  Lock,
  Download,
  ShieldAlert
} from 'lucide-react';
import { Resident, SyncProgress } from '../types';
import { googleSignIn, logout } from '../firebase';
import { findOrCreateFolder, uploadResidentPhoto, deleteDriveFile } from '../driveService';
import ReservationSection from './ReservationSection';
import ReservationCalendar from './ReservationCalendar';
import { Reservation } from '../types';

interface AdminDashboardProps {
  onAdminStateChange?: (user: any) => void;
  onBack?: () => void;
}

export default function AdminDashboard({ onAdminStateChange, onBack }: AdminDashboardProps = {}) {
  const [adminSubTab, setAdminSubTab] = useState<'moradores' | 'reservas' | 'funcionarios' | 'calendario'>('moradores');
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncProgress[]>([]);
  const [mainFolderId, setMainFolderId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [loggingInToggle, setLoggingInToggle] = useState<boolean>(false);
  
  // Modal preview photo
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);
  const [selectedNotRegisteredResident, setSelectedNotRegisteredResident] = useState<Resident | null>(null);

  // States for Authorized Admin and Drive configurations
  const [authorizedAdmins, setAuthorizedAdmins] = useState<string[]>(['gabriel.nunez.costa@gmail.com']);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [deletingResidentId, setDeletingResidentId] = useState<string | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [resettingEmployeeId, setResettingEmployeeId] = useState<string | null>(null);
  const [sharedDriveInfo, setSharedDriveInfo] = useState<{ email?: string; expiresAt?: string } | null>(null);

  // Employees administration states and actions
  const [employees, setEmployees] = useState<{ id: string; name: string; needsPasswordSet: boolean; photoDataUrl?: string }[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSuccess, setEmployeeSuccess] = useState('');

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    setEmployeeError('');
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        setEmployees(await res.json());
      } else {
        setEmployeeError('Erro ao carregar funcionários.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEmployeeName.trim() }),
      });

      if (res.ok) {
        setNewEmployeeName('');
        setEmployeeSuccess('Funcionário adicionado com sucesso!');
        await fetchEmployees();
        setTimeout(() => setEmployeeSuccess(''), 3000);
      } else {
        const data = await res.json();
        setEmployeeError(data.error || 'Erro ao adicionar.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão.');
    }
  };

  const handleSetEmployeePassword = async (employeeId: string, password: string) => {
    console.log('Setting password for:', employeeId, 'password length:', password.length);
    try {
      const res = await fetch('/api/employees/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password }),
      });
      const data = await res.json();
      console.log('Response:', data);
      if (res.ok) {
        await fetchEmployees();
        alert('Senha definida!');
      } else {
        alert('Erro ao definir senha: ' + (data.error || 'Erro'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    }
  };

  const handleSetConciergePassword = async (password: string) => {
    try {
      const res = await fetch('/api/concierge/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        alert('Senha da portaria alterada com sucesso!');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao definir senha da portaria.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    }
  };

  const handleStartDeleteEmployee = (id: string) => {
    setDeletingEmployeeId(id);
  };

  const confirmDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch('/api/employees/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchEmployees();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao remover.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const handleResetEmployeePassword = async (id: string) => {
    try {
      const res = await fetch('/api/employees/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setEmployeeSuccess('Senha resetada com sucesso! O funcionário deverá definir uma nova senha no próximo acesso.');
        await fetchEmployees();
        setTimeout(() => setEmployeeSuccess(''), 5000);
      } else {
        const data = await res.json();
        setEmployeeError(data.error || 'Erro ao resetar senha.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão ao tentar resetar senha.');
    } finally {
      setResettingEmployeeId(null);
    }
  };

  const handleUploadEmployeePhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/employees/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, photoDataUrl: base64 }),
        });
        if (res.ok) {
          fetchEmployees();
        } else {
          const data = await res.json();
          alert(data.error || 'Erro ao subir foto.');
        }
      } catch (err) {
        alert('Erro de conexão.');
      }
    };
    reader.readAsDataURL(file);
  };


  // Fetch dynamic administrator emails
  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAuthorizedAdmins(data);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  // Fetch dynamic shared Drive config
  const fetchSharedDriveConfig = async () => {
    try {
      const res = await fetch('/api/drive-config');
      if (res.ok) {
        const config = await res.json();
        if (config.sharedAccessToken && config.tokenExpiresAt) {
          const expTime = new Date(config.tokenExpiresAt).getTime();
          const nowTime = new Date().getTime();
          if (expTime > nowTime) {
            setAccessToken(config.sharedAccessToken);
            setSharedDriveInfo({
              email: config.sharedAdminEmail,
              expiresAt: config.tokenExpiresAt
            });
          }
        }
      }
    } catch (err) {
      console.warn("Could not load shared drive config", err);
    }
  };

  // Set current active session as standard global Google Drive
  const handleSaveDefaultDrive = async () => {
    if (!accessToken || !googleUser?.email) return;
    try {
      const expires = new Date();
      expires.setHours(expires.getHours() + 1); // 1 hour access
      const res = await fetch('/api/drive-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          email: googleUser.email,
          expiresAt: expires.toISOString()
        })
      });
      if (res.ok) {
        setSharedDriveInfo({
          email: googleUser.email,
          expiresAt: expires.toISOString()
        });
        alert('Este Google Drive foi definido com sucesso como o padrão global do condomínio pelas próximas 1 hora!');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar Drive padrão.');
    }
  };

  // Add a new administrator email
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      setAdminError('Insira um e-mail válido!');
      return;
    }
    try {
      const res = await fetch('/api/admins/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthorizedAdmins(data.authorizedAdmins);
        setNewAdminEmail('');
        setAdminSuccess('Administrador cadastrado com sucesso!');
      } else {
        setAdminError(data.error || 'Erro ao adicionar administrador.');
      }
    } catch (err) {
      setAdminError('Conexão falhou ao salvar.');
    }
  };

  // Delete an administrator email
  const handleDeleteAdmin = async (emailToDelete: string) => {
    setAdminError('');
    setAdminSuccess('');
    if (emailToDelete === 'gabriel.nunez.costa@gmail.com') {
      setAdminError('Não é possível remover o administrador principal.');
      return;
    }
    try {
      const res = await fetch('/api/admins/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthorizedAdmins(data.authorizedAdmins);
        setAdminSuccess('Administrador removido com sucesso!');
      } else {
        setAdminError(data.error || 'Erro ao remover admin.');
      }
    } catch (err) {
      setAdminError('Conexão falhou ao deletar.');
    }
  };

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/residents');
      if (response.ok) {
        const data = await response.json();
        setResidents(data);
      }
    } catch (err) {
      console.error('Error fetching residents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations');
      if (response.ok) {
        setReservations(await response.json());
      }
    } catch (err) {
      console.error('Error fetching reservations:', err);
    }
  };

  // Toggle device registration status
  const handleToggleDeviceRegistered = async (id: string, currentlyRegistered: boolean) => {
    try {
      const response = await fetch('/api/residents/update-device-registered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          deviceRegistered: !currentlyRegistered
        })
      });

      if (response.ok) {
        if (selectedNotRegisteredResident?.id === id) {
          // Find the list of residents who have photo but are not registered yet
          const pendingRegList = residents.filter(r => r.photoDataUrl && !r.deviceRegistered && r.id !== id);
          if (pendingRegList.length > 0) {
            // Find current index in displayResidents
            const currentIdx = displayResidents.findIndex(r => r.id === id);
            // Get next pending resident in displaying sequence
            const nextInList = displayResidents.slice(currentIdx + 1).find(r => r.id !== id && r.photoDataUrl && !r.deviceRegistered);
            const prevInList = [...displayResidents].reverse().find(r => r.id !== id && r.photoDataUrl && !r.deviceRegistered);
            setSelectedNotRegisteredResident(nextInList || prevInList || pendingRegList[0] || null);
          } else {
            setSelectedNotRegisteredResident(null);
          }
        }
        await fetchResidents();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao atualizar status.');
      }
    } catch (err) {
      console.error('Error toggling device registration:', err);
    }
  };

  const handleDownloadPhoto = async (res: Resident) => {
    try {
      const response = await fetch(`/api/residents/photo/${res.id}`);
      if (!response.ok) throw new Error('Falha ao obter foto.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.name}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download err:', err);
      if (res.photoDataUrl) {
        const a = document.createElement('a');
        a.href = res.photoDataUrl;
        a.download = `${res.name}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  useEffect(() => {
    if (onAdminStateChange) {
      onAdminStateChange(googleUser);
    }
  }, [googleUser, onAdminStateChange]);

  useEffect(() => {
    fetchResidents();
    fetchAdmins();
    fetchSharedDriveConfig();
    fetchEmployees();
    fetchReservations();

    const handleUpdate = () => {
      fetchReservations();
    };
    window.addEventListener('reservation-updated', handleUpdate);
    return () => {
      window.removeEventListener('reservation-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (adminSubTab === 'funcionarios') {
      fetchEmployees();
    }
  }, [adminSubTab]);

  useEffect(() => {
    if (filterStatus === 'not_registered_device') {
      const pendingRegList = residents.filter(r => r.photoDataUrl && !r.deviceRegistered);
      if (pendingRegList.length > 0) {
        if (!selectedNotRegisteredResident || !pendingRegList.some(r => r.id === selectedNotRegisteredResident.id)) {
          setSelectedNotRegisteredResident(pendingRegList[0]);
        }
      } else {
        setSelectedNotRegisteredResident(null);
      }
    } else {
      setSelectedNotRegisteredResident(null);
    }
  }, [filterStatus, residents]);

  // States for Local password/email Admin Authentication
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [isFirstAccessSetup, setIsFirstAccessSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // Handle Local Admin/Sub-Admin Login
  const handleLocalAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoggingInToggle(true);

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAuthError('E-mail e senha são obrigatórios.');
      setLoggingInToggle(false);
      return;
    }

    try {
      // 1. Check if email is authorized and needs setup
      const statusRes = await fetch('/api/admins/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim() })
      });

      if (!statusRes.ok) {
        throw new Error('Falha ao verificar status do administrador.');
      }

      const statusData = await statusRes.json();
      if (!statusData.authorized) {
        setAuthError(statusData.error || 'Acesso negado: Este e-mail não possui privilégios de administrador.');
        setLoggingInToggle(false);
        return;
      }

      if (statusData.needsSetup) {
        // Switch view to password setup
        setIsFirstAccessSetup(true);
        setLoggingInToggle(false);
        return;
      }

      // 2. Perform regular local login
      const loginRes = await fetch('/api/admins/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.error || 'Erro ao realizar login.');
      }

      // Successful login
      setGoogleUser(loginData.user); // Store safe local session
      setAuthError('');
    } catch (err: any) {
      setAuthError(err.message || 'Erro de conexão.');
    } finally {
      setLoggingInToggle(false);
    }
  };

  // Handle first-access password formulation
  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSetupLoading(true);

    if (adminPassword !== adminConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      setSetupLoading(false);
      return;
    }

    if (adminPassword.length < 4) {
      setAuthError('A senha deve ter no mínimo 4 caracteres.');
      setSetupLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admins/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar senha.');
      }

      // Successfully registered! Now perform login
      setIsFirstAccessSetup(false);
      
      // Perform automated local login
      const loginRes = await fetch('/api/admins/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setGoogleUser(loginData.user);
      } else {
        setAuthError('Senha cadastrada com sucesso! Faça o login novamente.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao configurar senha.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Handle Google Auth Sign In (Coordinator only)
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setLoggingInToggle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const email = result.user.email?.toLowerCase().trim();
        
        // Google Sign in is strictly limited to Project Coordinator
        if (email !== 'gabriel.nunez.costa@gmail.com') {
          await logout();
          setGoogleUser(null);
          setAccessToken(null);
          setAuthError(`Acesso com Google permitido apenas para o Coordenador (gabriel.nunez.costa@gmail.com). Para outros administradores, acesse usando E-mail e Senha.`);
          setLoggingInToggle(false);
          return;
        }

        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setAuthError('');
        
        // Try to store this access token as the standard/global Drive config for 1 hour duration
        try {
          const expires = new Date();
          expires.setHours(expires.getHours() + 1);
          await fetch('/api/drive-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: result.accessToken,
              email: email,
              expiresAt: expires.toISOString()
            })
          });
          setSharedDriveInfo({
            email: email,
            expiresAt: expires.toISOString()
          });
        } catch (configErr) {
          console.warn("Could not store default drive settings:", configErr);
        }
      }
    } catch (err: any) {
      console.error('Failed Google login:', err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError('O login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site e tente novamente.');
      } else if (err.code === 'auth/cancelled-by-user') {
        setAuthError('Login cancelado pelo usuário.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setAuthError('Este domínio não está autorizado no Firebase. Adicione o domínio da URL atual nas configurações do console do Firebase.');
      } else {
        setAuthError(`Erro no login (${err.code || 'erro desconhecido'}): ${err.message || 'Falha ao autenticar com o Google.'}`);
      }
    } finally {
      setLoggingInToggle(false);
    }
  };

  // Handle Sign Out
  const handleGoogleSignOut = async () => {
    try {
      if (googleUser && !googleUser.isLocalAdmin) {
        await logout();
      }
    } catch (err) {
      console.warn("Firebase logout failed:", err);
    }
    setGoogleUser(null);
    setAccessToken(null);
    setAdminEmail('');
    setAdminPassword('');
    setAdminConfirmPassword('');
    setIsFirstAccessSetup(false);
    setSyncLogs([]);
    if (onBack) {
      onBack();
    }
  };

  // Handle delete resident account
  const handleDeleteResident = async (id: string, name: string) => {
    // Save to target state trigger first to let custom alert render securely inside iframe
    setDeletingResidentId(id);
  };

  const confirmDeleteResident = async (id: string) => {
    try {
      const response = await fetch('/api/residents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setResidents(prev => prev.filter(r => r.id !== id));
        if (selectedNotRegisteredResident?.id === id) {
          setSelectedNotRegisteredResident(null);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao deletar morador.');
      }
    } catch (err) {
      console.error('Error deleting resident:', err);
      alert('Erro ao excluir do servidor.');
    } finally {
      setDeletingResidentId(null);
    }
  };

  // Run the batch synchronization to Google Drive
  const handleSyncToDrive = async () => {
    if (!accessToken) {
      alert('Por favor, faça login com o Google primeiro.');
      return;
    }

    setIsSyncing(true);
    setSyncLogs([]);

    // 1. Fetch latest state of residents to ensure we have any new records
    let currentResidents: Resident[] = [];
    try {
      const response = await fetch('/api/residents');
      if (response.ok) {
        currentResidents = await response.json();
        setResidents(currentResidents);
      } else {
        currentResidents = residents;
      }
    } catch (err) {
      currentResidents = residents;
    }

    // 2. Identify pending/failed registrations that have valid captured images
    const pendingSyncList = currentResidents.filter(
      r => r.photoDataUrl && (r.syncStatus === 'pending' || r.syncStatus === 'failed')
    );

    if (pendingSyncList.length === 0) {
      alert('Todas as fotos de moradores registradas já foram sincronizadas com o Google Drive!');
      setIsSyncing(false);
      return;
    }

    // Instantiate logging rows for interface feedback
    const initialLogs: SyncProgress[] = pendingSyncList.map(r => ({
      residentId: r.id,
      residentName: r.name,
      status: 'pending',
    }));
    setSyncLogs(initialLogs);

    try {
      // 3. Obtain or create Root Folder target in Drive: "Fotos Reconhecimento Facial Condomínio"
      const rootFolderId = await findOrCreateFolder(accessToken, 'Fotos Reconhecimento Facial Condomínio');
      setMainFolderId(rootFolderId);

      // 4. Sequence sync loop for every resident
      for (let index = 0; index < pendingSyncList.length; index++) {
        const resident = pendingSyncList[index];
        
        // Update logging state to syncing
        setSyncLogs(prev => prev.map(log => 
          log.residentId === resident.id ? { ...log, status: 'syncing' } : log
        ));

        try {
          // A. Define the Apartment Subfolder name
          const subfolderName = `Apto ${resident.apartment} - Bloco ${resident.block}`;
          
          // B. Obtain or create the subfolder in Google Drive
          const aptFolderId = await findOrCreateFolder(accessToken, subfolderName, rootFolderId);

          // C. Delete old photo in Drive if existed to prevent duplicate files
          if (resident.driveFileId) {
            try {
              await deleteDriveFile(accessToken, resident.driveFileId);
            } catch (delErr) {
              console.warn(`Could not delete old file ${resident.driveFileId} from Drive:`, delErr);
            }
          }

          // D. Upload the brand new Base64 image
          const fileName = `${resident.name}.jpg`;
          const driveFileId = await uploadResidentPhoto(
            accessToken,
            fileName,
            aptFolderId,
            resident.photoDataUrl!
          );

          // D. Store status back to local Express server DB
          const updateResponse = await fetch('/api/residents/update-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: resident.id,
              syncStatus: 'synced',
              driveFileId: driveFileId,
            }),
          });

          if (!updateResponse.ok) {
            throw new Error('Falha ao atualizar banco de dados.');
          }

          // E. Update logging outcome to completed
          setSyncLogs(prev => prev.map(log => 
            log.residentId === resident.id ? { ...log, status: 'completed' } : log
          ));

        } catch (error: any) {
          console.error(`Sync error for ${resident.name}:`, error);
          
          // Update logging state to failed
          setSyncLogs(prev => prev.map(log => 
            log.residentId === resident.id ? { ...log, status: 'failed', error: error.message || 'Erro de upload' } : log
          ));

          // Log failure on backend server
          await fetch('/api/residents/update-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: resident.id,
              syncStatus: 'failed',
              syncError: error.message || 'Erro desconhecido no Drive',
            }),
          }).catch(err => console.error("Could not register sync failure on server", err));
        }
      }

      // Re-fetch all residents to refresh table values
      fetchResidents();
    } catch (rootError: any) {
      alert('Sincronização abortada devido a erro nas pastas raiz do Drive: ' + rootError.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper calculations
  const totalCount = residents.length;
  const syncedCount = residents.filter(r => r.syncStatus === 'synced').length;
  const pendingCount = residents.filter(r => r.photoDataUrl && r.syncStatus === 'pending').length;
  const noPhotoCount = residents.filter(r => !r.photoDataUrl).length;
  const notRegisteredDeviceCount = residents.filter(r => r.photoDataUrl && !r.deviceRegistered).length;

  // Filter & Search Resident array
  const filteredResidents = residents.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.apartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.block.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'synced') return matchesSearch && r.syncStatus === 'synced';
    if (filterStatus === 'pending') return matchesSearch && r.photoDataUrl && r.syncStatus === 'pending';
    if (filterStatus === 'nophoto') return matchesSearch && !r.photoDataUrl;
    if (filterStatus === 'failed') return matchesSearch && r.syncStatus === 'failed';
    if (filterStatus === 'not_registered_device') return matchesSearch && r.photoDataUrl && !r.deviceRegistered;
    
    return matchesSearch;
  });

  const displayResidents = filterStatus === 'not_registered_device'
    ? [...filteredResidents].sort((a, b) => {
        const aptA = parseInt(a.apartment, 10);
        const aptB = parseInt(b.apartment, 10);
        if (!isNaN(aptA) && !isNaN(aptB)) {
          if (aptA !== aptB) return aptA - aptB;
        }
        const comp = a.apartment.localeCompare(b.apartment, undefined, { numeric: true });
        if (comp !== 0) return comp;
        return a.name.localeCompare(b.name);
      })
    : filteredResidents;

  if (!googleUser) {
    return (
      <div className="w-full max-w-md mx-auto bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-8 space-y-6 text-left">
        <div className="flex justify-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center text-gold border border-gold/15">
            <Lock size={32} />
          </div>
        </div>

        {isFirstAccessSetup ? (
          /* FIRST TIME PASSWORD SETUP FORM */
          <div className="space-y-4">
            <div className="text-center">
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono">
                Primeiro Acesso
              </span>
              <h2 className="font-display text-[17px] font-bold text-white tracking-tight mt-2">Cadastrar Minha Senha</h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                O e-mail <strong className="text-zinc-200">{adminEmail}</strong> está autorizado pelo coordenador. Escolha uma senha segura para seus acessos.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 text-red-400 text-xs border border-red-900/35 rounded-xl font-medium leading-relaxed font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handlePasswordSetup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Escolha uma Senha</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Confirme a Senha</label>
                <input
                  type="password"
                  required
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repita a senha escolhida"
                  className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
              >
                {setupLoading ? 'Cadastrando...' : 'Cadastrar Senha e Acessar'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsFirstAccessSetup(false);
                  setAuthError('');
                }}
                className="text-xs text-zinc-500 hover:text-white underline font-medium cursor-pointer"
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        ) : (
          /* REGULAR EMAIL/PASSWORD LOGIN FORM */
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="font-display text-lg font-bold text-white tracking-tight">Painel do Síndico</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1 font-sans">
                Insira o seu e-mail designado pelo coordenador do projeto e sua senha de acesso.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 text-red-400 text-xs border border-red-900/35 rounded-xl font-medium leading-relaxed font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handleLocalAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="exemplo@condominio.com"
                  className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Senha de Acesso</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600 font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={loggingInToggle}
                className="w-full py-2.5 font-bold rounded-xl text-xs text-black bg-gold hover:bg-gold-hover transition-colors shadow-lg shadow-gold/15 cursor-pointer disabled:opacity-50"
              >
                {loggingInToggle ? 'Autenticando...' : 'Acessar com E-mail'}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="relative flex items-center justify-center select-none pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dark-border"></div>
              </div>
              <span className="relative px-3 bg-dark-card text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                Acesso Coordenador (Google)
              </span>
            </div>

            {/* GOOGLE SIGN IN BUTTON FOR ADM PROJECT COORDINATOR ONLY */}
            <div className="pt-1 select-none">
              <button 
                id="admin-gateway-login-btn"
                onClick={handleGoogleSignIn}
                disabled={loggingInToggle}
                className="gsi-material-button w-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow active:scale-[0.98] transition-transform"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper justify-center">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents select-none">{loggingInToggle ? 'Verificando...' : 'Entrar com o Google'}</span>
                </div>
              </button>
              <p className="text-[9px] text-zinc-500 font-sans tracking-wide text-center mt-3 leading-relaxed">
                * O acesso através do botão Google é restrito unicamente ao e-mail do coordenador do projeto.
              </p>
            </div>

            <div className="pt-4 border-t border-dark-border/60 mt-5 text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-medium cursor-pointer"
              >
                Voltar para o Portal Principal
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="admin-dashboard-container" className="space-y-6 w-full max-w-7xl mx-auto">
      
      {/* GOOGLE DRIVE SYNC HUD HEADER */}
      <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gold-light rounded-xl text-gold shrink-0">
            <Building size={24} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white tracking-tight">Área do Síndico</h1>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-xl leading-relaxed">
              Gerencie os moradores, visualize faciais cadastradas e sincronize arquivos diretamente com pastas organizadas por apartamento no seu Google Drive.
            </p>
          </div>
        </div>

        {/* AUTH BLOCK */}
        <div className="shrink-0 w-full md:w-auto">
          {!googleUser ? (
            <div className="space-y-2">
              {/* Official styled GSI button */}
              <button 
                id="gsi-drive-login-btn"
                onClick={handleGoogleSignIn}
                className="gsi-material-button w-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Habilitar Google Drive</span>
                </div>
              </button>
              <p className="text-[10px] text-zinc-505 text-center uppercase tracking-wider font-mono">
                Requerido para gerenciar fotos em seu Google Drive
              </p>
            </div>
          ) : (
            <div className="bg-dark-input border border-dark-border p-3 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {googleUser.photoURL && (
                  <img 
                    src={googleUser.photoURL} 
                    alt="Perfil" 
                    className="w-8 h-8 rounded-full border border-dark-border" 
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 leading-tight">{googleUser.displayName}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono leading-none mt-1">{googleUser.email}</p>
                </div>
              </div>
              <button 
                id="gsi-drive-logout-btn"
                onClick={handleGoogleSignOut}
                title="Desconectar do Google"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg cursor-pointer transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TABS SELECTOR FOR ADMIN */}
      <div className="flex bg-dark-input rounded-xl p-1 gap-1 border border-dark-border max-w-lg select-none">
        <button
          onClick={() => setAdminSubTab('moradores')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer ${adminSubTab === 'moradores' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Moradores e Sinc
        </button>
        <button
          onClick={() => setAdminSubTab('reservas')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer ${adminSubTab === 'reservas' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Gestão de Reservas
        </button>
        <button
          onClick={() => setAdminSubTab('funcionarios')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer ${adminSubTab === 'funcionarios' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Funcionários
        </button>
        <button
          onClick={() => setAdminSubTab('calendario')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer ${adminSubTab === 'calendario' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Calendário Reservas
        </button>
      </div>

      {adminSubTab === 'moradores' && (
        <>
          {/* OVERVIEW STATS CARDS GRID */}
      <div id="admin-stats-grid" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-display">Cadastros</span>
            <Users size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-white">{totalCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Moradores cadastrados</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display">Sincronizados</span>
            <CheckCircle2 size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-emerald-400">{syncedCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Arquivos no Drive</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display">Pendentes</span>
            <Clock size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-amber-400">{pendingCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Aguardando sync</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-display">Sem Facial</span>
            <Building size={16} className="text-zinc-600" />
          </div>
          <h3 className="font-display text-2xl font-bold text-zinc-400">{noPhotoCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Sem upload de foto</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display font-medium">Pendente Aparelho</span>
            <ShieldAlert size={16} className="text-purple-400" />
          </div>
          <h3 className="font-display text-2xl font-bold text-purple-400">{notRegisteredDeviceCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Não reg. no facial físico</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT SIDEBAR SECTION */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* SYNC PANEL */}
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderSync size={18} className="text-gold" />
                <h3 className="font-display text-base font-semibold text-white">Sincronizador Drive</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mecanismo seguro para exportar as fotos faciais ativas do app e disponibilizá-las organizadas em pastas no Google Drive do síndico.
              </p>

              {googleUser ? (
                <div className="space-y-4 pt-2">
                  {/* Share drive indication */}
                  {googleUser.isSharedSession ? (
                    <div className="p-3 bg-emerald-950/35 border border-emerald-900/35 rounded-xl text-[11px] text-emerald-400 leading-snug">
                      <p className="font-semibold">✔ Autenticação Padrão Ativa</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">As fotos serão salvas no Google Drive de <strong>{googleUser.email}</strong>.</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-purple-950/30 border border-purple-900/20 rounded-xl text-[11px] text-purple-400 space-y-2">
                      <p className="font-semibold">☁ Conta Google Conectada</p>
                      <p className="text-[10px] text-zinc-400 leading-snug">Você está usando sua sessão atual ({googleUser.email}).</p>
                      <button
                        onClick={handleSaveDefaultDrive}
                        className="w-full py-1.5 px-3 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg text-[10px] transition-colors uppercase tracking-wider font-mono cursor-pointer"
                      >
                        Tornar este Drive Padrão do Prédio
                      </button>
                    </div>
                  )}

                  {sharedDriveInfo && !googleUser.isSharedSession && (
                    <div className="text-[9px] text-zinc-500 font-mono text-center leading-normal">
                      Atualmente, a conta padrão ativa na nuvem é: {sharedDriveInfo.email}
                    </div>
                  )}

                  <button
                    id="admin-start-sync-btn"
                    onClick={handleSyncToDrive}
                    disabled={isSyncing || pendingCount === 0}
                    className="w-full py-3 px-4 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-gold/15 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none font-display font-semibold"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <FolderSync size={16} />
                        Sincronizar {pendingCount} Foto(s)
                      </>
                    )}
                  </button>

                  {mainFolderId && (
                    <a
                      id="admin-open-drive-link"
                      href={`https://drive.google.com/drive/folders/${mainFolderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-900/30 font-display"
                    >
                      <FolderOpen size={14} /> Abrir Pasta no Google Drive <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-dark-input rounded-xl border border-dark-border text-center space-y-3 pt-6">
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Por favor, habilite o Google Drive utilizando o botão no topo para autenticar e salvar todas as fotos automaticamente neste condomínio.
                  </p>
                  <div className="inline-flex items-center gap-1 bg-gold-light text-gold text-[10px] px-2.5 py-1 rounded-md font-semibold tracking-wide uppercase border border-gold/10">
                    Conexão Requerida
                  </div>
                </div>
              )}
            </div>

            {/* REAL TIME CONSOLE STEPS */}
            {syncLogs.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dark-border space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Console de Operação</h4>
                <div className="bg-dark-input rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-2 font-mono text-[10px] text-zinc-300 border border-dark-border select-none">
                  {syncLogs.map((log) => (
                    <div key={log.residentId} className="flex items-center justify-between gap-2 border-b border-dark-border pb-1 last:border-b-0 last:pb-0">
                      <span className="truncate text-zinc-400 max-w-[140px]">{log.residentName}</span>
                      <span className="shrink-0 flex items-center">
                        {log.status === 'pending' && <span className="text-zinc-600 font-medium">AGUARDANDO</span>}
                        {log.status === 'syncing' && <span className="text-amber-400 animate-pulse font-medium">UPLOADING...</span>}
                        {log.status === 'completed' && <span className="text-emerald-400 font-bold flex items-center gap-0.5 font-sans">OK</span>}
                        {log.status === 'failed' && <span className="text-red-400 font-bold" title={log.error}>FALHOU</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ADMIN MANAGEMENT CARD */}
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-gold" />
              <h3 className="font-display text-base font-semibold text-white">Administradores Autorizados</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Dê acesso de administrador a outros e-mails do Google para gerenciar moradores e sincronizar arquivos.
            </p>

            <form onSubmit={handleAddAdmin} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="E-mail do novo administrador"
                  className="flex-1 px-3 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs focus:outline-none focus:border-gold transition-all text-white placeholder-zinc-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-black font-semibold text-xs rounded-lg transition-colors font-display cursor-pointer shrink-0"
                >
                  Adicionar
                </button>
              </div>
              {adminError && <p className="text-[10px] text-red-400 font-medium">{adminError}</p>}
              {adminSuccess && <p className="text-[10px] text-emerald-400 font-medium">{adminSuccess}</p>}
            </form>

            <div className="border-t border-dark-border/40 pt-3 space-y-1.5 max-h-[148px] overflow-y-auto pr-1">
              {authorizedAdmins.map((email) => {
                const isPrimary = email === 'gabriel.nunez.costa@gmail.com';
                return (
                  <div key={email} className="flex items-center justify-between gap-2 p-2 bg-dark-input/30 rounded-lg border border-dark-border/10 text-xs">
                    <span className="truncate text-zinc-300 font-mono text-[10px]">{email}</span>
                    {isPrimary ? (
                      <span className="px-1.5 py-0.5 bg-gold/15 text-gold text-[8px] font-bold rounded uppercase font-mono shrink-0">
                        Principal
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteAdmin(email)}
                        className="text-[9px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-wide cursor-pointer font-mono"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RESIDENTS TABLE LIST */}
        <div className="lg:col-span-2 bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-border">
            <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-gold" />
              Lista de Residentes
            </h3>
            
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1">
              <button
                id="admin-filter-all"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'all' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Todos
              </button>
              <button
                id="admin-filter-pending"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'pending' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Pendentes
              </button>
              <button
                id="admin-filter-synced"
                onClick={() => setFilterStatus('synced')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'synced' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Sincronizados
              </button>
              <button
                id="admin-filter-failed"
                onClick={() => setFilterStatus('failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'failed' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Erro
              </button>
              <button
                id="admin-filter-not-registered"
                onClick={() => setFilterStatus('not_registered_device')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'not_registered_device' ? 'bg-purple-600 text-white shadow-lg shadow-purple-650/15' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Não Cadastrados (Aparelho)
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="my-4 relative grid grid-cols-1 select-none">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              id="admin-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, apartamento ou bloco..."
              className="w-full pl-9 pr-4 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-650 font-sans"
            />
          </div>

          {/* TABLE CONTAINER */}
          <div className="flex-1 overflow-x-auto select-text">
            {loading ? (
              <div className="py-12 text-center text-zinc-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold" />
                Carregando registros...
              </div>
            ) : displayResidents.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Nenhum morador encontrado com o filtro selecionado.
              </div>
            ) : filterStatus === 'not_registered_device' ? (
              <div id="admin-not-registered-split-view" className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 select-text">
                {/* LEFT COLUMN: GROUPED LISTS BY APARTMENT IN ASCENDING ORDER */}
                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>Moradores Faltando Cadastro ({displayResidents.length})</span>
                  </div>
                  
                  {(() => {
                    const groupedByApartment: { [apt: string]: Resident[] } = {};
                    displayResidents.forEach(res => {
                      const key = `Apto ${res.apartment}${res.block && res.block !== 'Único' ? ` / Bloco ${res.block}` : ''}`;
                      if (!groupedByApartment[key]) {
                        groupedByApartment[key] = [];
                      }
                      groupedByApartment[key].push(res);
                    });

                    return Object.entries(groupedByApartment).map(([aptKey, residentsList]) => (
                      <div key={aptKey} className="bg-dark-input/20 border border-dark-border/40 p-3 rounded-xl space-y-2">
                        <h4 className="text-xs font-semibold text-gold font-display flex items-center gap-1 border-b border-dark-border/30 pb-1">
                          <Building size={12} /> {aptKey}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {residentsList.map((res) => (
                            <button
                              key={res.id}
                              onClick={() => setSelectedNotRegisteredResident(res)}
                              className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer border ${selectedNotRegisteredResident?.id === res.id ? 'bg-purple-600/15 border-purple-500/40 text-white' : 'hover:bg-dark-hover/70 text-zinc-350 border-transparent'}`}
                            >
                              <span className="font-semibold font-display truncate">{res.name}</span>
                              <ChevronRight size={13} className={selectedNotRegisteredResident?.id === res.id ? 'text-purple-400' : 'text-zinc-600'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* RIGHT COLUMN: PREVIEW & DETAILS CARD */}
                <div>
                  {selectedNotRegisteredResident ? (
                    <div className="bg-dark-input/20 border border-dark-border rounded-xl p-5 space-y-5 sticky top-2">
                      <div className="text-center">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-950/40 border border-purple-900/50 px-3 py-1 rounded-full">
                          Ficha de Cadastro Manual
                        </span>
                      </div>

                      {/* Photo preview with scanlines overlay */}
                      <div className="relative aspect-square w-44 mx-auto rounded-xl overflow-hidden border border-purple-500/30 bg-black flex items-center justify-center group shadow-xl shadow-black/50">
                        <img
                          src={selectedNotRegisteredResident.photoDataUrl}
                          alt={selectedNotRegisteredResident.name}
                          className="w-full h-full object-cover scale-x-[-1]"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      </div>

                      <div className="space-y-3.5 text-center">
                        <div>
                          <h3 className="font-display font-bold text-white text-base leading-snug">{selectedNotRegisteredResident.name}</h3>
                          <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mt-1">
                            Apto {selectedNotRegisteredResident.apartment} {selectedNotRegisteredResident.block && selectedNotRegisteredResident.block !== 'Único' ? `— Bloco ${selectedNotRegisteredResident.block}` : ''}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-zinc-950/40 rounded-lg text-left text-[11px] text-zinc-400 leading-relaxed font-sans space-y-1.5 border border-dark-border/30">
                          <p className="font-semibold text-zinc-300">Como finalizar o cadastro facial físico:</p>
                          <ol className="list-decimal pl-4 space-y-1">
                            <li>Baixe a foto facial do morador clicando abaixo;</li>
                            <li>Importe-a na memória ou software do leitor de reconhecimento facial físico;</li>
                            <li>Após cadastrar, marque como finalizado para remover o morador desta pendência.</li>
                          </ol>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1 select-none">
                        <button
                          onClick={() => handleDownloadPhoto(selectedNotRegisteredResident)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20 font-display"
                        >
                          <Download size={14} /> Baixar Foto do Morador
                        </button>
                        <button
                          onClick={() => handleToggleDeviceRegistered(selectedNotRegisteredResident.id, false)}
                          className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/20 font-display"
                        >
                          <CheckCircle2 size={14} /> Confirmar Cadastro no Aparelho
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-dark-border rounded-xl flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                      <ShieldAlert size={36} className="text-zinc-600 mb-2" />
                      <p className="text-xs font-display">Selecione um morador na lista para visualizar a ficha de cadastro manual.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider">
                    <th className="py-3 px-2">Morador</th>
                    <th className="py-3 px-2">Unidade</th>
                    <th className="py-3 px-2">Facial</th>
                    <th className="py-3 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {displayResidents.map((resident) => (
                    <tr key={resident.id} className="hover:bg-dark-hover/40 text-xs transition-colors">
                      <td className="py-3 px-2 font-medium text-zinc-100 font-display">
                        {resident.name}
                      </td>
                      <td className="py-3 px-2 text-zinc-400 font-mono text-[11px]">
                        Apto {resident.apartment} {resident.block && resident.block !== 'Único' ? `/ ${resident.block}` : ''}
                      </td>
                      <td className="py-3 px-2">
                        {resident.photoDataUrl ? (
                          <div className="flex flex-col gap-1 select-none">
                            <div className="flex items-center gap-1">
                              {resident.syncStatus === 'synced' ? (
                                <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] rounded-full font-semibold flex items-center gap-0.5 uppercase tracking-wide">
                                  <CheckCircle2 size={10} /> Sincronizado
                                </span>
                              ) : resident.syncStatus === 'failed' ? (
                                <span className="px-2 py-0.5 bg-red-950/40 text-red-100 border border-red-900/35 text-[10px] rounded-full font-semibold flex items-center gap-0.5 uppercase tracking-wide" title={resident.syncError}>
                                  <AlertCircle size={10} /> Erro Drive
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-900/30 text-[10px] rounded-full font-semibold flex items-center gap-0.5 uppercase tracking-wide">
                                  <Clock size={10} /> Pendente
                                </span>
                              )}
                            </div>
                            
                            {/* Physical hardware device facial reader status details */}
                            <div className="flex items-center">
                              {resident.deviceRegistered ? (
                                <button
                                  onClick={() => handleToggleDeviceRegistered(resident.id, true)}
                                  className="text-[9px] text-emerald-400 hover:text-amber-400 bg-emerald-950/10 hover:bg-amber-950/20 border border-emerald-900/15 hover:border-amber-900/25 rounded px-1.5 py-0.5 transition-all font-semibold uppercase flex items-center gap-0.5 cursor-pointer leading-none"
                                  title="Clique para reverter para pendente no leitor facial físico"
                                >
                                  ✔ Aparelho OK
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleDeviceRegistered(resident.id, false)}
                                  className="text-[9px] bg-purple-950/30 hover:bg-purple-900/40 text-purple-400 border border-purple-900/20 hover:border-purple-500/30 rounded px-1.5 py-0.5 transition-all font-semibold uppercase flex items-center gap-0.5 cursor-pointer leading-none"
                                  title="Clique para marcar como cadastrado no leitor facial físico"
                                >
                                  ✖ Pendente Aparelho
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded-full font-medium uppercase tracking-wide select-none">
                            Sem Foto
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right select-none">
                        <div className="inline-flex items-center gap-1.5">
                          {resident.photoDataUrl && (
                            <button
                              id={`admin-view-photo-${resident.id}`}
                              onClick={() => setPreviewPhoto({ name: resident.name, url: resident.photoDataUrl! })}
                              className="p-1 px-2.5 bg-dark-input hover:bg-dark-hover border border-dark-border rounded-lg text-zinc-300 font-medium cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-display"
                            >
                              <Eye size={12} /> Ver
                            </button>
                          )}
                          <button
                            id={`admin-delete-res-${resident.id}`}
                            onClick={() => handleDeleteResident(resident.id, resident.name)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {adminSubTab === 'reservas' && (
        <ReservationSection resident={null} isAdmin={true} />
      )}

      {adminSubTab === 'funcionarios' && (
        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-white text-base">Funcionários Cadastrados</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Gerencie as contas dos funcionários (porteiros) autorizados a acessar a portaria física e receber encomendas.
                </p>
              </div>
            </div>

            {employeeError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-900/40 text-red-400 text-xs rounded-xl font-medium">
                {employeeError}
              </div>
            )}

            {employeeSuccess && (
              <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs rounded-xl font-medium">
                {employeeSuccess}
              </div>
            )}

            {/* Form to add employee */}
            <form onSubmit={handleAddEmployee} className="mt-6 p-4 bg-dark-input/50 border border-dark-border/60 rounded-xl space-y-4">
              <h4 className="text-xs font-bold font-display text-zinc-300 uppercase tracking-wider">Cadastrar Novo Funcionário</h4>
              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Nome do Funcionário *</label>
                  <input
                    type="text"
                    required
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="Ex: Porteiro Silva"
                    className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 text-white placeholder-zinc-600"
                  />
                </div>
                <div className="flex items-end select-none">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-gold/10 cursor-pointer"
                  >
                    Salvar Cadastro
                  </button>
                </div>
              </div>
            </form>

            {/* List Employees */}
            <div className="mt-6 border border-dark-border rounded-xl overflow-hidden bg-dark-input/20">
              {loadingEmployees && employees.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin text-gold font-bold">...</div>
                  <p>Buscando funcionários cadastrados...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-dark-input border-b border-dark-border text-zinc-400 font-semibold font-display tracking-tight text-[11px] select-none uppercase font-mono">
                        <th className="py-3 px-4">Foto</th>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-dark-hover/30 transition-colors">
                          <td className="py-3.5 px-4 w-12">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-lg bg-dark-input border border-dark-border overflow-hidden flex items-center justify-center">
                                {emp.photoDataUrl ? (
                                  <img src={emp.photoDataUrl} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Users size={16} className="text-zinc-600" />
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-display font-semibold text-white">
                            {emp.name}
                            {emp.needsPasswordSet && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] rounded font-mono uppercase">Sem Senha</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                             <button
                               type="button"
                               onClick={() => setResettingEmployeeId(emp.id)}
                               className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent text-[11px] font-semibold rounded-lg transition-all cursor-pointer font-sans"
                             >
                               Resetar Senha
                             </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteEmployee(emp.id)}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-[11px] font-semibold rounded-lg transition-all cursor-pointer font-sans"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-12 text-center text-zinc-500 text-xs font-sans">
                            Nenhum funcionário cadastrado no sistema.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {adminSubTab === 'calendario' && (
        <ReservationCalendar reservations={reservations} />
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL OVERLAY */}
      <AnimatePresence>
        {deletingResidentId && (
          <motion.div
            id="admin-delete-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setDeletingResidentId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <ShieldAlert size={28} />
                <h3 className="font-display font-bold text-lg text-white">Confirmar Exclusão</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente excluir o morador permanentemente? Esta ação apagará também suas fotos e reservas associadas de forma irreversível.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setDeletingResidentId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  id="admin-confirm-delete-btn"
                  onClick={() => confirmDeleteResident(deletingResidentId)}
                  className="px-4 py-2 bg-red-650 hover:bg-red-600 border border-red-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  <Trash2 size={13} /> Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {deletingEmployeeId && (
          <motion.div
            id="admin-delete-employee-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setDeletingEmployeeId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <ShieldAlert size={28} />
                <h3 className="font-display font-bold text-lg text-white">Confirmar Exclusão</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente excluir este funcionário permanentemente? Esta ação é irreversível.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setDeletingEmployeeId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDeleteEmployee(deletingEmployeeId)}
                  className="px-4 py-2 bg-red-650 hover:bg-red-600 border border-red-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  <Trash2 size={13} /> Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {resettingEmployeeId && (
          <motion.div
            id="admin-reset-password-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setResettingEmployeeId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-blue-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-blue-400">
                <RotateCcw size={28} />
                <h3 className="font-display font-bold text-lg text-white">Resetar Senha</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente resetar a senha deste funcionário? Ele deverá escolher uma nova senha ao entrar no sistema.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setResettingEmployeeId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleResetEmployeePassword(resettingEmployeeId)}
                  className="px-4 py-2 bg-blue-650 hover:bg-blue-600 border border-blue-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  Confirmar Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHOTO PREVIEW MODAL OVERLAY */}
      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            id="admin-photo-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-3 right-3 z-10">
                <button
                  id="admin-modal-close"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-2 bg-black/75 text-white hover:bg-black rounded-full cursor-pointer transition-colors border border-white/5"
                >
                  <RefreshCw size={14} className="rotate-45" />
                </button>
              </div>

              <div className="aspect-square relative bg-neutral-900 flex items-center justify-center">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.name}
                  className="w-full h-full object-cover scale-x-[-1]"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-5 select-text">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-gold" />
                  <h4 className="font-display font-semibold text-zinc-300 text-sm">Validado por Cadastro Facial</h4>
                </div>
                <h3 className="font-display font-bold text-white text-lg mt-2 truncate">{previewPhoto.name}</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">FOTO REGISTRADA EM TEMPO REAL</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
