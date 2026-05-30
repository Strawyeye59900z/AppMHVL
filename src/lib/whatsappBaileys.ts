import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import qrcodeTerminal from 'qrcode-terminal';

const AUTH_DIR = path.resolve(process.cwd(), 'baileys_auth');

export type WAStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

class WhatsAppBaileys extends EventEmitter {
  private sock: WASocket | null = null;
  private qrCode: string | null = null;
  private status: WAStatus = 'disconnected';
  private reconnectTimer: NodeJS.Timeout | null = null;

  getStatus(): WAStatus { return this.status; }
  getQR(): string | null { return this.qrCode; }

  async connect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

    this.status = 'connecting';
    this.emit('status', this.status);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
      },
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      qrTimeout: 60000,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.qrCode = qr;
        this.status = 'qr';
        this.emit('qr', qr);
        this.emit('status', this.status);
        console.log('\n[WhatsApp] Escaneie o QR Code abaixo com o WhatsApp (Aparelhos Conectados → Conectar um aparelho):\n');
        qrcodeTerminal.generate(qr, { small: true }, (qrText: string) => console.log(qrText));
      }

      if (connection === 'open') {
        this.qrCode = null;
        this.status = 'connected';
        this.emit('status', this.status);
        console.log('[WhatsApp] Conectado!');
      }

      if (connection === 'close') {
        const boom = lastDisconnect?.error as Boom;
        const code = boom?.output?.statusCode;
        const message = boom?.message || '';
        const isLoggedOut = code === DisconnectReason.loggedOut;
        const isQRTimeout = message.includes('QR refs attempts ended');
        // 515 = restart required (multi-device handshake), 428 = precondition — reconectar é esperado
        const shouldReconnect = !isLoggedOut;
        console.log(`[WhatsApp] Conexão fechada — código: ${code}, motivo: ${message || 'desconhecido'}, reconectar: ${shouldReconnect}`);
        this.status = 'disconnected';
        this.qrCode = null;
        this.emit('status', this.status);
        if (isLoggedOut) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } else if (isQRTimeout) {
          console.log('[WhatsApp] QR timeout — reconectando em 10s...');
          this.reconnectTimer = setTimeout(() => this.connect(), 10000);
        } else {
          // Delay maior para código 515 (restart após QR scan) — dá tempo do handshake completar
          const delay = code === 515 ? 2000 : 5000;
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
        }
      }
    });
  }

  async disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    await this.sock?.logout().catch(() => {});
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    this.emit('status', this.status);
  }

  async requestPairingCode(phone: string): Promise<string> {
    if (!this.sock) throw new Error('WhatsApp não iniciado');
    const code = await this.sock.requestPairingCode(phone);
    return code;
  }

  async sendText(phone: string, message: string): Promise<void> {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }
    const digits = phone.replace(/\D/g, '');

    // Resolve JID correto — tenta com o número original, depois sem o 9º dígito BR se não achar
    let jid = digits + '@s.whatsapp.net';
    try {
      const results = await this.sock.onWhatsApp(digits + '@s.whatsapp.net');
      if (results?.[0]?.exists) {
        jid = results[0].jid;
      } else if (digits.length === 13 && digits.startsWith('55')) {
        // Tenta sem o 9º dígito: 5571 9 91081158 → 5571 91081158
        const without9 = digits.slice(0, 4) + digits.slice(5);
        const results2 = await this.sock.onWhatsApp(without9 + '@s.whatsapp.net');
        if (results2?.[0]?.exists) {
          jid = results2[0].jid;
          console.log(`[WhatsApp] JID resolvido sem 9º dígito: ${jid}`);
        } else {
          console.warn(`[WhatsApp] Número ${digits} não encontrado no WhatsApp`);
        }
      }
    } catch (e) {
      console.warn(`[WhatsApp] onWhatsApp falhou, usando JID direto: ${jid}`);
    }
    console.log(`[WhatsApp] Enviando para JID: ${jid}`);
    await this.sock.sendMessage(jid, { text: message });
  }
}

export const waClient = new WhatsAppBaileys();
