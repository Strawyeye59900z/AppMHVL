import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, UserPlus, Trash2, RefreshCw, Send, Copy, Check, AlertCircle, Clock, CheckCircle, User } from 'lucide-react';
import { Resident, ServiceProvider } from '../types';

interface ServiceProvidersTabProps {
  resident: Resident;
}

const DURATION_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '1 mês' },
  { value: '90d', label: '3 meses' },
  { value: '180d', label: '6 meses' },
  { value: '365d', label: '1 ano' },
];

export default function ServiceProvidersTab({ resident }: ServiceProvidersTabProps) {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Invite form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [accessDuration, setAccessDuration] = useState('30d');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // After invite is created
  const [inviteResult, setInviteResult] = useState<{ url: string; providerName: string; accessDuration: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [waError, setWaError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ServiceProvider | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/providers?residentId=${resident.id}`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      } else {
        setError('Erro ao carregar prestadores.');
      }
    } catch {
      setError('Falha de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serviceType.trim()) {
      setFormError('Nome e tipo de serviço são obrigatórios.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/providers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: resident.id,
          name: name.trim(),
          serviceType: serviceType.trim(),
          accessDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar convite.');
      setInviteResult({ url: data.registrationUrl, providerName: name.trim(), accessDuration });
      setName('');
      setServiceType('');
      setPhone('');
      setAccessDuration('30d');
      setShowForm(false);
      fetchProviders();
    } catch (err: any) {
      setFormError(err.message || 'Falha de conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendWhatsApp = async () => {
    if (!inviteResult || !phone.trim()) {
      setWaError('Digite o número do WhatsApp do prestador.');
      return;
    }
    setSendingWa(true);
    setWaError('');
    try {
      const res = await fetch('/api/providers/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          providerName: inviteResult.providerName,
          residentName: resident.name,
          apartment: resident.apartment,
          registrationUrl: inviteResult.url,
          accessDuration: inviteResult.accessDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      setWaSent(true);
    } catch (err: any) {
      setWaError(err.message || 'Falha ao enviar WhatsApp.');
    } finally {
      setSendingWa(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/providers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchProviders();
      }
    } catch {
      // silently ignore
    }
  };

  const statusBadge = (p: ServiceProvider) => {
    const expired = new Date(p.accessExpiry) < new Date();
    if (expired || p.status === 'expired') {
      return <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider font-mono">Expirado</span>;
    }
    if (p.status === 'registered') {
      return <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" />Ativo</span>;
    }
    return <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-0.5"><Clock size={9} />Aguardando foto</span>;
  };

  return (
    <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-6 text-left space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-white flex items-center gap-2">
            <Briefcase size={14} className="text-gold" /> Prestadores de Serviço
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Cadastre personal, empregada, etc. para acesso facial ao condomínio.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(''); setInviteResult(null); setWaSent(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-yellow-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0"
        >
          <UserPlus size={12} /> Convidar
        </button>
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={handleInvite}
          >
            <div className="bg-dark-input border border-dark-border/50 rounded-xl p-4 space-y-3">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Novo Convite</p>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-mono">Nome completo do prestador</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  required
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-mono">Tipo de serviço</label>
                <input
                  type="text"
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value)}
                  placeholder="Ex: Empregada doméstica, Personal trainer..."
                  required
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-mono">Duração do acesso</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAccessDuration(opt.value)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        accessDuration === opt.value
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'bg-dark-card border-dark-border text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-[10px] text-red-400">
                  <AlertCircle size={11} /> {formError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-dark-card border border-dark-border text-zinc-400 text-xs font-semibold rounded-lg hover:bg-dark-hover transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-gold hover:bg-yellow-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Gerando...' : 'Gerar Link'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Invite result — link sharing */}
      <AnimatePresence>
        {inviteResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle size={14} />
              <span className="text-xs font-bold">Link de cadastro gerado!</span>
            </div>

            {/* Link copy */}
            <div className="bg-dark-card border border-dark-border/60 rounded-lg p-2.5 flex items-center gap-2">
              <p className="text-[10px] text-zinc-400 font-mono truncate flex-1">{inviteResult.url}</p>
              <button
                onClick={copyLink}
                className="shrink-0 px-2 py-1 bg-dark-input hover:bg-dark-hover border border-dark-border rounded text-[10px] font-bold text-zinc-300 cursor-pointer flex items-center gap-1 transition-all"
              >
                {copied ? <><Check size={10} className="text-emerald-400" /> Copiado</> : <><Copy size={10} /> Copiar</>}
              </button>
            </div>

            {/* WhatsApp send */}
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 font-mono">Enviar via WhatsApp (número do prestador)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 9 9999-9999"
                  className="flex-1 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                />
                <button
                  onClick={sendWhatsApp}
                  disabled={sendingWa || waSent}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  {sendingWa ? <RefreshCw size={11} className="animate-spin" /> : waSent ? <Check size={11} /> : <Send size={11} />}
                  {waSent ? 'Enviado!' : 'Enviar'}
                </button>
              </div>
              {waError && <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{waError}</p>}
              {waSent && <p className="text-[10px] text-emerald-400">WhatsApp enviado com sucesso!</p>}
            </div>

            <button
              onClick={() => setInviteResult(null)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer underline"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Providers list */}
      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1.5 p-3 bg-red-950/20 border border-red-900/20 rounded-xl">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading && providers.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2 text-zinc-500 text-xs">
          <RefreshCw size={16} className="animate-spin text-gold" /> Carregando...
        </div>
      ) : providers.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 text-xs bg-dark-input/30 border border-dark-border/40 rounded-xl">
          Nenhum prestador cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {providers.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2.5 bg-dark-input/60 border border-dark-border/35 rounded-xl gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full border border-dark-border flex items-center justify-center shrink-0 overflow-hidden bg-neutral-900">
                  {p.photoDataUrl ? (
                    <img src={p.photoDataUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={14} className="text-zinc-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{p.name}</h4>
                  <p className="text-[10px] text-zinc-500 truncate">{p.serviceType}</p>
                  <div className="mt-1">{statusBadge(p)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.status === 'pending' && new Date(p.accessExpiry) >= new Date() && (
                  <span className="text-[8px] text-zinc-500 font-mono text-right leading-tight">
                    Link<br />expira em<br />{Math.max(0, Math.ceil((new Date(p.tokenExpiry ?? p.accessExpiry).getTime() - Date.now()) / 3600000))}h
                  </span>
                )}
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/10 rounded-lg cursor-pointer transition-all"
                  title="Remover prestador"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-red-400">
                <Trash2 size={20} />
                <h3 className="font-display font-bold text-base text-white">Remover Prestador</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Deseja remover <strong>{deleteTarget.name}</strong>? O acesso facial será cancelado.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.id)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
