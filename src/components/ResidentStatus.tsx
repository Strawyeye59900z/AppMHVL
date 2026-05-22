/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, CheckCircle, Clock, ShieldCheck, Cpu, Users, UserPlus, Trash2, Camera, User, RefreshCw, Package } from 'lucide-react';
import { Resident } from '../types';

interface ResidentStatusProps {
  resident: Resident;
  onLogout: () => void;
  onCaptureRequest: (member: Resident) => void;
}

export default function ResidentStatus({ resident, onLogout, onCaptureRequest }: ResidentStatusProps) {
  const [activeSubTab, setActiveSubTab] = useState<'me' | 'family' | 'packages'>('me');
  const [members, setMembers] = useState<Resident[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [error, setError] = useState('');
  const [memberToDelete, setMemberToDelete] = useState<Resident | null>(null);
  
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [userOS, setUserOS] = useState<'ios' | 'android' | 'other'>('other');
  const prevPackagesRef = useRef<string[]>([]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setUserOS('ios');
    } else if (/android/.test(ua)) {
      setUserOS('android');
    } else {
      setUserOS('other');
    }
  }, []);

  const triggerBrowserNotification = (pkg: any) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification("📦 Encomenda Recebida!", {
          body: `Uma nova encomenda (${pkg.description}) chegou na portaria para você!`,
          icon: "/favicon.ico",
          tag: pkg.id,
          requireInteraction: true
        });
      } catch (err) {
        console.error("Failed to show notification:", err);
      }
    }
  };

  useEffect(() => {
    if (packages.length > 0) {
      const pendingPackages = packages.filter(p => p.status === 'pending');
      const newPending = pendingPackages.filter(p => !prevPackagesRef.current.includes(p.id));

      if (newPending.length > 0 && prevPackagesRef.current.length > 0) {
        newPending.forEach((pkg) => {
          triggerBrowserNotification(pkg);
        });
      }
      prevPackagesRef.current = packages.map(p => p.id);
    } else {
      prevPackagesRef.current = [];
    }
  }, [packages]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("Este navegador não suporta notificações de sistema.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification("🔔 Notificações Ativadas!", {
          body: "Parabéns! Você receberá avisos sobre a chegada de encomendas em tempo real.",
          icon: "/favicon.ico"
        });
      }
    } catch (err) {
      console.error("Error setting notification permission:", err);
    }
  };

  const isSync = resident.syncStatus === 'synced';

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

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const response = await fetch(
        `/api/residents/apartment-members?apartment=${encodeURIComponent(
          resident.apartment
        )}&block=${encodeURIComponent(resident.block || 'Único')}`
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'family') {
      fetchMembers();
    } else if (activeSubTab === 'packages') {
      fetchPackages();
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetchPackages();
    const interval = setInterval(fetchPackages, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    setError('');
    try {
      const response = await fetch('/api/residents/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          apartment: resident.apartment,
          block: resident.block || 'Único',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao adicionar familiar');
      }
      setNewMemberName('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message || 'Falha de conexão.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteMember = (id: string, name: string) => {
    if (id === resident.id) return;
    setMemberToDelete({ id, name } as Resident);
  };

  const confirmDeleteMember = async (id: string) => {
    try {
      const response = await fetch('/api/residents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        fetchMembers();
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao remover familiar');
      }
    } catch (err) {
      console.error('Error deleting member:', err);
    } finally {
      setMemberToDelete(null);
    }
  };

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

      {/* Sub-tab switcher */}
      <div className="flex bg-dark-input rounded-xl p-1 mb-6 border border-dark-border select-none">
        <button
          onClick={() => setActiveSubTab('me')}
          className={`flex-1 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer flex items-center justify-center gap-1.5 ${activeSubTab === 'me' ? 'bg-gold text-black shadow-lg shadow-gold/10' : 'text-zinc-400 hover:text-white'}`}
        >
          <User size={12} /> Minha Facial
        </button>
        <button
          onClick={() => setActiveSubTab('family')}
          className={`flex-1 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer flex items-center justify-center gap-1.5 ${activeSubTab === 'family' ? 'bg-gold text-black shadow-lg shadow-gold/10' : 'text-zinc-400 hover:text-white'}`}
        >
          <Users size={12} /> Familiares
        </button>
        <button
          onClick={() => setActiveSubTab('packages')}
          className={`flex-1 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer flex items-center justify-center gap-1.5 ${activeSubTab === 'packages' ? 'bg-gold text-black shadow-lg shadow-gold/10' : 'text-zinc-400 hover:text-white'}`}
        >
          <Package size={12} /> Encomendas ({packages.filter(p => p.status === 'pending').length})
        </button>
      </div>

      <div className="flex-1">
        {activeSubTab === 'me' && (
          <div>
            <div className="flex justify-center mb-6">
              <div className="relative">
                {/* Symmetrical border styled face border wrapper */}
                <div className="w-40 h-40 rounded-full border-4 border-dashed border-gold/30 flex items-center justify-center p-1.5 relative overflow-hidden bg-dark-input">
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
              {resident.name}
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-2">
              Apartamento {resident.apartment}
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
                      Perfil ativo! Suas informações e a imagem já foram transferidos para a pasta segura no Google Drive do condomínio.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-400 font-medium leading-relaxed mt-1">
                      Sua foto está pendente de sincronização. O síndico já recebeu os dados e fará a homologação em breve.
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
                  {resident.deviceRegistered ? (
                    <p className="text-xs text-emerald-405 font-medium leading-relaxed mt-1">
                      ✔ Cadastrado no dispositivo físico! Seu rosto já está ativo no leitor do reconhecimento facial do portão principal.
                    </p>
                  ) : (
                    <div className="mt-1.5 p-2 bg-red-950/25 border border-red-900/20 rounded-xl">
                      <p className="text-[11px] text-red-400 font-semibold leading-relaxed">
                        Pendente no Painel do Portão
                      </p>
                      <p className="text-[10px] text-zinc-400 leading-normal mt-0.5 font-sans">
                        O síndico precisa autorizar e carregar manualmente sua imagem no painel eletrônico de entrada física do condomínio.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
\t\t\t
            {resident.photoDataUrl && (
              <div id="web-push-tutorial-card" className="my-6 p-5 bg-dark-input border border-dark-border rounded-xl text-left space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔔</span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">Notificações Web Push</h3>
                    <p className="text-[10px] text-zinc-500">Substituto de notificações para celular. Receba avisos direto na tela do aparelho!</p>
                  </div>
                </div>

                {notificationPermission === 'granted' ? (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-center gap-2.5 text-emerald-400">
                    <span className="text-base select-none">✔</span>
                    <div className="text-xs">
                      <p className="font-bold">Notificações Ativas!</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">Seu celular ou computador receberá alertas em tempo real sobre novas encomendas.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-zinc-400 space-y-1">
                      <p>Para ativar as notificações automáticas e dispensar o WhatsApp, veja como configurar seu celular:</p>
                    </div>

                    <div className="bg-dark-card border border-dark-border/85 p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold font-display uppercase tracking-wider text-gold">
                          Passo a Passo: {userOS === 'ios' ? 'iOS (iPhone / iPad)' : userOS === 'android' ? 'Android' : 'Computador / Celular'}
                        </span>
                        <div className="flex gap-1 select-none">
                          <button
                            type="button"
                            onClick={() => setUserOS('ios')}
                            className={`px-2 py-0.5 text-[9px] font-semibold rounded ${userOS === 'ios' ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
                          >
                            iOS
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserOS('android')}
                            className={`px-2 py-0.5 text-[9px] font-semibold rounded ${userOS === 'android' ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
                          >
                            Android
                          </button>
                        </div>
                      </div>

                      {userOS === 'ios' ? (
                        <ol className="text-[11px] text-zinc-300 space-y-1.5 list-decimal list-inside font-sans leading-relaxed">
                          <li>Abra este site no navegador de internet <strong className="text-white font-semibold">Safari</strong>.</li>
                          <li>Clique no botão <strong className="text-white font-semibold">Compartilhar</strong> (retângulo com seta para cima).</li>
                          <li>Role a lista de opções e clique em <strong className="text-white font-semibold">"Adicionar à Tela de Início"</strong>.</li>
                          <li>Abra o aplicativo através do ícone adicionado em sua tela inicial.</li>
                          <li>Clique no botão azul abaixo para autorizar os alertas por push no aparelho.</li>
                        </ol>
                      ) : userOS === 'android' ? (
                        <ol className="text-[11px] text-zinc-300 space-y-1.5 list-decimal list-inside font-sans leading-relaxed">
                          <li>Acesse este painel utilizando o navegador <strong className="text-white font-semibold">Google Chrome</strong>.</li>
                          <li>Toque nos três pontos no canto superior direito para abrir o menu do navegador.</li>
                          <li>Selecione a opção <strong className="text-white font-semibold">"Instalar Aplicativo"</strong> ou <strong className="text-white font-semibold">"Adicionar à tela principal"</strong>.</li>
                          <li>Ao abrir o app da tela inicial, toque no botão azul abaixo para conceder a permissão de Push.</li>
                        </ol>
                      ) : (
                        <ol className="text-[11px] text-zinc-300 space-y-1.5 list-decimal list-inside font-sans leading-relaxed">
                          <li>Recomendamos usar o Google Chrome, Safari ou Microsoft Edge.</li>
                          <li>Clique no botão azul abaixo para iniciar.</li>
                          <li>Quando o navegador perguntar, clique em <strong className="text-white font-semibold">Permitir</strong> para habilitar as notificações.</li>
                        </ol>
                      )}
                    </div>

                    <button
                      id="web-push-permission-btn"
                      type="button"
                      onClick={requestPermission}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-blue-600/10 cursor-pointer select-none text-center font-display"
                    >
                      {notificationPermission === 'denied' 
                        ? 'Permissão Bloqueada (Habilite nas configurações do navegador)' 
                        : 'Ativar Notificações Web Push (Conceder Permissão)'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => onCaptureRequest(resident)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-xs transition-all shadow-lg shadow-gold/15 cursor-pointer font-display"
            >
              <Camera size={14} /> Recadastrar Minha Foto Facial
            </button>
          </div>
        )}

        {activeSubTab === 'family' && (
          <div>
            <div className="text-left mb-4">
              <h3 className="font-display text-sm font-semibold text-white">Membros do Apartamento</h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                Cadastre e gerencie a imagem facial individual de cada pessoa que mora com você.
              </p>
            </div>

            {/* Inline Add Member Form */}
            <form onSubmit={handleAddMember} className="space-y-3 mb-5 bg-dark-input border border-dark-border/40 p-4 rounded-xl text-left">
              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Adicionar Novo Familiar</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 pointer-events-none">
                    <UserPlus size={14} />
                  </span>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full pl-8 pr-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs focus:outline-none focus:border-gold transition-all text-white placeholder-zinc-600"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-3 py-1.5 bg-gold text-black text-xs font-semibold rounded-lg hover:bg-gold-hover transition-all font-display shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {addingMember ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
              {error && <span className="text-[10px] text-red-400 block">{error}</span>}
            </form>

            {/* Members List */}
            {loadingMembers && members.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-gold" />
                Carregando membros...
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto text-left py-1 pr-1 border border-transparent">
                {members.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-6">Nenhum familiar cadastrado para este apartamento.</p>
                ) : (
                  members.map((member) => {
                    const isSelf = member.id === resident.id;
                    const hasPhoto = !!member.photoDataUrl;
                    const isMemberSync = member.syncStatus === 'synced';
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between p-2.5 bg-dark-input/60 border border-dark-border/35 rounded-xl gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular Badge */}
                          <div className="w-9 h-9 rounded-full border border-dark-border flex items-center justify-center shrink-0 overflow-hidden bg-neutral-900">
                            {hasPhoto ? (
                              <img
                                src={member.photoDataUrl}
                                alt={member.name}
                                className="w-full h-full object-cover scale-x-[-1]"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User size={14} className="text-zinc-600" />
                            )}
                          </div>
                          
                          {/* Member Details */}
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                              <span className="truncate">{member.name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 bg-gold/15 text-gold text-[8px] font-bold rounded uppercase tracking-wide shrink-0">
                                  Você
                                </span>
                              )}
                            </h4>
                            
                            {/* Status Indicators */}
                            <div className="flex items-center gap-1.5 mt-1 select-none">
                              {!hasPhoto ? (
                                <span className="text-[8px] font-bold text-amber-500/90 uppercase tracking-wider font-mono">Sem Facial</span>
                              ) : isMemberSync ? (
                                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" /> Sincronizado
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider font-mono flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-505 inline-block animate-pulse shrink-0" /> Processando Sync
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Member UI Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onCaptureRequest(member)}
                            title={hasPhoto ? "Atualizar Foto" : "Tirar Foto"}
                            className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                              hasPhoto 
                                ? 'border-dark-border text-zinc-400 hover:text-white hover:bg-dark-hover' 
                                : 'bg-gold/15 border-gold/25 text-gold hover:bg-gold/30'
                            }`}
                          >
                            <Camera size={13} />
                          </button>
                          
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              title="Remover Familiar"
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/10 rounded-lg cursor-pointer transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
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

      {/* CUSTOM MEMBER DELETE CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {memberToDelete && (
          <motion.div
            id="resident-member-delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setMemberToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-red-400">
                <Trash2 size={22} />
                <h3 className="font-display font-bold text-base text-white">Excluir Familiar</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente remover o familiar <strong>{memberToDelete.name}</strong> deste apartamento de forma definitiva?
              </p>
              <div className="flex gap-2 select-none justify-end">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="px-3 py-1.5 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  id="resident-confirm-delete-member-btn"
                  type="button"
                  onClick={() => confirmDeleteMember(memberToDelete.id)}
                  className="px-3 py-1.5 bg-red-650 hover:bg-red-600 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors font-display"
                >
                  Confirmar Remoção
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
