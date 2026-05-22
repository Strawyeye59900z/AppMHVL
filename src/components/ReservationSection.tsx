/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Flame, 
  Sparkles, 
  Trophy, 
  Check, 
  PenTool, 
  AlertCircle,
  HelpCircle,
  User,
  X,
  Plus,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Resident, Reservation } from '../types';

interface ReservationSectionProps {
  resident?: Resident | null; // Null if admin
  isAdmin?: boolean;
}

export default function ReservationSection({ resident, isAdmin = false }: ReservationSectionProps) {
  // Safe default date set to local time format YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMaxDateString = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedAmenity, setSelectedAmenity] = useState<'quadra' | 'churrasqueira' | 'salao'>('quadra');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Modal / Booking inline details
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingName, setBookingName] = useState('');
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  // Fetch all reservations
  const fetchReservations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/reservations');
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      } else {
        setError('Não foi possível carregar as reservas.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão ao carregar as reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
    if (resident) {
      setBookingName(resident.name);
    }
  }, [resident]);

  // Defined Slots for each amenity type
  const getSlotsForAmenity = (amenity: 'quadra' | 'churrasqueira' | 'salao') => {
    switch (amenity) {
      case 'quadra':
        return [
          '08:00 - 09:00',
          '09:00 - 10:00',
          '10:00 - 11:00',
          '11:00 - 12:00',
          '12:00 - 13:00',
          '13:00 - 14:00',
          '14:00 - 15:00',
          '15:00 - 16:00',
          '16:00 - 17:00',
          '17:00 - 18:00',
          '18:00 - 19:00',
          '19:00 - 20:00',
          '20:00 - 21:00',
          '21:00 - 22:00'
        ];
      case 'churrasqueira':
        return [
          'Dia Inteiro'
        ];
      case 'salao':
        return [
          'Dia Inteiro'
        ];
      default:
        return [];
    }
  };

  const slots = getSlotsForAmenity(selectedAmenity);

  const handleCreateReservation = async (slot: string) => {
    setError('');
    setSuccessMsg('');

    // Pre-validations
    const todayStr = getTodayString();
    const maxLimitStr = getMaxDateString();

    if (selectedDate < todayStr) {
      setError('Não é possível reservar datas passadas.');
      return;
    }

    if (selectedDate > maxLimitStr) {
      setError('Reservas só podem ser feitas com no máximo 3 meses de antecedência.');
      return;
    }

    if (selectedAmenity === 'quadra' && resident) {
      const myBlock = resident.block || 'Único';
      const myApartment = resident.apartment;
      
      const aptReservations = reservations.filter(
        r => r.amenity === 'quadra' && 
             r.date === selectedDate && 
             r.apartment.toLowerCase() === myApartment.toLowerCase() &&
             (r.block || 'Único').toLowerCase() === myBlock.toLowerCase()
      );
      
      if (aptReservations.length >= 4) {
        setError('A reserva da quadra é limitada a no máximo 4 períodos por dia por apartamento.');
        return;
      }
    }

    const finalName = bookingName.trim() || resident?.name || 'Morador';
    
    // Set parameters
    const payload = {
      apartment: resident ? resident.apartment : 'Portaria / Admin',
      block: resident ? (resident.block || 'Único') : 'Único',
      residentId: resident ? resident.id : 'admin',
      residentName: finalName,
      amenity: selectedAmenity,
      date: selectedDate,
      timeSlot: slot,
      notes: bookingNotes.trim()
    };

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível reservar.');
      }

      setSuccessMsg('Espaço reservado com sucesso!');
      setBookingSlot(null);
      setBookingNotes('');
      fetchReservations();
      window.dispatchEvent(new CustomEvent('reservation-updated'));
    } catch (err: any) {
      setError(err.message || 'Erro durante a reserva.');
    }
  };

  const handleCancelReservation = async (id: string) => {
    setConfirmingCancelId(id);
  };

  const executeCancelReservation = async (id: string) => {
    setError('');
    setSuccessMsg('');
    
    const payload = {
      id,
      requesterApartment: resident?.apartment || '',
      requesterBlock: resident?.block || 'Único',
      isAdmin
    };

    try {
      const response = await fetch('/api/reservations/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar reserva.');
      }

      setSuccessMsg('Reserva cancelada com sucesso!');
      fetchReservations();
      window.dispatchEvent(new CustomEvent('reservation-updated'));
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar.');
    } finally {
      setConfirmingCancelId(null);
    }
  };

  const handleExportListPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text('Relatório de Reservas - Condomínio', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
      
      const tableData = upcomingReservations.map(res => [
        new Date(res.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        res.amenity.charAt(0).toUpperCase() + res.amenity.slice(1),
        res.timeSlot,
        `${res.residentName} (Apto ${res.apartment}${res.block && res.block !== 'Único' ? ` / ${res.block}` : ''})`,
        res.notes || '-'
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Data', 'Local', 'Horário', 'Morador / Unidade', 'Notas']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [184, 134, 11], textColor: 255 }, // Gold-like color
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 } }
      });

      doc.save('reservas_condominio.pdf');
      setSuccessMsg('PDF da lista exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF da lista:', err);
      setError('Falha ao gerar PDF da lista.');
    }
  };

  const handleUpdateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;
    setError('');
    setSuccessMsg('');

    const payload = {
      id: editingReservation.id,
      notes: editNotes,
      requesterApartment: resident?.apartment || '',
      requesterBlock: resident?.block || 'Único',
      isAdmin
    };

    try {
      const response = await fetch('/api/reservations/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar observações.');
      }

      setSuccessMsg('Observações atualizadas com sucesso!');
      setEditingReservation(null);
      fetchReservations();
      window.dispatchEvent(new CustomEvent('reservation-updated'));
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar.');
    }
  };

  // Helper code to map visual amenities beautifully with colors & names
  const amenityMeta = {
    quadra: { name: 'Quadra de Esportes', icon: Trophy, color: 'text-amber-400 bg-amber-500/10 border-amber-500/10' },
    churrasqueira: { name: 'Churrasqueira Coberta', icon: Flame, color: 'text-orange-400 bg-orange-500/10 border-orange-500/10' },
    salao: { name: 'Salão de Festas', icon: Sparkles, color: 'text-purple-400 bg-purple-500/10 border-purple-500/10' }
  };

  // Filter reservations for admin view (all upcoming) vs resident view (date/amenity specific)
  const getUpcomingReservations = () => {
    const today = getTodayString();
    return reservations
      .filter(r => r.date >= today)
      .sort((a, b) => {
        // First sort by date
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        // Then sort by amenity priority (for visual grouping if needed)
        if (a.amenity !== b.amenity) return a.amenity.localeCompare(b.amenity);
        // Then by timeSlot
        return a.timeSlot.localeCompare(b.timeSlot);
      });
  };

  const upcomingReservations = getUpcomingReservations();

  // Filter reservations by selected date & selected amenity (used in resident view)
  const currentDaysReservations = reservations.filter(
    r => r.date === selectedDate && r.amenity === selectedAmenity
  );

  if (isAdmin) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Calendar size={20} className="text-gold" />
                Gerenciar Próximas Reservas
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Lista consolidada de todos os agendamentos futuros do condomínio.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportListPDF}
                className="flex items-center gap-2 bg-dark-input hover:bg-dark-hover text-zinc-400 hover:text-white border border-dark-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                title="Exportar Lista em PDF"
              >
                <Download size={14} /> 
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={fetchReservations}
                className="p-2 text-zinc-400 hover:text-white bg-dark-input hover:bg-dark-hover border border-dark-border rounded-lg transition-all cursor-pointer"
                title="Atualizar lista"
              >
                <Plus className="rotate-45" size={16} /> 
              </button>
            </div>
          </div>

          {/* FEEDBACK STATUS BUBBLES */}
          {error && (
            <div className="mb-4 p-3.5 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="py-20 text-center text-xs text-zinc-500 font-mono">
                <div className="animate-spin text-gold inline-block mb-3">...</div>
                <p>Carregando agenda central...</p>
              </div>
            ) : upcomingReservations.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-dark-border rounded-2xl">
                <Calendar size={32} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-xs text-zinc-500 font-mono">Nenhuma reserva futura encontrada no sistema.</p>
              </div>
            ) : (
              <div className="overflow-hidden border border-dark-border/40 rounded-xl">
                <table className="w-full text-left border-collapse bg-dark-bg/20">
                  <thead className="bg-dark-input/50">
                    <tr className="border-b border-dark-border text-[10px] text-zinc-500 font-bold font-mono uppercase tracking-widest">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Local</th>
                      <th className="py-3 px-4">Horário</th>
                      <th className="py-3 px-4">Morador / Unidade</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/40">
                    {upcomingReservations.map((booking) => {
                      const meta = amenityMeta[booking.amenity as keyof typeof amenityMeta] || amenityMeta.quadra;
                      const Icon = meta.icon;
                      
                      return (
                        <tr key={booking.id} className="hover:bg-dark-hover/30 transition-colors text-xs">
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar size={13} className="text-zinc-500" />
                              <span className="font-semibold text-zinc-200">
                                {new Date(booking.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                ({new Date(booking.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')})
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-tight ${meta.color}`}>
                              <Icon size={11} />
                              {meta.name.split(' ')[0]}
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap font-mono text-zinc-400">
                            {booking.timeSlot}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white font-display">{booking.residentName}</span>
                              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
                                Apto {booking.apartment} {booking.block && booking.block !== 'Único' ? `• Bloc ${booking.block}` : ''}
                              </span>
                              {booking.notes && (
                                <span className="text-[10px] italic text-gold/60 mt-1 truncate max-w-[150px]">
                                  Obs: {booking.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                             <div className="flex items-center justify-end gap-1.5">
                              {confirmingCancelId === booking.id ? (
                                <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/40 px-2 rounded-lg py-1">
                                  <button onClick={() => executeCancelReservation(booking.id)} className="text-emerald-400 hover:text-emerald-300 font-bold p-1">SIM</button>
                                  <button onClick={() => setConfirmingCancelId(null)} className="text-zinc-500 hover:text-white font-bold p-1">NÃO</button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingReservation(booking);
                                      setEditNotes(booking.notes || '');
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-lg transition-colors cursor-pointer"
                                    title="Editar observações"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleCancelReservation(booking.id)}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir reserva"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                             </div>
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

        {/* INLINE EDIT NOTES MODAL FOR ADMIN */}
        {editingReservation && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-dark-card border border-dark-border p-6 rounded-2xl shadow-2xl max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold font-display flex items-center gap-2">
                  <Edit size={18} className="text-gold" />
                  Editar Notas da Reserva
                </h3>
              </div>
              
              <div className="p-3 bg-dark-bg/40 rounded-xl border border-dark-border/40">
                 <p className="text-[11px] text-zinc-400">
                    <span className="font-bold text-zinc-300">{editingReservation.residentName}</span> em <span className="font-bold text-zinc-300">{new Date(editingReservation.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span> às <span className="font-bold text-zinc-300">{editingReservation.timeSlot}</span>
                 </p>
              </div>

              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Adicione observações ou avisos sobre esta reserva..."
                className="w-full h-32 bg-dark-input border border-dark-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-gold resize-none font-sans"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingReservation(null)}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateNotes}
                  className="px-5 py-2 bg-gold hover:bg-gold-hover text-black text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-gold/20"
                >
                  Salvar Observações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* HEADER SECTION WITH FILTERS */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={20} className="text-gold" />
              Reserva de Áreas Comuns
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Verifique os horários disponíveis e agende o uso da Quadra, Churrasqueira ou Salão de Festas.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="space-y-1">
              <label className="text-[9px] font-bold font-mono text-zinc-500 uppercase block">Escolha a Data</label>
              <input 
                type="date" 
                value={selectedDate}
                min={getTodayString()}
                max={getMaxDateString()}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setBookingSlot(null);
                  setEditingReservation(null);
                }}
                className="bg-dark-input border border-dark-border px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-gold transition-all"
              />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-2 mt-6 select-none bg-dark-input rounded-xl p-1 border border-dark-border/40">
          {(['quadra', 'churrasqueira', 'salao'] as const).map((key) => {
            const meta = amenityMeta[key];
            const MetaIcon = meta.icon;
            const isSelected = selectedAmenity === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedAmenity(key);
                  setBookingSlot(null);
                  setEditingReservation(null);
                  setError('');
                  setSuccessMsg('');
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 hover:text-white rounded-lg cursor-pointer transition-all text-center ${
                  isSelected 
                    ? 'bg-gold text-black font-semibold shadow-lg shadow-gold/10' 
                    : 'text-zinc-400'
                }`}
              >
                <MetaIcon size={16} />
                <span className="text-xs font-display">{meta.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FEEDBACK STATUS BUBBLES */}
      {error && (
        <div className="p-3.5 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* DETAILED BOOKING GRID */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl shadow-black/40 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-zinc-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
            Agenda do Dia — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'long' })}
          </h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            Buscando disponibilidade de horários...
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const visibleSlots = slots.filter(slot => {
                if (isAdmin) {
                  return currentDaysReservations.some(r => r.timeSlot === slot);
                }
                return true;
              });

              if (visibleSlots.length === 0) {
                return (
                  <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                    {isAdmin 
                      ? 'Nenhuma área reservada para este dia.' 
                      : 'Nenhum horário disponível.'}
                  </div>
                );
              }

              return visibleSlots.map((slot) => {
                const booking = currentDaysReservations.find(r => r.timeSlot === slot);
                const isReserved = !!booking;
              
              // Authorization validation
              const isOwnedByMe = resident && booking && 
                booking.apartment.toLowerCase() === resident.apartment.toLowerCase() &&
                (booking.block || 'Único').toLowerCase() === (resident.block || 'Único').toLowerCase();

              const canModify = isAdmin || isOwnedByMe;

              return (
                <div key={slot} className="border border-dark-border/40 rounded-xl bg-dark-input/30 p-4 transition-all hover:border-dark-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Slot Name / Time info */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-dark-input rounded-lg border border-dark-border text-zinc-400">
                        <Clock size={15} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white block">{slot}</span>
                        {isReserved ? (
                          <div className="flex flex-wrap items-center gap-2 mt-1 select-none">
                            <span className="text-[10px] font-semibold font-mono text-zinc-400">
                              Reservado: Apto {booking.apartment} • {booking.residentName}
                            </span>
                            {isOwnedByMe && (
                              <span className="px-1.5 py-0.2 bg-gold/15 text-gold border border-gold/15 text-[8px] font-bold rounded uppercase tracking-wide">
                                Sua Reserva
                              </span>
                            )}
                            {booking.notes && (
                              <span className="text-[10px] italic text-zinc-500">
                                ({booking.notes})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-400 text-xs font-medium block mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Disponível
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Buttons */}
                    <div className="flex items-center gap-2 shrink-0 select-none">
                      {isReserved ? (
                        canModify ? (
                          <div className="flex gap-2">
                            {confirmingCancelId === booking.id ? (
                              <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/40 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                                <span className="text-red-400">Confirmar?</span>
                                <button
                                  onClick={() => executeCancelReservation(booking.id)}
                                  className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-bold"
                                >
                                  Sim
                                </button>
                                <span className="text-zinc-700">|</span>
                                <button
                                  onClick={() => setConfirmingCancelId(null)}
                                  className="text-zinc-400 hover:text-white cursor-pointer font-bold"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingReservation(booking);
                                    setEditNotes(booking.notes || '');
                                  }}
                                  className="p-1.5 font-semibold text-zinc-400 hover:text-white hover:bg-dark-hover border border-dark-border rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                                  title="Editar observações"
                                >
                                  <Edit size={13} />
                                  <span className="hidden sm:inline">Notas</span>
                                </button>
                                <button
                                  onClick={() => handleCancelReservation(booking.id)}
                                  className="p-1.5 font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-transparent hover:border-red-900/10 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                                  title="Cancelar Reserva"
                                >
                                  <Trash2 size={13} />
                                  <span className="hidden sm:inline">Desmarcar</span>
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1.5 text-zinc-600 bg-zinc-950/10 text-xs font-semibold rounded-lg border border-dark-border/10 cursor-not-allowed">
                            Indisponível
                          </span>
                        )
                      ) : (
                        resident || isAdmin ? (
                          <button
                            onClick={() => {
                              setBookingSlot(slot);
                              setBookingNotes('');
                              // Reset name to resident name or customized name
                              if (resident) setBookingName(resident.name);
                              else setBookingName('Síndico / Admin');
                            }}
                            className="px-3.5 py-1.5 bg-gold/10 hover:bg-gold text-gold hover:text-black border border-gold/20 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Plus size={14} /> Reservar
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono italic">
                            Faça login para reservar
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* INLINE BOOKING CONFIRMATION FORM */}
                  {bookingSlot === slot && (
                    <div className="mt-4 p-4 border border-gold/20 rounded-xl bg-gold/5 space-y-3.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gold flex items-center gap-1.5">
                          <HelpCircle size={14} />
                          Preencha as informações para agendar
                        </h4>
                        <button
                          onClick={() => setBookingSlot(null)}
                          className="text-zinc-500 hover:text-zinc-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                            Quem usará o espaço?
                          </label>
                          <input
                            type="text"
                            value={bookingName}
                            onChange={(e) => setBookingName(e.target.value)}
                            placeholder="Nome do morador"
                            className="w-full bg-dark-bg border border-dark-border rounded-lg text-xs p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                            Observações do Uso (Opcional)
                          </label>
                          <input
                            type="text"
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            placeholder="Ex: Aniversário Familiar"
                            className="w-full bg-dark-bg border border-dark-border rounded-lg text-xs p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 font-display">
                        <button
                          onClick={() => setBookingSlot(null)}
                          className="px-3 py-1.5 border border-dark-border hover:bg-dark-hover text-zinc-400 hover:text-white rounded-lg text-xs cursor-pointer transition-all font-semibold"
                        >
                          Voltar
                        </button>
                        <button
                          onClick={() => handleCreateReservation(slot)}
                          className="px-3.5 py-1.5 bg-gold text-black hover:bg-gold-hover text-xs font-semibold rounded-lg cursor-pointer transition-all"
                        >
                          Confirmar Agendamento
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INLINE EDIT NOTES FORM */}
                  {editingReservation && editingReservation.timeSlot === slot && (
                    <form onSubmit={handleUpdateNotes} className="mt-4 p-4 border border-dark-border rounded-xl bg-dark-input/65 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <PenTool size={14} className="text-gold" />
                          Editar Detalhes da Reserva
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingReservation(null)}
                          className="text-zinc-500 hover:text-zinc-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                          Observações:
                        </label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Ex: Evento corporativo, reserva estendida"
                          className="w-full bg-dark-bg border border-dark-border rounded-lg text-xs p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                        />
                      </div>

                      <div className="flex justify-end gap-2 font-display">
                        <button
                          type="button"
                          onClick={() => setEditingReservation(null)}
                          className="px-3 py-1.5 border border-dark-border hover:bg-dark-hover text-zinc-400 hover:text-white rounded-lg text-xs cursor-pointer transition-all font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 bg-gold text-black hover:bg-gold-hover text-xs font-semibold rounded-lg cursor-pointer transition-all"
                        >
                          Salvar Observação
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })
            })()}
          </div>
        )}
      </div>

    </div>
  );
}
