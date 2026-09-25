/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Building, CheckCircle } from 'lucide-react';
import { Resident } from '../types';

interface ResetPasswordFirstLoginProps {
  resident: Resident;
  onPasswordReset: (updatedResident: Resident) => void;
  onCancel: () => void;
}

export default function ResetPasswordFirstLogin({
  resident,
  onPasswordReset,
  onCancel
}: ResetPasswordFirstLoginProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Preencha todos os campos de senha.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/residents/change-password-first-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: resident.id,
          newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao alterar senha.');
      }

      setSuccess(true);
      setTimeout(() => {
        const updatedResident = { ...resident, firstLogin: false };
        onPasswordReset(updatedResident);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-[#0f172a]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl p-8 lg:p-10 text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <CheckCircle size={32} />
            </div>
          </motion.div>

          <div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Senha Alterada!
            </h2>
            <p className="text-sm text-zinc-400 mt-2">
              Sua senha foi atualizada com sucesso. Você será redirecionado em instantes.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-[#0f172a]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl p-8 lg:p-10 overflow-hidden text-zinc-100">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
            <Lock size={32} />
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">
            Primeira Vez?
          </h2>
          <p className="text-sm text-zinc-400 mt-3 font-sans">
            Defina uma nova senha para sua conta de residente.
          </p>
        </div>

        <div className="mb-6 p-4 bg-blue-950/20 border border-blue-900/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <Building size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-zinc-300">
              <span className="font-semibold text-blue-300">
                Apto {resident.apartment}
                {resident.block !== 'Único' ? ` • Bloco ${resident.block}` : ''}
              </span>
              <p className="text-xs text-zinc-400 mt-1">{resident.name}</p>
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mb-6 bg-red-950/40 border border-red-900/50 text-red-400 rounded-2xl text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-blue-300 uppercase tracking-widest block font-display">
              Nova Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-blue-400/50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                className="w-full pl-12 pr-4 py-3.5 bg-[#020617]/50 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder-zinc-500"
                required
                autoFocus
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Mínimo 4 caracteres</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-blue-300 uppercase tracking-widest block font-display">
              Confirmar Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-blue-400/50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua nova senha"
                className="w-full pl-12 pr-4 py-3.5 bg-[#020617]/50 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder-zinc-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-2xl text-sm transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 font-display"
          >
            {loading ? 'Salvando...' : 'Definir Nova Senha'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 px-4 text-white/80 hover:text-white font-semibold rounded-2xl text-sm transition-all cursor-pointer text-zinc-400 hover:text-zinc-300"
          >
            Cancelar
          </button>
        </form>
      </div>
    </motion.div>
  );
}
