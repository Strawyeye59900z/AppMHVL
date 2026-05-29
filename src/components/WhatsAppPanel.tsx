/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Save, TestTube, CheckCircle, AlertCircle, Eye, EyeOff, ToggleLeft, ToggleRight, Info } from 'lucide-react';

interface WhatsAppConfig {
  enabled: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  templateText: string;
}

const DEFAULT_TEMPLATE = `🏠 *Reserva Confirmada!*\n\nOlá, {morador}! Sua reserva no *{local}* foi confirmada com sucesso.\n\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n🏢 *Unidade:* {unidade}\n\nEm caso de dúvidas, entre em contato com a administração.`;

export default function WhatsAppPanel() {
  const [config, setConfig] = useState<WhatsAppConfig>({
    enabled: false,
    evolutionApiUrl: '',
    evolutionApiKey: '',
    instanceName: '',
    templateText: DEFAULT_TEMPLATE,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig(prev => ({ ...prev, ...data }));
        }
      }
    } catch (err) {
      console.error('Failed to load WhatsApp config:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleTest = async () => {
    if (!testPhone.trim()) {
      setError('Digite um número para testar.');
      return;
    }
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
    return (
      <div className="py-20 text-center text-xs text-zinc-500 font-mono">Carregando configurações...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/15">
              <MessageCircle size={20} />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Notificações WhatsApp</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Evolution API · Automático ao reservar</p>
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

        {/* Aviso sobre morador precisar de telefone */}
        <div className="mb-5 p-3 bg-blue-950/30 border border-blue-900/30 rounded-xl flex items-start gap-2">
          <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-300 leading-relaxed">
            As notificações são enviadas automaticamente ao número de telefone cadastrado do morador ao criar uma reserva.
            Certifique-se de que o morador possui um telefone cadastrado no sistema.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">URL da Evolution API</label>
              <input
                type="url"
                value={config.evolutionApiUrl}
                onChange={e => setConfig(prev => ({ ...prev, evolutionApiUrl: e.target.value }))}
                placeholder="http://localhost:8080"
                className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Nome da Instância</label>
              <input
                type="text"
                value={config.instanceName}
                onChange={e => setConfig(prev => ({ ...prev, instanceName: e.target.value }))}
                placeholder="minha-instancia"
                className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.evolutionApiKey}
                onChange={e => setConfig(prev => ({ ...prev, evolutionApiKey: e.target.value }))}
                placeholder="Sua API Key da Evolution API"
                className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 pr-10 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

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
            <p className="text-[9px] text-zinc-600 font-mono mt-1">Clique nas variáveis para inserir no template. Use *texto* para negrito no WhatsApp.</p>
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

      {/* Teste de envio */}
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
            disabled={testing || !config.evolutionApiUrl || !config.instanceName}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-dark-border text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <MessageCircle size={14} />
            {testing ? 'Enviando...' : 'Testar'}
          </button>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono mt-2">Salve as configurações antes de testar. O número precisa ter WhatsApp ativo.</p>
      </div>
    </div>
  );
}
