import React from 'react';
import { Home, Calendar, Package, Briefcase } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const navItems = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'reservar', label: 'Reservar', icon: Calendar },
    { id: 'encomendas', label: 'Encomendas', icon: Package },
    { id: 'prestadores', label: 'Prestadores', icon: Briefcase },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/10 p-2 z-50 flex items-center justify-around pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={24} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
