/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface HikvisionResident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  photoDataUrl?: string;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
}

// Gera o header de autenticação Basic
function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

// Base URL do dispositivo
function deviceBaseUrl(device: HikvisionDevice): string {
  return `http://${device.deviceIp}:${device.port}`;
}

// Extrai base64 puro de um data URL
function extractBase64(dataUrl: string): { mime: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

// Testa conexão com o terminal Hikvision
export async function testHikvisionConnection(
  device: HikvisionDevice
): Promise<{ success: boolean; error?: string; deviceInfo?: any }> {
  try {
    const url = `${deviceBaseUrl(device)}/ISAPI/System/deviceInfo`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: basicAuth(device.username, device.password),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401) {
      return { success: false, error: 'Credenciais inválidas (401)' };
    }
    if (!response.ok) {
      return { success: false, error: `Erro HTTP ${response.status}` };
    }

    let deviceInfo: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      deviceInfo = await response.json();
    } else {
      const text = await response.text();
      // Parse XML básico para pegar nome do dispositivo
      const modelMatch = text.match(/<deviceName>([^<]+)<\/deviceName>/);
      const serialMatch = text.match(/<serialNumber>([^<]+)<\/serialNumber>/);
      deviceInfo = {
        deviceName: modelMatch?.[1] || 'Dispositivo Hikvision',
        serialNumber: serialMatch?.[1] || 'N/A',
      };
    }

    return { success: true, deviceInfo };
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return { success: false, error: 'Timeout: dispositivo não respondeu em 8s' };
    }
    return { success: false, error: err.message || 'Falha de conexão' };
  }
}

// Sincroniza uma face de morador com um terminal Hikvision
// Usa a ISAPI ACS do Hikvision: cria/atualiza pessoa e envia foto
export async function syncFaceToHikvision(
  resident: HikvisionResident,
  device: HikvisionDevice
): Promise<{ success: boolean; error?: string }> {
  if (!resident.photoDataUrl) {
    return { success: false, error: 'Morador não possui foto cadastrada' };
  }

  const photoData = extractBase64(resident.photoDataUrl);
  if (!photoData) {
    return { success: false, error: 'Formato de foto inválido' };
  }

  const base = deviceBaseUrl(device);
  const authHeader = basicAuth(device.username, device.password);
  const headers = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // ID único derivado do ID do morador (Hikvision aceita até 32 chars alfanuméricos)
  const personId = resident.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);

  try {
    // 1. Cria ou atualiza a pessoa no controle de acesso
    const personPayload = {
      UserInfo: {
        employeeNo: personId,
        name: resident.name.substring(0, 32),
        userType: 'normal',
        Valid: { enable: true, beginTime: '2000-01-01T00:00:00', endTime: '2037-12-31T23:59:59' },
        localUIRight: false,
        maxOpenDoorTime: 0,
        openDoorTime: 5,
        roomNumber: resident.apartment,
        floorNumber: 0,
      },
    };

    const personRes = await fetch(`${base}/ISAPI/AccessControl/UserInfo/Record?format=json`, {
      method: 'POST',
      headers,
      body: JSON.stringify(personPayload),
      signal: AbortSignal.timeout(15000),
    });

    // 404 ou 400 significa pessoa não existe ainda — tenta criar
    // 200/201 → criado/atualizado com sucesso
    if (!personRes.ok && personRes.status !== 400) {
      const errText = await personRes.text();
      // Se erro for "record already exists" (statusCode 6), tudo bem — segue
      if (!errText.includes('"statusCode": 6') && !errText.includes('"statusCode":6')) {
        return { success: false, error: `Erro ao criar pessoa: HTTP ${personRes.status}` };
      }
    }

    // 2. Envia a foto para o serviço de reconhecimento facial
    const facePayload = {
      FaceInfo: {
        employeeNo: personId,
        faceLibType: 'blackFD',
        faceURL: '',
        faceData: photoData.data,
      },
    };

    const faceRes = await fetch(`${base}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`, {
      method: 'POST',
      headers,
      body: JSON.stringify(facePayload),
      signal: AbortSignal.timeout(20000),
    });

    if (!faceRes.ok) {
      const errText = await faceRes.text();
      return { success: false, error: `Erro ao enviar foto facial: HTTP ${faceRes.status} - ${errText.substring(0, 100)}` };
    }

    return { success: true };
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return { success: false, error: 'Timeout ao sincronizar com o terminal' };
    }
    return { success: false, error: err.message || 'Erro desconhecido na sincronização Hikvision' };
  }
}

// Deleta uma face do terminal (para quando morador é removido)
export async function deleteFaceFromHikvision(
  residentId: string,
  device: HikvisionDevice
): Promise<{ success: boolean; error?: string }> {
  const base = deviceBaseUrl(device);
  const authHeader = basicAuth(device.username, device.password);
  const personId = residentId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);

  try {
    const res = await fetch(`${base}/ISAPI/AccessControl/UserInfo/Delete?format=json`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ UserDelCond: { EmployeeNoList: [{ employeeNo: personId }] } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao deletar face' };
  }
}
