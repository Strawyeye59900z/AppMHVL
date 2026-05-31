/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Plus, Trash2, Edit, CheckCircle, AlertCircle, X,
  Trophy, Flame, Sparkles, Dumbbell, Music, Star, Home, Waves, Trees,
  ToggleLeft, ToggleRight, Clock, Hash, RefreshCw
} from 'lucide-react';
import { CommonArea } from '../types';

const AVAILABLE_ICONS = [
  { value: 'Trophy', label: 'Troféu', Icon: Trophy },
  { value: 'Flame', label: 'Chama', Icon: Flame },
  { value: 'Sparkles', label: 'Brilhos', Icon: Sparkles },
  { value: 'Dumbbell', label: 'Haltere', Icon: Dumbbell },
  { value: 'Music', label: 'Música', Icon: Music },
  { value: 'Star', label: 'Estrela', Icon: Star },
  { value: 'Home', label: 'Casa', Icon: Home },
  { value: 'Waves', label: 'Ondas', Icon: Waves },
  { value: 'Trees', label: 'Árvores', Icon: Trees },
  { value: 'MapPin', label: 'Pino', Icon: MapPin },
];

const AVAILABLE_COLORS = [
  { value: 'amber',   label: 'Âmbar',    bg: 'bg-amber-500',   text: 'text-amber-400' },
  { value: 'orange',  label: 'Laranja',  bg: 'bg-orange-500',  text: 'text-orange-400' },
  { value: 'purple',  label: 'Roxo',     bg: 'bg-purple-500',  text: 'text-purple-400' },
  { value: 'blue',    label: 'Azul',     bg: 'bg-blue-500',    text: 'text-blue-400' },
  { value: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500', text: 'text-emerald-400' },
  { value: 'rose',    label: 'Rosa',     bg: 'bg-rose-500',    text: 'text-rose-400' },
  { value: 'cyan',    label: 'Ciano',    bg: 'bg-cyan-500',    text: 'text-cyan-400' },
  { value: 'zinc',    label: 'Cinza',    bg: 'bg-zinc-500',    text: 'text-zinc-400' },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Trophy, Flame, Sparkles, MapPin, Dumbbell, Music, Star, Home, Waves, Trees
};

const COLOR_TEXT: Record<string, string> = {
  amber: 'text-amber-400', orange: 'text-orange-400', purple: 'text-purple-400',
  blue: 'text-blue-400', emerald: 'text-emerald-400', rose: 'text-rose-400',
  cyan: 'text-cyan-400', zinc: 'text-zinc-400',
};

type SlotPreset = { label: string; slots: string[] };

const SLOT_PRESETS: SlotPreset[] = [
  { label: 'Dia Inteiro', slots: ['Dia Inteiro'] },
  { label: 'Manhã e Tarde', slots: ['Manhã (08:00-12:00)', 'Tarde (13:00-18:00)'] },
  { label: 'Manhã, Tarde e Noite', slots: ['Manhã (08:00-12:00)', 'Tarde (13:00-18:00)', 'Noite (19:00-22:00)'] },
  { label: 'Por hora (08h-22h)', slots: ['08:00 - 09:00','09:00 - 10:00','10:00 - 11:00','11:00 - 12:00','12:00 - 13:00','13:00 - 14:00','14:00 - 15:00','15:00 - 16:00','16:00 - 17:00','17:00 - 18:00','18:00 - 19:00','19:00 - 20:00','20:00 - 21:00','21:00 - 22:00'] },
];

function generateSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  maxPerDayPerApt: number;
  active: boolean;
  slots: string[];
  newSlot: string;
}

const emptyForm = (): FormState => ({
  name: '', slug: '', description: '', icon: 'MapPin', color: 'zinc',
  maxPerDayPerApt: 1, active: true, slots: [], newSlot: ''
});

export default function AdminAreasPanel() {
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<CommonArea | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAreas = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/areas/all');
      if (res.ok) setAreas(await res.json());
      else setError('Erro ao carregar áreas.');
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAreas(); }, []);

  const openCreate = () => {
    setEditingArea(null);
    setForm(emptyForm());
    setError('');
    setSuccessMsg('');
    setShowForm(true);
  };

  const openEdit = (area: CommonArea) => {
    setEditingArea(area);
    setForm({
      name: area.name,
      slug: area.slug,
      description: area.description || '',
      icon: area.icon,
      color: area.color,
      maxPerDayPerApt: area.maxPerDayPerApt,
      active: area.active,
      slots: [...area.slots],
      newSlot: '',
    });
    setError('');
    setSuccessMsg('');
    setShowForm(true);
  };

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, slug: editingArea ? f.slug : generateSlug(name) }));
  };

  const addSlot = () => {
    const s = form.newSlot.trim();
    if (!s || form.slots.includes(s)) return;
    setForm(f => ({ ...f, slots: [...f.slots, s], newSlot: '' }));
  };

  const removeSlot = (slot: string) => {
    setForm(f => ({ ...f, slots: f.slots.filter(s => s !== slot) }));
  };

  const applyPreset = (preset: SlotPreset) => {
    setForm(f => ({ ...f, slots: preset.slots }));
  };

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return; }
    if (form.slots.length === 0) { setError('Adicione ao menos um horário/período.'); return; }

    setSaving(true);
    try {
      if (editingArea) {
        const res = await fetch('/api/areas/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingArea.id,
            name: form.name,
            description: form.description,
            icon: form.icon,
            color: form.color,
            slots: form.slots,
            maxPerDayPerApt: form.maxPerDayPerApt,
            active: form.active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar.');
        setSuccessMsg('Área atualizada com sucesso!');
      } else {
        const res = await fetch('/api/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            description: form.description,
            icon: form.icon,
            color: form.color,
            slots: form.slots,
            maxPerDayPerApt: form.maxPerDayPerApt,
            active: form.active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar área.');
        setSuccessMsg('Área criada com sucesso!');
      }
      setShowForm(false);
      fetchAreas();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (area: CommonArea) => {
    setError('');
    try {
      const res = await fetch('/api/areas/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: area.id, active: !area.active }),
      });
      if (!res.ok) throw new Error('Erro ao alterar status.');
      fetchAreas();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/areas/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir.');
      setSuccessMsg('Área excluída com sucesso!');
      setConfirmDeleteId(null);
      fetchAreas();
    } catch (err: any) {
      setError(err.message);
      setConfirmDeleteId(null);
    }
  };

  const AreaIcon = ({ area }: { area: CommonArea }) => {
    const Icon = ICON_MAP[area.icon] || MapPin;
    return <Icon size={16} className={COLOR_TEXT[area.color] || 'text-zinc-400'} />;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <MapPin size={20} className="text-gold" />
              Áreas Comuns
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Gerencie as áreas disponíveis para reserva pelos moradores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAreas}
              className="p-2 text-zinc-400 hover:text-white bg-dark-input hover:bg-dark-hover border border-dark-border rounded-lg transition-all cursor-pointer"
              title="Atualizar"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-gold hover:bg-gold-hover text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-lg shadow-gold/20"
            >
              <Plus size={14} /> Nova Área
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-500">Carregando áreas...</div>
        ) : areas.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-dark-border rounded-2xl">
            <MapPin size={32} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-xs text-zinc-500">Nenhuma área cadastrada. Clique em <strong>Nova Área</strong> para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {areas.map((area) => (
              <div key={area.id} className={`border rounded-xl p-4 transition-all ${area.active ? 'border-dark-border bg-dark-input/20' : 'border-dark-border/30 bg-dark-bg/10 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-dark-input rounded-lg border border-dark-border">
                      <AreaIcon area={area} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm font-display">{area.name}</h3>
                        {!area.active && (
                          <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono uppercase">Inativa</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">slug: {area.slug}</p>
                      {area.description && (
                        <p className="text-xs text-zinc-400 mt-1">{area.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-dark-input/60 px-2 py-1 rounded-lg border border-dark-border/40">
                    <Clock size={10} />
                    <span>{area.slots.length} período(s)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-dark-input/60 px-2 py-1 rounded-lg border border-dark-border/40">
                    <Hash size={10} />
                    <span>Máx {area.maxPerDayPerApt}/dia por apto</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1 max-h-16 overflow-hidden">
                  {area.slots.slice(0, 4).map(slot => (
                    <span key={slot} className="text-[9px] font-mono text-zinc-500 bg-dark-bg/40 px-1.5 py-0.5 rounded border border-dark-border/30">{slot}</span>
                  ))}
                  {area.slots.length > 4 && (
                    <span className="text-[9px] font-mono text-zinc-600 px-1.5 py-0.5">+{area.slots.length - 4} mais</span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-dark-border/30">
                  <button
                    onClick={() => handleToggleActive(area)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={area.active ? 'Desativar' : 'Ativar'}
                  >
                    {area.active
                      ? <ToggleRight size={18} className="text-emerald-400" />
                      : <ToggleLeft size={18} className="text-zinc-600" />}
                    <span>{area.active ? 'Ativa' : 'Inativa'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(area)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-dark-hover rounded-lg transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                    {confirmDeleteId === area.id ? (
                      <div className="flex items-center gap-1.5 bg-red-950/30 border border-red-900/30 px-2 py-1 rounded-lg text-xs">
                        <span className="text-red-400">Excluir?</span>
                        <button onClick={() => handleDelete(area.id)} className="text-emerald-400 font-bold hover:text-emerald-300 cursor-pointer">Sim</button>
                        <span className="text-zinc-700">|</span>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-zinc-400 font-bold hover:text-white cursor-pointer">Não</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(area.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                        title="Excluir área"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-full max-w-2xl my-8 space-y-0 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-dark-border">
                <h3 className="text-white font-bold font-display flex items-center gap-2 text-base">
                  <MapPin size={18} className="text-gold" />
                  {editingArea ? 'Editar Área' : 'Nova Área Comum'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {error && (
                  <div className="p-3 bg-red-950/40 text-red-400 border border-red-900/40 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Name & Slug */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Nome da Área *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex: Piscina, Salão de Jogos..."
                      className="w-full bg-dark-input border border-dark-border rounded-lg text-xs p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                      Identificador (slug) {editingArea && <span className="text-zinc-600 normal-case">— não editável</span>}
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      readOnly={!!editingArea}
                      onChange={(e) => !editingArea && setForm(f => ({ ...f, slug: e.target.value }))}
                      className={`w-full bg-dark-input border border-dark-border rounded-lg text-xs p-2.5 font-mono placeholder-zinc-600 focus:outline-none focus:border-gold transition-all ${editingArea ? 'text-zinc-500 cursor-not-allowed' : 'text-white'}`}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Breve descrição da área..."
                    className="w-full bg-dark-input border border-dark-border rounded-lg text-xs p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                  />
                </div>

                {/* Icon & Color */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Ícone</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {AVAILABLE_ICONS.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, icon: value }))}
                          title={label}
                          className={`p-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${form.icon === value ? 'bg-gold/20 border-gold/40 text-gold' : 'bg-dark-input border-dark-border text-zinc-500 hover:text-white hover:border-zinc-500'}`}
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Cor</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {AVAILABLE_COLORS.map(({ value, label, bg }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, color: value }))}
                          title={label}
                          className={`h-8 rounded-lg border-2 transition-all cursor-pointer ${bg} ${form.color === value ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Max Per Day */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                    Máximo de reservas por apartamento por dia
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={form.maxPerDayPerApt}
                      onChange={(e) => setForm(f => ({ ...f, maxPerDayPerApt: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-24 bg-dark-input border border-dark-border rounded-lg text-xs p-2.5 text-white focus:outline-none focus:border-gold transition-all text-center font-mono"
                    />
                    <span className="text-xs text-zinc-500">período(s) por apto/dia</span>
                  </div>
                </div>

                {/* Slots */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                      Horários / Períodos disponíveis *
                    </label>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-600 font-mono">Carregar preset:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SLOT_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="text-[10px] px-2 py-1 bg-dark-input hover:bg-dark-hover border border-dark-border hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer font-mono"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current slots */}
                  {form.slots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-3 bg-dark-bg/40 rounded-xl border border-dark-border/40">
                      {form.slots.map(slot => (
                        <div key={slot} className="flex items-center gap-1 text-[10px] font-mono bg-dark-input border border-dark-border text-zinc-300 px-2 py-1 rounded-lg">
                          <span>{slot}</span>
                          <button type="button" onClick={() => removeSlot(slot)} className="text-zinc-600 hover:text-red-400 ml-1 cursor-pointer">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add custom slot */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.newSlot}
                      onChange={(e) => setForm(f => ({ ...f, newSlot: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSlot(); } }}
                      placeholder="Ex: 08:00 - 09:00  ou  Manhã"
                      className="flex-1 bg-dark-input border border-dark-border rounded-lg text-xs p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={addSlot}
                      className="px-3 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className="cursor-pointer"
                  >
                    {form.active
                      ? <ToggleRight size={24} className="text-emerald-400" />
                      : <ToggleLeft size={24} className="text-zinc-600" />}
                  </button>
                  <span className="text-xs text-zinc-400">
                    {form.active ? 'Área ativa (visível aos moradores)' : 'Área inativa (oculta dos moradores)'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border bg-dark-bg/20">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gold hover:bg-gold-hover text-black text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Salvando...' : editingArea ? 'Salvar Alterações' : 'Criar Área'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
