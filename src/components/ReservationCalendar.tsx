import React, { useState, useMemo, useRef } from 'react';
import { Reservation, CommonArea } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trophy,
  Flame,
  Sparkles,
  Dumbbell,
  Music,
  Star,
  Home,
  Waves,
  Trees,
  Info
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Trophy, Flame, Sparkles, MapPin, Dumbbell, Music, Star, Home, Waves, Trees, CalendarIcon
};

const COLOR_HEX: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  amber:   { bg: '#78350f66', text: '#fcd34d', border: '#78350f99', dot: '#f59e0b' },
  orange:  { bg: '#7c2d1266', text: '#fed7aa', border: '#7c2d1299', dot: '#f97316' },
  purple:  { bg: '#581c8766', text: '#e9d5ff', border: '#581c8799', dot: '#a855f7' },
  blue:    { bg: '#1e3a8a66', text: '#bfdbfe', border: '#1e3a8a99', dot: '#3b82f6' },
  emerald: { bg: '#064e3b66', text: '#a7f3d0', border: '#064e3b99', dot: '#10b981' },
  rose:    { bg: '#881337aa', text: '#fecdd3', border: '#88133799', dot: '#f43f5e' },
  cyan:    { bg: '#164e6366', text: '#a5f3fc', border: '#164e6399', dot: '#06b6d4' },
  zinc:    { bg: '#27272a',   text: '#d4d4d8', border: '#3f3f46',   dot: '#71717a' },
};

interface ReservationCalendarProps {
  reservations: Reservation[];
  areas?: CommonArea[];
}

export default function ReservationCalendar({ reservations, areas = [] }: ReservationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days: (Date | null)[] = [];
    const firstDayOfWeek = date.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const reservationsByDay = useMemo(() => {
    return reservations.reduce((acc, res) => {
      acc[res.date] = acc[res.date] || [];
      acc[res.date].push(res);
      return acc;
    }, {} as Record<string, Reservation[]>);
  }, [reservations]);

  const getAreaConfig = (amenitySlug: string) => {
    const area = areas.find(a => a.slug === amenitySlug);
    if (area) {
      const colors = COLOR_HEX[area.color] || COLOR_HEX.zinc;
      const Icon = ICON_MAP[area.icon] || MapPin;
      return {
        icon: <Icon size={10} className="shrink-0" />,
        style: { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border },
        label: area.name,
        color: colors.dot,
      };
    }
    return {
      icon: <Info size={10} className="shrink-0" />,
      style: { backgroundColor: '#27272a', color: '#d4d4d8', borderColor: '#3f3f46' },
      label: amenitySlug,
      color: '#71717a',
    };
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const legendAreas = areas.length > 0 ? areas : [];

  return (
    <div className="space-y-4">
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="font-display text-xl font-bold text-white capitalize min-w-[180px]">
              {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {legendAreas.length > 0 && (
            <div className="flex flex-wrap gap-4 text-[10px] items-center bg-dark-input/50 px-3 py-1.5 rounded-lg border border-dark-border">
              {legendAreas.map((area) => {
                const colors = COLOR_HEX[area.color] || COLOR_HEX.zinc;
                return (
                  <div key={area.slug} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
                    <span className="text-zinc-400">{area.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-7 gap-px bg-dark-border border border-dark-border rounded-xl overflow-hidden">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="bg-dark-input py-2 text-center text-[10px] uppercase tracking-wider font-bold text-zinc-500">
              {day}
            </div>
          ))}

          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-dark-card/50 h-32 md:h-40" />;

            const dateStr = day.toISOString().split('T')[0];
            const dayReservations = reservationsByDay[dateStr] || [];
            const isToday = new Date().toDateString() === day.toDateString();

            return (
              <div key={dateStr} className="bg-dark-input/30 text-left p-2 h-32 md:h-40 overflow-y-auto transition-colors hover:bg-dark-input/40 relative">
                <span className={`text-xs font-medium mb-2 inline-block w-6 h-6 leading-6 text-center rounded-full ${isToday ? 'bg-gold text-black' : 'text-zinc-400'}`}>
                  {day.getDate()}
                </span>
                <div className="space-y-1">
                  {dayReservations.map((r, i) => {
                    const config = getAreaConfig(r.amenity);
                    return (
                      <div
                        key={i}
                        className="text-[9px] px-2 py-1 rounded border flex items-center gap-1.5 truncate shadow-sm transition-transform hover:scale-[1.02]"
                        style={config.style}
                        title={`${config.label} - Apto ${r.apartment}`}
                      >
                        {config.icon}
                        <span className="font-medium">Apto {r.apartment}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
