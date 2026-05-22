/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, RefreshCw, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { Resident } from '../types';

interface CameraCaptureProps {
  resident?: Resident;
  personName?: string;
  personSubtitle?: string;
  entityId?: string;
  uploadUrl?: string; // e.g. '/api/residents/upload-face'
  onCaptureCompleted: (data: any) => void;
  onCancel?: () => void;
}

export default function CameraCapture({ resident, personName, personSubtitle, entityId, uploadUrl = '/api/residents/upload-face', onCaptureCompleted, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [fileSizeKB, setFileSizeKB] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Start the video stream when component mounts or retry
  const startCamera = async () => {
    setPermissionError(null);
    setCapturedPhoto(null);
    setIsCapturing(true);

    try {
      // Check if mediaDevices is supported (it requires a secure context: HTTPS or localhost)
      if (!navigator.mediaDevices) {
        setPermissionError('O seu navegador não suporta acesso à câmera ou você está acessando por um canal não seguro (requer HTTPS). Tente abrir o aplicativo em uma nova aba.');
        setIsCapturing(false);
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Constraints for webcam
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
      
      setHasStarted(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Acesso à câmera negado. Por favor, conceda permissão para tirar a foto no aplicativo.');
      } else {
        setPermissionError('Houve um erro ao inicializar a câmera do seu dispositivo: ' + (err.message || err));
      }
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isCapturing && !permissionError && !capturedPhoto && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
    }
  }, [isCapturing, permissionError, capturedPhoto]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setUploadError("A câmera ainda está inicializando, aguarde um segundo e tente novamente.");
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error("Could not get canvas context");
      return;
    }

    // Match canvas dimensions to video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw the current video frame on the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to webp/jpeg to keep it under 1MB
    // Use JPEG with 0.85 quality for a balance of fidelity and size.
    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    
    if (!base64Data || base64Data === 'data:,') {
      console.error("Failed to capture image data, result is empty");
      return;
    }
    
    // Calculate size in KB
    const approximateSizeInBytes = (base64Data.length * 3) / 4;
    const sizeInKB = approximateSizeInBytes / 1024;
    console.log("Captured image size:", sizeInKB, "KB");

    setCapturedPhoto(base64Data);
    setFileSizeKB(Math.round(sizeInKB));
    
    // Stop camera streaming during review
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleRecapture = () => {
    setCapturedPhoto(null);
    setUploadError(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!capturedPhoto) return;

    // Validate size limit of 1MB strictly
    if (fileSizeKB > 1024) {
      setUploadError('A foto excede o tamanho limite de 1MB. Por favor, tente tirar outra foto.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resident?.id || entityId,
          photoDataUrl: capturedPhoto,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar a foto para o servidor.');
      }

      onCaptureCompleted(data);
    } catch (err: any) {
      setUploadError(err.message || 'Erro de conexão ao salvar sua foto.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="camera-capture-card" className="w-full max-w-2xl bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-6 overflow-hidden">
      <div className="text-center mb-6">
        <h2 className="font-display text-xl font-semibold text-white flex items-center justify-center gap-2">
          <Camera size={20} className="text-gold" />
          {resident?.password ? 'Cadastramento de Facial Obrigatório' : 'Cadastramento de Facial'}
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1.5">
          {resident ? `Morador: ${resident.name} — Apto ${resident.apartment}` : `${personName || ''} ${personSubtitle ? `— ${personSubtitle}` : ''}`}
        </p>
        <p className="text-xs text-amber-500/90 mt-2 font-medium">
          * Restrição: as fotos devem ser tiradas em tempo real e não exceder 1MB de tamanho.
        </p>
      </div>

      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {permissionError ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center p-6 text-center text-white bg-dark-bg">
            <ShieldAlert size={48} className="text-amber-500 mb-4 animate-pulse" />
            <p className="text-sm font-medium leading-relaxed max-w-md text-zinc-300">{permissionError}</p>
            <button
              id="camera-retry-perm"
              onClick={startCamera}
              className="mt-5 px-5 py-2.5 bg-gold text-black font-semibold rounded-xl text-xs hover:bg-gold-hover transition-colors cursor-pointer flex items-center gap-2 font-display shadow-lg shadow-gold/20"
            >
              <RefreshCw size={14} /> Ativar Câmera Novamente
            </button>
          </div>
        ) : isCapturing ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white bg-dark-bg">
            <RefreshCw size={28} className="animate-spin text-gold mb-3" />
            <p className="text-sm text-zinc-400 font-display">Iniciando câmera segura...</p>
          </div>
        ) : capturedPhoto ? (
          /* PREVIEW MODE */
          <div className="relative w-full h-full">
            <img
              id="captured-facial-preview"
              src={capturedPhoto}
              alt="Preview"
              className="w-full h-full object-cover scale-x-[-1]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10">
              TAMANHO: {fileSizeKB} KB {fileSizeKB > 1024 ? '🚨 (EXCEDE 1MB)' : '✅ (OK)'}
            </div>
            <div className="absolute inset-0 bg-black/20" />
          </div>
        ) : (
          /* CAMERA VIEW MODE */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            
            {/* Silhouette HUD face layout overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[180px] h-[240px] md:w-[220px] md:h-[290px] border-2 border-dashed border-gold/60 rounded-[50%] relative flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-gold/10 rounded-[50%] -m-3 animate-ping" />
                <span className="bg-black/80 backdrop-blur-md text-white text-[10px] tracking-wide px-3 py-1 rounded-full border border-gold/20 font-display uppercase font-medium">
                  Centralize o seu rosto
                </span>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 bg-black/80 text-white px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wide border border-white/10">
              CÂMERA ATIVA (AO VIVO)
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-4 mt-4 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {uploadError}
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-center gap-4 mt-6">
        {capturedPhoto ? (
          <>
            {onCancel && (
              <button
                id="camera-cancel-captured-btn"
                onClick={onCancel}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-3 cursor-pointer bg-dark-input hover:bg-dark-hover text-zinc-300 font-medium rounded-xl text-sm border border-dark-border transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              id="camera-retake-btn"
              onClick={handleRecapture}
              disabled={isUploading}
              className="flex items-center gap-2 px-5 py-3 cursor-pointer bg-dark-input hover:bg-dark-hover text-zinc-300 font-medium rounded-xl text-sm border border-dark-border transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} /> Tirar Outra Foto
            </button>
            <button
              id="camera-confirm-btn"
              onClick={handleConfirm}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 px-8 py-3 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/20 disabled:opacity-50 min-w-[200px] font-display font-semibold"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Check size={16} /> Confirmar Cadastro
                </>
              )}
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            {onCancel && (
              <button
                id="camera-cancel-btn"
                onClick={onCancel}
                className="flex items-center gap-2 px-5 py-3 cursor-pointer bg-dark-input hover:bg-dark-hover text-zinc-300 font-medium rounded-xl text-sm border border-dark-border transition-all"
              >
                Voltar
              </button>
            )}
            <button
              id="camera-shutter-btn"
              onClick={handleCapture}
              disabled={!!permissionError || isCapturing}
              className="flex items-center gap-2 px-8 py-3.5 cursor-pointer bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-sm transition-all shadow-lg shadow-gold/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none font-display"
            >
              <Camera size={18} /> Tirar Foto Agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
