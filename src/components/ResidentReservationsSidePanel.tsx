/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, CalendarDays, RefreshCw } from 'lucide-react';
import { Resident } from '../types';

interface Reservation {
  id: string;
  apartment: string;
  block?: string;
  residentId: string;
  residentName: string;
  amenity: string;
  date: string;
  timeSlot: string;
  notes?: string;
}

interface SidePanelProps {
  resident: Resident;
  onRefreshTrigger?: () => void;
}

export default function ResidentReservationsSidePanel({ resident, onRefreshTrigger }: SidePanelProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reservations');
      if (response.ok) {
        const data: Reservation[] = await response.json();
        // Filter by apartment & block of this resident
        const aptNumber = resident.apartment;
        const aptBlock = resident.block || 'Único';
        
        const myRes = data.filter(r => 
          r.apartment === aptNumber && 
          (r.block || 'Único') === aptBlock
        );
        
        // Sort in chronological order
        myRes.sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
        setReservations(myRes);
      }
    } catch (err) {
      console.error('Error fetching resident reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
    // Listen to domestic events for inter-component triggers
    const handleUpdate = () => {
      fetchReservations();
    };
    window.addEventListener('reservation-updated', handleUpdate);
    return () => {
      window.removeEventListener('reservation-updated', handleUpdate);
    };
  }, [resident]);

  const handleCancelReservation = async (id: string, amenity: string, date: string) => {
    setConfirmingId(id);
  };

  const executeCancelReservation = async (id: string) => {
    setCancellingId(id);
    try {
      const response = await fetch('/api/reservations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          requesterApartment: resident.apartment,
          requesterBlock: resident.block || 'Único',
          isAdmin: false
        }),
      });

      if (response.ok) {
        await fetchReservations();
        // Dispatch custom event to let other reservation views know they should refresh
        window.dispatchEvent(new CustomEvent('reservation-updated'));
        if (onRefreshTrigger) onRefreshTrigger();
      } else {
        const data = await response.json();
        console.error(data.error || 'Erro ao cancelar reserva.');
      }
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      setCancellingId(null);
      setConfirmingId(null);
    }
  };

  const getAmenityBadgeColor = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'churrasqueira':
        return 'bg-amber-950/40 text-amber-400 border-amber-900/35';
      case 'salao':
        return 'bg-purple-950/40 text-purple-400 border-purple-900/35';
      case 'academia':
        return 'bg-blue-950/40 text-blue-400 border-blue-900/35';
      case 'quadra':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/35';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const formatAmenityName = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'churrasqueira': return 'Churrasqueira Gourmet';
      case 'salao': return 'Salão de Festas';
      case 'academia': return 'Academia Fitness';
      case 'quadra': return 'Quadra de Esportes';
      default: return amenity;
    }
  };

  const getDisplayDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="resident-side-reservations" className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl flex flex-col space-y-4 select-text">
      <div className="flex items-center justify-between border-b border-dark-border pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-gold" size={18} />
          <h3 className="font-display font-semibold text-sm text-white">Minhas Próximas Reservas</h3>
        </div>
        <button
          onClick={fetchReservations}
          title="Atualizar reservas"
          disabled={loading}
          className="p-1.5 hover:bg-dark-hover rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-gold' : ''} />
        </button>
      </div>

      <p className="text-[11px] text-zinc-500 leading-relaxed font-sans select-none">
        Abaixo estão listados todos os agendamentos ativos cadastrados para o <strong>Apto {resident.apartment} / Bloco {resident.block || 'Único'}</strong>:
      </p>

      {loading && reservations.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-1">
          <RefreshCw size={18} className="animate-spin text-gold" />
          Carregando agenda...
        </div>
      ) : reservations.length === 0 ? (
        <div className="py-10 text-center text-zinc-650 border border-dashed border-dark-border/40 rounded-xl">
          <Calendar size={24} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-xs font-medium">Nenhuma reserva ativa</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-[200px] mx-auto font-sans">Use a aba de Reservas para reservar uma área de lazer.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {reservations.map((res) => (
            <div
              key={res.id}
              className="p-3 bg-dark-input/60 rounded-xl border border-dark-border/30 hover:border-dark-border/60 transition-colors space-y-2 relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-md uppercase font-mono tracking-wider ${getAmenityBadgeColor(res.amenity)}`}>
                  {formatAmenityName(res.amenity)}
                </span>
                
                {confirmingId === res.id ? (
                  <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/35 px-2 py-0.5 rounded-md text-[10px]">
                    <span className="text-red-400 font-medium">Cancelar?</span>
                    <button
                      onClick={() => executeCancelReservation(res.id)}
                      className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-bold"
                    >
                      Sim
                    </button>
                    <span className="text-zinc-500">|</span>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-zinc-400 hover:text-white cursor-pointer font-bold"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleCancelReservation(res.id, res.amenity, res.date)}
                    disabled={cancellingId === res.id}
                    title="Cancelar esta reserva"
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-md cursor-pointer transition-colors shrink-0"
                  >
                    {cancellingId === res.id ? (
                      <RefreshCw size={11} className="animate-spin text-red-400" />
                    ) : (
                      <Trash2 size={11} />
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-1 font-sans text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Calendar size={11} className="text-gold shrink-0" />
                  <span className="font-semibold">{getDisplayDate(res.date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[10px]">
                  <Clock size={11} className="text-zinc-500 shrink-0" />
                  <span>{res.timeSlot}</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-1 pt-1 border-t border-dark-border/25 truncate" title={`Reservado por: ${res.residentName}`}>
                  Reservado por: <span className="text-zinc-400">{res.residentName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
