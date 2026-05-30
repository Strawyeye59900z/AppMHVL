/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogOut, Camera, RefreshCw } from 'lucide-react';
import { Resident } from '../types';

interface ResidentStatusProps {
  resident: Resident;
  onLogout: () => void;
  onCaptureRequest: (member: Resident) => void;
  onResidentUpdated?: (r: Resident) => void;
  initialTab?: 'me' | 'packages';
}

export default function ResidentStatus({ resident, onLogout, onCaptureRequest, initialTab = 'me' }: ResidentStatusProps) {
  const [activeSubTab, setActiveSubTab] = useState<'me' | 'packages'>(initialTab);
  useEffect(() => { setActiveSubTab(initialTab); }, [initialTab]);

  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const fetchPackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages(data.filter((p: any) => p.apartment.toLowerCase() === resident.apartment.toLowerCase()));
      }
    } catch { /* ignore */ } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'packages') fetchPackages();
  }, [activeSubTab]);

  useEffect(() => {
    fetchPackages();
    const interval = setInterval(fetchPackages, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="resident-status-card" className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-8 text-center overflow-hidden flex flex-col">

      {/* Pending Packages Notification Alert */}
      {packages.filter(p => p.status === 'pending').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveSubTab('packages')}
          className="mb-6 p-3.5 bg-gold/10 hover:bg-gold/15 border border-gold/30 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left select-none group"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl animate-bounce shrink-0 select-none">📦</span>
            <div>
              <p className="text-[11px] font-bold text-white leading-tight uppercase font-display tracking-wide">
                Você tem pacote na portaria!
              </p>
              <p className="text-[10px] text-gold font-sans mt-0.5 font-medium leading-none">
                {packages.filter(p => p.status === 'pending').length} encomenda(s) aguardando retirada.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 group-hover:text-gold transition-colors font-bold uppercase tracking-wider pr-1">Ver</span>
        </motion.div>
      )}

      <div className="flex-1">
        {activeSubTab === 'me' && (
          <div>
            <div className="flex justify-center mb-6">
              <div className="w-40 h-40 rounded-full border-4 border-dashed border-gold/30 flex items-center justify-center p-1.5 overflow-hidden bg-dark-input">
                {resident.photoDataUrl ? (
                  <img
                    id="resident-face-badge"
                    src={resident.photoDataUrl}
                    alt={resident.name}
                    className="w-full h-full rounded-full object-cover scale-x-[-1]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-neutral-900 flex items-center justify-center text-zinc-500">
                    Sem Foto
                  </div>
                )}
              </div>
            </div>

            <h2 className="font-display text-2xl font-semibold tracking-tight text-white truncate max-w-full px-2">
              {resident.name}
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-2">
              Apartamento {resident.apartment}
            </p>

            <div className="mt-6">
              <button
                onClick={() => onCaptureRequest(resident)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-xs transition-all shadow-lg shadow-gold/15 cursor-pointer font-display"
              >
                <Camera size={14} /> Recadastrar Minha Foto Facial
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'packages' && (
          <div>
            <div className="text-left mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-white">Minhas Encomendas</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Encomendas recebidas para o seu apartamento ({resident.apartment}).
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPackages}
                className="p-1.5 rounded-lg border border-dark-border text-zinc-400 hover:text-white bg-dark-input hover:bg-dark-hover transition-all cursor-pointer"
                title="Atualizar"
              >
                <RefreshCw size={11} className={loadingPackages ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingPackages && packages.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-gold" />
                Carregando encomendas...
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto text-left py-1 pr-1">
                {packages.length === 0 ? (
                  <div className="text-center py-10 bg-dark-input/30 border border-dark-border/40 rounded-xl">
                    <p className="text-xs text-zinc-500">Nenhuma encomenda registrada para o seu apartamento.</p>
                  </div>
                ) : (
                  packages.map((pkg) => {
                    const isPending = pkg.status === 'pending';
                    return (
                      <div
                        key={pkg.id}
                        className={`p-3 rounded-xl border transition-all ${isPending ? 'bg-amber-950/10 border-amber-500/25' : 'bg-dark-input/40 border-dark-border/60'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white leading-normal select-text">{pkg.description}</p>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider font-mono shrink-0 ${isPending ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {isPending ? 'Portaria' : 'Retirado'}
                          </span>
                        </div>
                        <div className="mt-2 text-[10px] text-zinc-400 font-sans space-y-0.5">
                          <p>Destinatário: <strong className="text-zinc-300">{pkg.recipientName}</strong></p>
                          <p>Recebido por: <strong className="text-zinc-300">{pkg.receivedBy || 'Portaria'}</strong></p>
                          <p className="text-zinc-500 font-mono text-[9px]">
                            {isPending
                              ? <span>Recebido em {new Date(pkg.receivedAt).toLocaleDateString('pt-BR')} às {new Date(pkg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              : <span>Retirado por {pkg.deliveredTo} em {pkg.deliveredAt ? new Date(pkg.deliveredAt).toLocaleDateString('pt-BR') : ''}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-border">
        <button
          id="resident-logout-btn"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-dark-input hover:bg-dark-hover text-zinc-300 font-medium rounded-xl text-sm border border-dark-border transition-all cursor-pointer"
        >
          <LogOut size={16} /> Sair do Aplicativo
        </button>
      </div>

    </div>
  );
}
