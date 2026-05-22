/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Clock, CheckCircle, Plus, Search, LogOut, Check, Building, FileText, User } from 'lucide-react';

interface PackageItem {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  receivedBy?: string; // Who received it at the portaria
}

interface EmployeePanelProps {
  employee: { id: string; name: string } | null;
  onLogout: () => void;
}

export default function EmployeePanel({ employee, onLogout }: EmployeePanelProps) {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [apartment, setApartment] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [description, setDescription] = useState('');

  // Deliver modal state
  const [deliveringPackage, setDeliveringPackage] = useState<PackageItem | null>(null);
  const [recipientDeliveryName, setRecipientDeliveryName] = useState('');

  // Filter/Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('pending');

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await fetch('/api/residents');
      if (res.ok) {
        const data = await res.json();
        setResidents(data);
      }
    } catch (err) {
      console.error('Error fetching residents:', err);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchResidents();
    // Poll packages status every 10 seconds for real-time vibe
    const interval = setInterval(() => {
      fetchPackages();
      fetchResidents();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!apartment.trim() || !description.trim()) {
      setError('Por favor, digite o apartamento e a descrição da encomenda.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/packages/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartment: apartment.trim(),
          block: 'Único',
          recipientName: recipientName.trim() || 'Qualquer Morador',
          description: description.trim(),
          receivedBy: employee?.name || 'Portaria'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar os dados da encomenda.');
      }

      const newPkg = await response.json();
      setPackages((prev) => [newPkg, ...prev]);
      
      // Auto-trigger WhatsApp notification if possible
      const matchingResident = residents.find(
        r => r.apartment.toLowerCase() === apartment.trim().toLowerCase() && r.phone
      );

      if (matchingResident) {
        const messageText = `Olá, ${matchingResident.name}! Sua encomenda (${description.trim()}) acabou de chegar na portaria e está disponível para retirada.`;
        window.open(`https://wa.me/55${matchingResident.phone.replace(/\D/g, '')}?text=${encodeURIComponent(messageText)}`, '_blank');
        setSuccess('Encomenda registrada! Abrindo WhatsApp do morador...');
      } else {
        setSuccess('Sua encomenda foi cadastrada com sucesso!');
      }

      // Clear fields
      setApartment('');
      setRecipientName('');
      setDescription('');
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliverPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringPackage) return;

    try {
      const response = await fetch('/api/packages/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deliveringPackage.id,
          deliveredTo: recipientDeliveryName.trim() || 'Morador do apartamento',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao registrar a entrega.');
      }

      const result = await response.json();
      setPackages((prev) =>
        prev.map((p) => (p.id === deliveringPackage.id ? result.package : p))
      );
      
      setDeliveringPackage(null);
      setRecipientDeliveryName('');
      
      setSuccess('Entrega registrada com sucesso!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar entrega.');
    }
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccess('Texto da notificação copiado para a transferência!');
        setTimeout(() => setSuccess(''), 4000);
      })
      .catch((err) => {
        console.error('Failed to copy text:', err);
        setError('Erro ao copiar texto.');
      });
  };

  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.apartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.recipientName.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && pkg.status === statusFilter;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in text-left">
      {/* Top Banner section */}
      <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/10 shrink-0">
            <Package size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono">
                Portaria
              </span>
              <span className="text-[10px] text-zinc-500">•</span>
              <p className="text-xs text-zinc-400 font-medium">Operando Localmente</p>
            </div>
            <h2 className="font-display font-bold text-lg text-white mt-1">Controle de Portaria & Encomendas</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">Operador Atual: {employee?.name || 'Funcionário'}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-zinc-400 hover:text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
        >
          <LogOut size={14} /> Sair do Painel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Panel: 1/3 size */}
        <div className="lg:col-span-4 bg-dark-card border border-dark-border rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-display font-semibold text-white text-sm">Registrar Entrada de Encomenda</h3>
            <p className="text-xs text-zinc-500 mt-1">Preencha os detalhes da encomenda que acabou de chegar.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/40 text-red-400 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs rounded-xl font-medium flex items-center gap-1.5">
              <CheckCircle size={14} /> {success}
            </div>
          )}

          <form onSubmit={handleAddPackage} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Apartamento *</label>
              <input
                type="text"
                required
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder="Ex: 101"
                className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white placeholder-zinc-600 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Recebido por (Portaria)</label>
              <div className="w-full px-3.5 py-2.5 bg-dark-input/50 border border-dark-border rounded-xl text-xs text-zinc-400 font-sans italic">
                {employee?.name || 'Aguardando login'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Nome do Destinatário (Morador)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-600">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex: Maria Souza (ou deixe vazio)"
                  className="w-full pl-9 pr-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white placeholder-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Descrição / Pacote *</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Caixa pequena da Amazon, pacote do Mercado Livre, envelope dos Correios"
                className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white placeholder-zinc-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus size={14} /> {loading ? 'Cadastrando...' : 'Registrar Entrada'}
            </button>
          </form>
        </div>

        {/* Right Packages Logs list: 2/3 size */}
        <div className="lg:col-span-8 bg-dark-card border border-dark-border rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
            <div>
              <h3 className="font-display font-semibold text-white text-sm">Registro Geral de Encomendas</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Gerenciamento e baixa de encomendas dos condôminos.</p>
            </div>

            {/* Quick Stats count */}
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/10 text-[10px] font-mono rounded-lg">
                📋 {packages.filter(p => p.status === 'pending').length} aguardando retirada
              </span>
            </div>
          </div>

          {/* Search bar and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1 select-none">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por apto, morador ou descrição..."
                className="w-full pl-9 pr-4 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-blue-500 text-white placeholder-zinc-600"
              />
            </div>

            <div className="flex bg-dark-input border border-dark-border rounded-xl p-1 gap-1 select-none">
              {(['pending', 'delivered', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-display cursor-pointer transition-all ${
                    statusFilter === filter
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {filter === 'pending' ? 'Pendentes' : filter === 'delivered' ? 'Entregues' : 'Todas'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-dark-border rounded-xl overflow-hidden bg-dark-input/50">
            {filteredPackages.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <FileText size={28} className="text-zinc-600" />
                <p>Nenhuma encomenda cadastrada nesta seção.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-dark-input border-b border-dark-border text-zinc-400 font-semibold font-display tracking-tight text-[11px] select-none">
                      <th className="py-3 px-4">Local</th>
                      <th className="py-3 px-4">Destinatário</th>
                      <th className="py-3 px-4">Descrição Encomenda</th>
                      <th className="py-3 px-4">Status / Horário</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {filteredPackages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-dark-hover/30 transition-colors">
                        <td className="py-3.5 px-4 font-display font-bold text-white whitespace-nowrap">
                          Ap. {pkg.apartment}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-200">
                          <span className="font-semibold block">{pkg.recipientName}</span>
                          <span className="text-[10px] text-zinc-500 block">Identificado</span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate" title={pkg.description}>
                          {pkg.description}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {pkg.status === 'pending' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/10">
                                <Clock size={10} /> Aguardando
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono block">
                                Recebido por: <strong className="text-zinc-400">{pkg.receivedBy || 'Portaria'}</strong>
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono block">
                                Em {new Date(pkg.receivedAt).toLocaleDateString('pt-BR')} às {new Date(pkg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">
                                <Check size={10} /> Entregue
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono block">
                                Recebido por: <strong className="text-zinc-400">{pkg.receivedBy || 'Portaria'}</strong>
                              </span>
                              {pkg.deliveredAt && (
                                <span className="text-[9px] text-zinc-500 font-mono block">
                                  Retirada por: <strong className="text-zinc-400">{pkg.deliveredTo}</strong> em {new Date(pkg.deliveredAt).toLocaleDateString('pt-BR')} {new Date(pkg.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {pkg.status === 'pending' ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => {
                                  setDeliveringPackage(pkg);
                                  setRecipientDeliveryName('');
                                }}
                                className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent text-[11px] font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <CheckCircle size={12} /> Baixar Entrega
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-medium">Concluído</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POPUP MODAL FOR DELIVERY SIGN-OFF */}
      <AnimatePresence>
        {deliveringPackage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeliveringPackage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative text-left"
            >
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Baixa de Encomenda</span>
                <h3 className="font-display font-bold text-base text-white mt-1">Registrar Retirada da Encomenda</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Confirme a entrega do pacote (<strong className="text-zinc-200">{deliveringPackage.description}</strong>) para o apartamento <strong className="text-white">{deliveringPackage.apartment}</strong>.
                </p>
              </div>

              <form onSubmit={handleDeliverPackage} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Nome de quem está retirando *</label>
                  <input
                    type="text"
                    required
                    value={recipientDeliveryName}
                    onChange={(e) => setRecipientDeliveryName(e.target.value)}
                    placeholder="Ex: O próprio morador, filha, etc."
                    className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-blue-500 text-white placeholder-zinc-600"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeliveringPackage(null)}
                    className="flex-1 py-2.5 px-4 bg-dark-input hover:bg-dark-hover border border-dark-border text-zinc-400 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/15 cursor-pointer"
                  >
                    Confirmar Entrega
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
