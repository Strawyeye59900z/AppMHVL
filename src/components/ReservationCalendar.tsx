import React, { useState, useMemo, useRef } from 'react';
import { Reservation } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Dumbbell,
  Flame,
  Music,
  Info
} from 'lucide-react';


interface ReservationCalendarProps {
  reservations: Reservation[];
}

export default function ReservationCalendar({ reservations }: ReservationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Prefix with days from previous month to fill the first row
    const firstDayOfWeek = date.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
        const prevDay = new Date(year, month, -i);
        days.unshift(null); // Just null for empty slots or could be prev month days
    }

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

  const getAmenityConfig = (amenity: string) => {
    switch (amenity) {
      case 'quadra':
        return {
          icon: <Dumbbell size={10} className="shrink-0" />,
          style: { backgroundColor: '#1e3a8a66', color: '#bfdbfe', borderColor: '#1e3a8a99' },
          label: 'Quadra',
          color: '#3b82f6'
        };
      case 'churrasqueira':
        return {
          icon: <Flame size={10} className="shrink-0" />,
          style: { backgroundColor: '#7c2d1266', color: '#fed7aa', borderColor: '#7c2d1299' },
          label: 'Churrasqueira',
          color: '#f97316'
        };
      case 'salao':
        return {
          icon: <Music size={10} className="shrink-0" />,
          style: { backgroundColor: '#581c8766', color: '#e9d5ff', borderColor: '#581c8799' },
          label: 'Salão de Festas',
          color: '#a855f7'
        };
      default:
        return {
          icon: <Info size={10} className="shrink-0" />,
          style: { backgroundColor: '#27272a', color: '#d4d4d8', borderColor: '#3f3f46' },
          label: 'Outros',
          color: '#71717a'
        };
    }
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-4">
      <div ref={calendarRef} className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => changeMonth(-1)} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-full transition-colors"
                data-html2canvas-ignore="true"
              >
                <ChevronLeft size={20} />
              </button>
              <h3 className="font-display text-xl font-bold text-white capitalize min-w-[180px]">
                  {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => changeMonth(1)} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-full transition-colors"
                data-html2canvas-ignore="true"
              >
                <ChevronRight size={20} />
              </button>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Legend */}
            <div className="flex gap-4 text-[10px] items-center bg-dark-input/50 px-3 py-1.5 rounded-lg border border-dark-border">
              {['quadra', 'churrasqueira', 'salao'].map((type) => {
                const config = getAmenityConfig(type);
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-zinc-400">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
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
                  <div key={dateStr} className={`bg-dark-input/30 text-left p-2 h-32 md:h-40 overflow-y-auto transition-colors hover:bg-dark-input/40 relative`}>
                      <span className={`text-xs font-medium mb-2 inline-block w-6 h-6 leading-6 text-center rounded-full ${isToday ? 'bg-gold text-black' : 'text-zinc-400'}`}>
                        {day.getDate()}
                      </span>
                      
                      <div className="space-y-1">
                        {dayReservations.map((r, i) => {
                            const config = getAmenityConfig(r.amenity);
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
              )
          })}
        </div>
      </div>
    </div>
  );
}

