/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Home, Lock, KeyRound, Building } from 'lucide-react';
import { Resident } from '../types';

interface ResidentAuthProps {
  onLoginSuccess: (resident: Resident) => void;
  onAdminInitiate: () => void;
  onEmployeeInitiate: () => void;
}

export default function ResidentAuth({ onLoginSuccess, onAdminInitiate, onEmployeeInitiate }: ResidentAuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [apartment, setApartment] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp && (!name.trim() || !phone.trim())) {
      setError('Nome e telefone são obrigatórios para o cadastro.');
      setLoading(false);
      return;
    }
    if (!apartment.trim() || !password.trim()) {
      setError('Todos os campos marcados são obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isSignUp ? '/api/residents/signup' : '/api/residents/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          apartment: apartment.trim(),
          block: 'Único',
          password: password,
          phone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro no servidor.');
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="resident-auth-card" className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-8 overflow-hidden">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
          {isSignUp ? 'Cadastro de Morador' : 'Acesso do Morador'}
        </h2>
        <p className="text-xs text-zinc-400 mt-2 font-sans">
          {isSignUp 
            ? 'Crie seu cadastro para enviar seu reconhecimento facial.' 
            : 'Acesse o aplicativo para realizar ou verificar seu cadastro.'}
        </p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 mb-6 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {isSignUp && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Nome Completo</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                <User size={18} />
              </span>
              <input
                id="resident-signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-600"
                required={isSignUp}
              />
            </div>
            
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display mt-4">WhatsApp (com DDD)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none text-xs font-mono font-bold select-none">+55</span>
              <input
                id="resident-signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 11999999999"
                className="w-full pl-12 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-600 font-mono"
                required={isSignUp}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Apartamento</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
              <Home size={18} />
            </span>
            <input
              id="resident-auth-apartment"
              type="text"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder="Ex: 101"
              className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-600"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Senha de Acesso</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
              <Lock size={18} />
            </span>
            <input
              id="resident-auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-600"
              required
            />
          </div>
        </div>

        <button
          id="resident-auth-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 mt-2 bg-gold text-black font-semibold rounded-xl text-sm hover:bg-gold-hover transition-all cursor-pointer shadow-lg shadow-gold/15 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none font-display"
        >
          {loading ? 'Processando...' : isSignUp ? 'Criar Cadastro' : 'Entrar na Conta'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-dark-border flex flex-col items-center gap-3">
        <button
          id="resident-auth-toggle-btn"
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className="text-xs font-semibold text-zinc-400 hover:text-gold hover:underline transition-all cursor-pointer font-display"
        >
          {isSignUp 
            ? 'Já possuo cadastro • Fazer Login' 
            : 'Novo morador? Registre seu apartamento aqui'}
        </button>

        <div className="flex flex-wrap gap-2 justify-center w-full mt-2">
          <button
            id="resident-goto-employee-btn"
            type="button"
            onClick={onEmployeeInitiate}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-all cursor-pointer font-display flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/10 hover:border-blue-500/20"
          >
            <Building size={12} /> Sou Funcionário (Portaria)
          </button>

          <button
            id="resident-goto-admin-btn"
            type="button"
            onClick={onAdminInitiate}
            className="text-[11px] font-semibold text-gold hover:text-gold-hover hover:underline transition-all cursor-pointer font-display flex items-center gap-1 bg-gold-light px-3 py-1.5 rounded-xl border border-gold/10 hover:border-gold/20"
          >
            <KeyRound size={12} /> Sou Administrador (Síndico)
          </button>
        </div>
      </div>
    </div>
  );
}
