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
      browser: ['AppMHVL', 'Chrome', '1.0.0'],
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.qrCode = qr;
        this.status = 'qr';
        this.emit('qr', qr);
        this.emit('status', this.status);
      }

      if (connection === 'open') {
        this.qrCode = null;
        this.status = 'connected';
        this.emit('status', this.status);
        console.log('[WhatsApp] Conectado!');
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Conexão fechada (código ${code}), reconectar: ${shouldReconnect}`);
        this.status = 'disconnected';
        this.emit('status', this.status);
        if (shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        } else {
          // Sessão encerrada — limpar auth
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
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

  async sendText(phone: string, message: string): Promise<void> {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await this.sock.sendMessage(jid, { text: message });
  }
}

export const waClient = new WhatsAppBaileys();
