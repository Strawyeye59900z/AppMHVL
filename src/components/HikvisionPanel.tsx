/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Plus, Trash2, Edit, CheckCircle, AlertCircle, Wifi, WifiOff,
  RefreshCw, Loader, Eye, EyeOff, Shield, ToggleLeft, ToggleRight, Monitor
} from 'lucide-react';

interface HikvisionDevice {
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

interface ResidentSyncInfo {
  id: string;
  name: string;
  apartment: string;
  block: string;
  hasPhoto: boolean;
  hikvisionSyncStatus: Record<string, { status: string; syncedAt?: string; error?: string }>;
}

type PanelTab = 'devices' | 'status';

export default function HikvisionPanel() {
  const [tab, setTab] = useState<PanelTab>('devices');
  const [devices, setDevices] = useState<HikvisionDevice[]>([]);
  const [residents, setResidents] = useState<ResidentSyncInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<HikvisionDevice | null>(null);
  const [formData, setFormData] = useState({ name: '', deviceIp: '', port: '80', username: 'admin', password: '', enabled: true });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, statusRes] = await Promise.all([
        fetch('/api/hikvision/devices'),
        fetch('/api/hikvision/sync-status'),
      ]);
      if (devRes.ok) setDevices(await devRes.ok ? await devRes.json() : []);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setResidents(data.residents || []);
      }
    } catch (err) {
      console.error('Failed to load Hikvision data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingDevice(null);
    setFormData({ name: '', deviceIp: '', port: '80', username: 'admin', password: '', enabled: true });
    setShowForm(true);
  };

  const openEditForm = (device: HikvisionDevice) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      deviceIp: device.deviceIp,
      port: String(device.port),
      username: device.username,
      password: '***configured***',
      enabled: device.enabled,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = editingDevice ? `/api/hikvision/devices/${editingDevice.id}` : '/api/hikvision/devices';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, port: Number(formData.port) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      setSuccess(editingDevice ? 'Dispositivo atualizado!' : 'Dispositivo adicionado!');
      setTimeout(() => setSuccess(''), 3000);
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja remover este terminal Hikvision?')) return;
    try {
      const res = await fetch(`/api/hikvision/devices/${id}/delete`, { method: 'POST' });
      if (res.ok) {
        setSuccess('Dispositivo removido.');
        setTimeout(() => setSuccess(''), 3000);
        loadData();
      }
    } catch (err) {
      setError('Erro ao remover dispositivo.');
    }
  };

  const handleTestConnection = async (device: HikvisionDevice) => {
    setTestingId(device.id);
    try {
      const res = await fetch('/api/hikvision/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id }),
      });
      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        [device.id]: res.ok
          ? { ok: true, msg: `✅ ${data.deviceName || 'Conectado'}` }
          : { ok: false, msg: `❌ ${data.error || 'Falha'}` },
      }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [device.id]: { ok: false, msg: `❌ ${err.message}` } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncResident = async (residentId: string, deviceId?: string) => {
    setSyncingId(residentId + (deviceId || ''));
    setError('');
    try {
      const res = await fetch('/api/hikvision/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na sincronização.');
      setSuccess('Sincronização concluída!');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const getOverallStatus = (resident: ResidentSyncInfo) => {
    if (!resident.hasPhoto) return 'no-photo';
    if (devices.filter(d => d.enabled).length === 0) return 'no-devices';
    const enabledDeviceIds = devices.filter(d => d.enabled).map(d => d.id);
    const statuses = enabledDeviceIds.map(id => resident.hikvisionSyncStatus[id]?.status || 'pending');
    if (statuses.every(s => s === 'synced')) return 'synced';
    if (statuses.some(s => s === 'failed')) return 'failed';
    return 'pending';
  };

  const statusCounts = {
    synced: residents.filter(r => getOverallStatus(r) === 'synced').length,
    pending: residents.filter(r => ['pending', 'no-devices'].includes(getOverallStatus(r)) && r.hasPhoto).length,
    failed: residents.filter(r => getOverallStatus(r) === 'failed').length,
    noPhoto: residents.filter(r => !r.hasPhoto).length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/15">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Terminais Hikvision</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Reconhecimento Facial · Múltiplos Terminais</p>
            </div>
          </div>
          <button
            onClick={() => loadData()}
            className="p-2 text-zinc-400 hover:text-white bg-dark-input border border-dark-border rounded-lg transition-all cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-input rounded-xl p-1 border border-dark-border/40">
          {(['devices', 'status'] as PanelTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 px-3 text-[11px] font-semibold rounded-lg transition-all cursor-pointer font-display ${
                tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'devices' ? '⚙️ Gerenciar Terminais' : '📊 Status de Sincronização'}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="p-3.5 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle size={15} className="shrink-0" />{success}
        </div>
      )}

      {/* ============ TAB: DEVICES ============ */}
      {tab === 'devices' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">Terminais Configurados</h3>
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all"
            >
              <Plus size={14} /> Adicionar Terminal
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-dark-border rounded-2xl">
              <Monitor size={30} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-xs text-zinc-500 font-mono">Nenhum terminal configurado.</p>
              <p className="text-[10px] text-zinc-600 mt-1">Clique em "Adicionar Terminal" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <div key={device.id} className="border border-dark-border/60 rounded-xl p-4 bg-dark-input/30 hover:border-dark-border transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${device.enabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-display">{device.name}</span>
                          {!device.enabled && (
                            <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-bold rounded uppercase tracking-wider">Inativo</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{device.deviceIp}:{device.port} · {device.username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {testResults[device.id] && (
                        <span className={`text-[10px] font-mono ${testResults[device.id].ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          {testResults[device.id].msg}
                        </span>
                      )}
                      <button
                        onClick={() => handleTestConnection(device)}
                        disabled={testingId === device.id}
                        className="px-2.5 py-1.5 bg-dark-input border border-dark-border hover:bg-dark-hover text-zinc-400 hover:text-white text-[10px] font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {testingId === device.id ? <Loader size={11} className="animate-spin" /> : <Wifi size={11} />}
                        Testar
                      </button>
                      <button
                        onClick={() => openEditForm(device)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(device.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowForm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-white">
                      {editingDevice ? 'Editar Terminal' : 'Novo Terminal Hikvision'}
                    </h3>
                    <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white text-lg cursor-pointer">✕</button>
                  </div>

                  <form onSubmit={handleSave} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Nome do Terminal</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ex: Terminal Entrada Principal"
                        required
                        className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">IP do Dispositivo</label>
                        <input
                          type="text"
                          value={formData.deviceIp}
                          onChange={e => setFormData(p => ({ ...p, deviceIp: e.target.value }))}
                          placeholder="192.168.1.100"
                          required
                          className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Porta</label>
                        <input
                          type="number"
                          value={formData.port}
                          onChange={e => setFormData(p => ({ ...p, port: e.target.value }))}
                          placeholder="80"
                          className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Usuário</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                          placeholder="admin"
                          required
                          className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Senha</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                            placeholder="••••••"
                            required={!editingDevice}
                            className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 pr-8 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                            {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, enabled: !p.enabled }))}
                        className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${formData.enabled ? 'text-emerald-400' : 'text-zinc-500'}`}
                      >
                        {formData.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {formData.enabled ? 'Terminal Ativo' : 'Terminal Inativo'}
                      </button>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-xs text-zinc-400 border border-dark-border rounded-xl cursor-pointer hover:bg-dark-hover">Cancelar</button>
                      <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
                        {saving ? 'Salvando...' : editingDevice ? 'Salvar Alterações' : 'Adicionar Terminal'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ============ TAB: STATUS ============ */}
      {tab === 'status' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Sincronizados', value: statusCounts.synced, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15' },
              { label: 'Pendentes', value: statusCounts.pending, color: 'text-amber-400 bg-amber-500/10 border-amber-500/15' },
              { label: 'Com Erro', value: statusCounts.failed, color: 'text-red-400 bg-red-500/10 border-red-500/15' },
              { label: 'Sem Foto', value: statusCounts.noPhoto, color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/15' },
            ].map(stat => (
              <div key={stat.label} className={`rounded-2xl border p-4 text-center ${stat.color}`}>
                <div className="text-2xl font-bold font-display">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest font-mono mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Residents Table */}
          <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Moradores · Sincronização Facial</h3>
              <button
                onClick={loadData}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Atualizar
              </button>
            </div>

            {residents.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-600 font-mono">Nenhum morador cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-dark-input/50">
                    <tr className="border-b border-dark-border text-[10px] text-zinc-500 font-bold font-mono uppercase tracking-widest">
                      <th className="py-3 px-4">Morador</th>
                      <th className="py-3 px-4">Foto</th>
                      {devices.slice(0, 4).map(d => (
                        <th key={d.id} className="py-3 px-4 whitespace-nowrap">{d.name}</th>
                      ))}
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/40">
                    {residents.map(resident => {
                      const overall = getOverallStatus(resident);
                      return (
                        <tr key={resident.id} className="hover:bg-dark-hover/20 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-bold text-white">{resident.name}</span>
                              <span className="text-[10px] text-zinc-500 block font-mono">
                                Apto {resident.apartment}{resident.block !== 'Único' ? ` / ${resident.block}` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {resident.hasPhoto
                              ? <span className="text-emerald-400 text-[10px] font-mono">✓ Sim</span>
                              : <span className="text-zinc-600 text-[10px] font-mono">✗ Não</span>}
                          </td>
                          {devices.slice(0, 4).map(device => {
                            const s = resident.hikvisionSyncStatus[device.id];
                            return (
                              <td key={device.id} className="py-3 px-4 whitespace-nowrap">
                                {!resident.hasPhoto ? (
                                  <span className="text-zinc-600 text-[10px] font-mono">—</span>
                                ) : s?.status === 'synced' ? (
                                  <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                                    <CheckCircle size={10} /> Sync
                                  </span>
                                ) : s?.status === 'failed' ? (
                                  <span className="text-red-400 text-[10px] font-mono flex items-center gap-1" title={s.error}>
                                    <AlertCircle size={10} /> Erro
                                  </span>
                                ) : (
                                  <span className="text-amber-400 text-[10px] font-mono">Pendente</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right">
                            {resident.hasPhoto && (
                              <button
                                onClick={() => handleSyncResident(resident.id)}
                                disabled={syncingId === resident.id || !devices.some(d => d.enabled)}
                                className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/20 text-blue-400 text-[10px] font-semibold rounded-lg cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1"
                              >
                                {syncingId === resident.id ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                Sincronizar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
