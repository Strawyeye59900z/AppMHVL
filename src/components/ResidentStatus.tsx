/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogOut, CheckCircle, Clock, ShieldCheck, Cpu, Camera, RefreshCw, Package } from 'lucide-react';
import { Resident } from '../types';

interface ResidentStatusProps {
  resident: Resident;
  onLogout: () => void;
  onCaptureRequest: (member: Resident) => void;
  onResidentUpdated?: (r: Resident) => void;
  initialTab?: 'me' | 'packages';
}

export default function ResidentStatus({ resident, onLogout, onCaptureRequest, onResidentUpdated, initialTab = 'me' }: ResidentStatusProps) {
  const [activeSubTab, setActiveSubTab] = useState<'me' | 'packages'>(initialTab);
  useEffect(() => { setActiveSubTab(initialTab); }, [initialTab]);

  // Poll current resident state from server to reflect Hikvision sync status automatically
  const [liveResident, setLiveResident] = useState<Resident>(resident);
  useEffect(() => { setLiveResident(resident); }, [resident]);
  useEffect(() => {
    // Only poll while not yet synced/registered
    if (liveResident.syncStatus === 'synced' && liveResident.deviceRegistered) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/residents');
        if (!res.ok) return;
        const all: Resident[] = await res.json();
        const updated = all.find(r => r.id === resident.id);
        if (!updated) return;
        setLiveResident(updated);
        if (onResidentUpdated) onResidentUpdated(updated);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [liveResident.syncStatus, liveResident.deviceRegistered]);

  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const isSync = liveResident.syncStatus === 'synced';

  const fetchPackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        const aptPackages = data.filter(
          (p: any) => p.apartment.toLowerCase() === resident.apartment.toLowerCase()
        );
        setPackages(aptPackages);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'packages') {
      fetchPackages();
    }
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
              <div className="relative">
                {/* Symmetrical border styled face border wrapper */}
                <div className="w-40 h-40 rounded-full border-4 border-dashed border-gold/30 flex items-center justify-center p-1.5 relative overflow-hidden bg-dark-input">
                  {liveResident.photoDataUrl ? (
                    <img
                      id="resident-face-badge"
                      src={liveResident.photoDataUrl}
                      alt={liveResident.name}
                      className="w-full h-full rounded-full object-cover scale-x-[-1]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-neutral-900 flex items-center justify-center text-zinc-500">
                      Sem Foto
                    </div>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 bg-dark-card p-1 rounded-full shadow-lg border border-dark-border">
                  {isSync ? (
                    <div className="p-1 px-2.5 bg-emerald-950/40 text-emerald-400 text-[10px] rounded-full font-semibold uppercase flex items-center gap-1 border border-emerald-900/40">
                      <CheckCircle size={12} /> Ativo
                    </div>
                  ) : (
                    <div className="p-1 px-2.5 bg-amber-950/40 text-amber-400 text-[10px] rounded-full font-semibold uppercase flex items-center gap-1 border border-amber-900/40">
                      <Clock size={12} /> Processando
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h2 className="font-display text-2xl font-semibold tracking-tight text-white truncate max-w-full px-2">
              {liveResident.name}
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-2">
              Apartamento {liveResident.apartment}
            </p>

            <div className="my-6 p-4 bg-dark-input border border-dark-border rounded-xl text-left space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-gold-light rounded-lg text-gold shrink-0 mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300">Facial Cadastrada com Sucesso</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                    Sua foto facial foi salva de forma segura e atende aos limites regulamentares de compressão do sistema.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-gold-light rounded-lg text-gold shrink-0 mt-0.5">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300">Sincronização com o Condomínio</h4>
                  {isSync ? (
                    <p className="text-xs text-emerald-400 font-medium leading-relaxed mt-1">
                      Perfil ativo! Sua imagem facial está registrada e sincronizada com o sistema do condomínio.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-400 font-medium leading-relaxed mt-1">
                      Sincronizando com o terminal de acesso... Esta tela atualizará automaticamente.
                    </p>
                  )}
                </div>
              </div>

              <div id="resident-device-reg-status" className="flex items-start gap-3 pt-2">
                <div className="p-1.5 bg-gold-light rounded-lg text-gold shrink-0 mt-0.5">
                  <CheckCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-zinc-300">Status no Aparelho da Entrada</h4>
                  {liveResident.deviceRegistered ? (
                    <p className="text-xs text-emerald-400 font-medium leading-relaxed mt-1">
                      ✔ Cadastrado no dispositivo físico! Seu rosto já está ativo no leitor do reconhecimento facial do portão principal.
                    </p>
                  ) : (
                    <div className="mt-1.5 p-2 bg-amber-950/25 border border-amber-900/20 rounded-xl">
                      <p className="text-[11px] text-amber-400 font-semibold leading-relaxed">
                        Aguardando sincronização com o terminal...
                      </p>
                      <p className="text-[10px] text-zinc-400 leading-normal mt-0.5 font-sans">
                        Sua foto está sendo processada. Esta tela atualizará automaticamente quando concluído.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
\t\t\t

            <button
              onClick={() => onCaptureRequest(resident)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-xs transition-all shadow-lg shadow-gold/15 cursor-pointer font-display"
            >
              <Camera size={14} /> Recadastrar Minha Foto Facial
            </button>
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
              <div className="space-y-3 max-h-[300px] overflow-y-auto text-left py-1 pr-1 border border-transparent">
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
                        className={`p-3 rounded-xl border transition-all ${
                          isPending
                            ? 'bg-amber-950/10 border-amber-500/25'
                            : 'bg-dark-input/40 border-dark-border/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white leading-normal select-text">
                            {pkg.description}
                          </p>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider font-mono shrink-0 ${
                              isPending
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {isPending ? 'Portaria' : 'Retirado'}
                          </span>
                        </div>

                        <div className="mt-2 text-[10px] text-zinc-400 font-sans space-y-0.5">
                          <p>
                            Destinatário: <strong className="text-zinc-300">{pkg.recipientName}</strong>
                          </p>
                          <p>
                            Recebido por: <strong className="text-zinc-300">{pkg.receivedBy || 'Portaria'}</strong>
                          </p>
                          <p className="text-zinc-500 font-mono text-[9px]">
                            {isPending ? (
                              <span>Recebido em {new Date(pkg.receivedAt).toLocaleDateString('pt-BR')} às {new Date(pkg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                              <span>Retirado por {pkg.deliveredTo} em {pkg.deliveredAt ? new Date(pkg.deliveredAt).toLocaleDateString('pt-BR') : ''}</span>
                            )}
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
