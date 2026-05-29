# Design: Migração Firebase → PocketBase

**Data:** 2026-05-29  
**Projeto:** AppMHVL — Sistema Condominial Mansão Heitor Vila Lobos

---

## Contexto

O projeto usa Firebase Firestore como banco secundário e Firebase Auth para Google Sign-In. Ambos falham localmente por problemas de SSL e o Google Sign-In já está desabilitado com fallback para email+senha. O objetivo é substituir o Firebase por PocketBase — solução self-hosted, gratuita, com banco SQLite embutido, auth nativa por username/email e painel admin web.

O sistema rodará em VPS próprio com acesso remoto via internet.

---

## Arquitetura

```
VPS
├── PocketBase (porta 8090)
│   ├── /api/_/          → painel admin web
│   ├── /api/collections → REST API automática
│   └── pb_data/         → SQLite + uploads de fotos
│
└── Express + Vite App (porta 3000)
    ├── server.ts        → lógica de negócio + PocketBase SDK
    └── frontend React   → auth via PocketBase SDK
```

- PocketBase é a única fonte de verdade — `data/db.json` eliminado
- Express é stateless: sem cache em memória, sem sync background
- Frontend autentica diretamente com PocketBase SDK

---

## Schema de Coleções

### `residents` (auth habilitada)
| Campo | Tipo | Notas |
|---|---|---|
| username | text (unique) | número do apartamento (ex: "1301") |
| password | auth | gerenciado pelo PocketBase |
| name | text | nome completo |
| apartment | text | número do apartamento |
| block | text | bloco |
| phone | text | telefone fixo |
| whatsapp | text | número WhatsApp |
| photo | file | foto do morador |
| hikvisionSyncStatus | text | pending/synced/error |
| registeredAt | date | |
| firstLogin | bool | true até primeira troca de senha |

### `employees` (auth habilitada)
| Campo | Tipo | Notas |
|---|---|---|
| username | text (unique) | nome do porteiro (ex: "Aldo") |
| password | auth | gerenciado pelo PocketBase |
| name | text | nome completo |
| role | text | porteiro, zelador, etc. |
| active | bool | |
| firstLogin | bool | true até primeira troca de senha |

### `reservations`
| Campo | Tipo | Notas |
|---|---|---|
| residentId | relation → residents | |
| amenity | text | salão, churrasqueira, etc. |
| date | date | |
| startTime | text | |
| endTime | text | |
| status | text | pending/confirmed/cancelled |
| notes | text | |

### `packages`
| Campo | Tipo | Notas |
|---|---|---|
| residentId | relation → residents | destinatário |
| employeeId | relation → employees | porteiro que registrou |
| description | text | |
| carrier | text | transportadora |
| receivedAt | date | |
| deliveredAt | date | nullable |
| status | text | pending/delivered |

### `settings`
| Campo | Tipo | Notas |
|---|---|---|
| key | text (unique) | ex: "whatsapp_config", "hikvision_devices" |
| value | json | configuração serializada |

---

## Autenticação

| Tipo | Coleção PB | Login | Acesso |
|---|---|---|---|
| Admin | `users` (built-in) | email + senha | painel admin completo |
| Morador | `residents` (auth) | nº apartamento + senha | tela de morador |
| Porteiro | `employees` (auth) | nome + senha | tela de entregas |

**Primeiro acesso:**
1. Admin cria morador/porteiro com senha temporária e `firstLogin = true`
2. Usuário faz login → app detecta `firstLogin = true` → redireciona para tela de troca de senha
3. Após troca: `firstLogin = false`, usuário segue para tela principal

---

## Arquivos Modificados

### Removidos
- `src/firebase.ts` — substituído por `src/pocketbase.ts`
- `firebase-applet-config.json` — não mais necessário

### Criados
- `src/pocketbase.ts` — inicializa client PocketBase, exporta instância singleton

### Modificados
- `server.ts` — remove Firebase (~150 linhas), usa PocketBase SDK para todas as operações de dados
- `src/components/AdminDashboard.tsx` — troca `googleSignIn()` por login email+senha PocketBase
- `src/types.ts` — ajusta tipos para refletir novo schema (sem campos removidos)
- `package.json` — remove `firebase`, adiciona `pocketbase`

### Inalterados
- Todos os endpoints Hikvision e WhatsApp
- Todos os componentes visuais (exceto auth em AdminDashboard)
- TailwindCSS, Vite config, estrutura de pastas

---

## Dependências

```bash
# Remover
npm uninstall firebase

# Adicionar
npm install pocketbase
```

PocketBase binário: download de https://pocketbase.io/docs/ para o VPS, executado como serviço separado.

---

## Configuração no VPS

```bash
# 1. Baixar PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/vX.X.X/pocketbase_X.X.X_linux_amd64.zip
unzip pocketbase_*.zip

# 2. Iniciar PocketBase
./pocketbase serve --http="0.0.0.0:8090"

# 3. Iniciar App
cd AppMHVL && node_modules/.bin/tsx server.ts
```

Variável de ambiente necessária:
```
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=gabriel.nunez.costa@gmail.com
POCKETBASE_ADMIN_PASSWORD=<senha>
```

---

## Migração de Dados

Script de migração único (`scripts/migrate-db-to-pocketbase.ts`):
1. Lê `data/db.json`
2. Cria coleções no PocketBase via Admin API
3. Importa residents, employees, reservations, packages, settings
4. Seta `firstLogin = false` para usuários existentes (já fizeram login antes)
