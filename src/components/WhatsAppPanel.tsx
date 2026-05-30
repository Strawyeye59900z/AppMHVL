/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Save, TestTube, CheckCircle, AlertCircle, ToggleLeft, ToggleRight, Info, QrCode, RefreshCw, LogOut, Wifi, WifiOff, Loader2 } from 'lucide-react';

type WAStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

interface WhatsAppConfig {
  enabled: boolean;
  templateText: string;
}

const DEFAULT_TEMPLATE = `🏠 *Reserva Confirmada!*\n\nOlá, {morador}! Sua reserva no *{local}* foi confirmada com sucesso.\n\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n🏢 *Unidade:* {unidade}\n\nEm caso de dúvidas, entre em contato com a administração.`;

const STATUS_LABELS: Record<WAStatus, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando...',
  qr: 'Aguardando QR Code',
  connected: 'Conectado',
};

const STATUS_COLORS: Record<WAStatus, string> = {
  disconnected: 'text-zinc-400 border-zinc-700 bg-zinc-800',
  connecting: 'text-yellow-400 border-yellow-800 bg-yellow-950/40',
  qr: 'text-blue-400 border-blue-800 bg-blue-950/40',
  connected: 'text-emerald-400 border-emerald-800 bg-emerald-950/40',
};

export default function WhatsAppPanel() {
  const [config, setConfig] = useState<WhatsAppConfig>({ enabled: false, templateText: DEFAULT_TEMPLATE });
  const [status, setStatus] = useState<WAStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, qrRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/qr'),
      ]);
      if (statusRes.ok) {
        const { status: s } = await statusRes.json();
        setStatus(s);
      }
      if (qrRes.ok) {
        const { qr } = await qrRes.json();
        setQrCode(qr || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/whatsapp/config').then(r => r.json()).then(d => d && setConfig(prev => ({ ...prev, ...d }))),
      loadStatus(),
    ]).finally(() => setLoading(false));
  }, [loadStatus]);

  // Polling sempre ativo: rápido durante transições, lento quando estável
  useEffect(() => {
    const delay = (status === 'connecting' || status === 'qr') ? 2000 : 8000;
    const interval = setInterval(loadStatus, delay);
    return () => clearInterval(interval);
  }, [status, loadStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar configuração.');
      setSuccess('Configuração salva com sucesso!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar.');
      setStatus('connecting');
      setTimeout(loadStatus, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setStatus('disconnected');
      setQrCode(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) { setError('Digite um número para testar.'); return; }
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no teste.');
      setSuccess('✅ Mensagem de teste enviada com sucesso!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const VARIABLES = ['{morador}', '{local}', '{data}', '{hora}', '{apartamento}', '{bloco}', '{unidade}'];

  if (loading) {
    return <div className="py-20 text-center text-xs text-zinc-500 font-mono">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Status + conexão */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/15">
              <MessageCircle size={20} />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Notificações WhatsApp</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Baileys · Automático ao reservar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              config.enabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800 border-dark-border text-zinc-500'
            }`}
          >
            {config.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {config.enabled ? 'Ativo' : 'Inativo'}
          </button>
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border mb-5 ${STATUS_COLORS[status]}`}>
          {status === 'connecting' && <Loader2 size={13} className="animate-spin" />}
          {status === 'connected' && <Wifi size={13} />}
          {status === 'disconnected' && <WifiOff size={13} />}
          {status === 'qr' && <QrCode size={13} />}
          {STATUS_LABELS[status]}
        </div>

        {/* QR Code */}
        {status === 'qr' && qrCode && (
          <div className="mb-5 flex flex-col items-center gap-3 p-5 bg-white rounded-2xl w-fit mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}`}
              alt="QR Code WhatsApp"
              className="w-[220px] h-[220px]"
            />
            <p className="text-[10px] text-zinc-500 font-mono text-center">Abra o WhatsApp → Aparelhos Conectados → Conectar um aparelho</p>
          </div>
        )}

        {status === 'qr' && !qrCode && (
          <div className="mb-5 flex items-center justify-center gap-2 p-5 bg-blue-950/20 border border-blue-900/30 rounded-xl">
            <Loader2 size={16} className="animate-spin text-blue-400" />
            <span className="text-xs text-blue-300 font-mono">Gerando QR Code...</span>
            <button onClick={loadStatus} className="ml-2 p-1 rounded text-blue-400 hover:text-blue-200">
              <RefreshCw size={13} />
            </button>
          </div>
        )}

        {/* Pairing Code */}
        {status === 'disconnected' ? (
          <div className="space-y-3">
            <p className="text-[10px] text-zinc-400 font-mono">Clique para gerar o QR Code e vincule pelo WhatsApp → Aparelhos Conectados → Conectar um aparelho.</p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              {connecting ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
              {connecting ? 'Aguarde...' : 'Gerar QR Code'}
            </button>
          </div>
        ) : status === 'connecting' ? (
          <button onClick={loadStatus} className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-bold rounded-xl cursor-pointer transition-all">
            <RefreshCw size={13} />Atualizar Status
          </button>
        ) : status === 'connected' ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-400 text-xs font-bold rounded-xl cursor-pointer transition-all"
          >
            <LogOut size={13} />Desconectar
          </button>
        ) : (
          <button onClick={loadStatus} className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-bold rounded-xl cursor-pointer transition-all">
            <RefreshCw size={13} />Atualizar Status
          </button>
        )}
      </div>

      {/* Configuração */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <h3 className="font-display text-sm font-bold text-white mb-4">Configurações</h3>

        {error && (
          <div className="mb-4 p-3.5 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle size={15} className="shrink-0" />{success}
          </div>
        )}

        <div className="mb-4 p-3 bg-blue-950/30 border border-blue-900/30 rounded-xl flex items-start gap-2">
          <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-300 leading-relaxed">
            As notificações são enviadas automaticamente ao número cadastrado do morador ao criar uma reserva.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Template da Mensagem</label>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, templateText: DEFAULT_TEMPLATE }))}
                className="text-[9px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              >
                Restaurar padrão
              </button>
            </div>
            <textarea
              value={config.templateText}
              onChange={e => setConfig(prev => ({ ...prev, templateText: e.target.value }))}
              rows={6}
              className="w-full bg-dark-input border border-dark-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 transition-all font-mono resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIABLES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, templateText: prev.templateText + v }))}
                  className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-dark-border rounded text-[10px] font-mono text-emerald-400 cursor-pointer transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </form>
      </div>

      {/* Teste */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
          <TestTube size={16} className="text-emerald-400" />
          Testar Notificação
        </h3>
        <div className="flex gap-3">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="11999998888 ou +5511999998888"
            className="flex-1 bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 transition-all"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || status !== 'connected'}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-dark-border text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <MessageCircle size={14} />
            {testing ? 'Enviando...' : 'Testar'}
          </button>
        </div>
        {status !== 'connected' && (
          <p className="text-[9px] text-zinc-600 font-mono mt-2">Conecte o WhatsApp primeiro para poder testar.</p>
        )}
      </div>
    </div>
  );
}
