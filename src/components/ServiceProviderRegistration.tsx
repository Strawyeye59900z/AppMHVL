import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Check, AlertCircle, RefreshCw, Building, User, ShieldCheck } from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  serviceType: string;
  residentName: string;
  apartment: string;
  block: string;
  accessExpiry: string;
}

interface ServiceProviderRegistrationProps {
  token: string;
}

export default function ServiceProviderRegistration({ token }: ServiceProviderRegistrationProps) {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/providers/by-token/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLoadError(data.error);
        else setProviderInfo(data);
      })
      .catch(() => setLoadError('Falha ao carregar informações do convite.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = useCallback(async () => {
    setPermissionError(null);
    setCapturedPhoto(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionError('Câmera não disponível. Acesse via HTTPS ou localhost.');
        return;
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraStarted(true);
    } catch {
      setPermissionError('Permissão de câmera negada. Permita o acesso e tente novamente.');
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || video.clientWidth || 640;
    const h = video.videoHeight || video.clientHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally (front camera)
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraStarted(false);
    setCapturedPhoto(dataUrl);
  }, []);

  const retake = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  const submitPhoto = async () => {
    if (!capturedPhoto) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/providers/register-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, photoDataUrl: capturedPhoto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto.');
      setDone(true);
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  // Canvas always stays in DOM so refs are always valid
  const hiddenCanvas = <canvas ref={canvasRef} className="hidden absolute" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-zinc-400 text-sm gap-2">
        {hiddenCanvas}
        <RefreshCw size={18} className="animate-spin" /> Carregando convite...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        {hiddenCanvas}
        <div className="max-w-sm w-full bg-[#0f172a] border border-red-900/40 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <h2 className="font-bold text-white text-lg">Link Inválido</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{loadError}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        {hiddenCanvas}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-sm w-full bg-[#0f172a] border border-emerald-900/40 rounded-2xl p-8 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Check size={32} className="text-emerald-400" />
          </div>
          <h2 className="font-bold text-white text-xl">Cadastro Concluído!</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Sua foto foi registrada com sucesso. Você já pode acessar o condomínio{' '}
            <strong className="text-white">Mansão Heitor Vila Lobos</strong> pelo reconhecimento facial.
          </p>
          {providerInfo && (
            <div className="p-3 bg-[#0a0f1e] border border-zinc-800 rounded-xl text-left space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Validade do acesso</p>
              <p className="text-sm text-white font-semibold">
                {new Date(providerInfo.accessExpiry).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
          <p className="text-xs text-zinc-500">Você pode fechar esta página.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#E4E4E7] flex flex-col font-sans">
      {hiddenCanvas}

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f172a]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
            <Building size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white">Mansão Heitor Vila Lobos</h1>
            <p className="text-[10px] text-blue-300/60 font-mono tracking-widest uppercase">Cadastro de Acesso Facial</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pt-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Provider info card */}
          <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <User size={18} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Convite para</p>
                <h2 className="font-bold text-white text-base">{providerInfo?.name}</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Serviço</p>
                <p className="text-white font-medium">{providerInfo?.serviceType}</p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Apartamento</p>
                <p className="text-white font-medium">Apto {providerInfo?.apartment}</p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 col-span-2">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Acesso válido até</p>
                <p className="text-emerald-400 font-semibold">
                  {providerInfo ? new Date(providerInfo.accessExpiry).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Step: Instructions */}
          {!cameraStarted && !capturedPhoto && (
            <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-white">Como funciona</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                    Tire uma foto do seu rosto para que o sistema de reconhecimento facial do condomínio possa identificar você na entrada.
                  </p>
                </div>
              </div>
              {permissionError && (
                <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {permissionError}
                </div>
              )}
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-sm transition-all shadow-lg cursor-pointer"
              >
                <Camera size={16} /> Abrir Câmera
              </button>
            </div>
          )}

          {/* Step: Live camera */}
          <AnimatePresence>
            {cameraStarted && !capturedPhoto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#0f172a] border border-zinc-800 rounded-2xl overflow-hidden space-y-3 p-4"
              >
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider text-center font-mono">
                  Posicione seu rosto no centro
                </p>
                <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {/* Face guide */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-44 h-52 border-2 border-dashed border-yellow-400/50 rounded-full" />
                  </div>
                </div>
                <button
                  onClick={capturePhoto}
                  className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera size={16} /> Tirar Foto
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step: Preview & confirm */}
          <AnimatePresence>
            {capturedPhoto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#0f172a] border border-zinc-800 rounded-2xl overflow-hidden space-y-3 p-4"
              >
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider text-center font-mono">
                  Confirme sua foto
                </p>
                <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                  <img
                    src={capturedPhoto}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                {uploadError && (
                  <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    {uploadError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={retake}
                    disabled={uploading}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-sm border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Repetir
                  </button>
                  <button
                    onClick={submitPhoto}
                    disabled={uploading}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    {uploading ? 'Enviando...' : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>
  );
}
