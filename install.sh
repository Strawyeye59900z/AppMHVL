#!/bin/bash

# ==============================================================================
# Medassist - Script de Instalação para LXC (Proxmox)
# ==============================================================================

# Cores para feedback visual
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${GREEN}          🩺 Appcondominio - Instalador do Auxiliar Clínico${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# 1. Verificar dependências
echo -e "${BLUE}[1/5] Verificando dependências do sistema...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erro: Node.js não encontrado. Instale o Node.js v20+ antes de executar.${NC}"
    exit 1
fi

# 2. Configurando .env
echo -e "${BLUE}[2/5] Configurando variáveis de ambiente (.env)...${NC}"
read -p "Porta para o Medassist? (Enter para 3000): " CUSTOM_PORT
PORT=${CUSTOM_PORT:-3000}

echo -e "${YELLOW}Obs: Médicos podem cadastrar a API do Gemini no login.${NC}"
read -p "Chave de API padrão (opcional): " GEMINI_API_KEY
read -p "URL pública (ex: https://app.mhvl.com.br): " APP_URL

cat <<EOF > .env
PORT=$PORT
GEMINI_API_KEY="$GEMINI_API_KEY"
APP_URL="$APP_URL"
NODE_ENV="production"
EOF
echo -e "${GREEN}✔ Arquivo .env criado.${NC}"

# 3. Configuração do Firebase
echo -e "${BLUE}[3/5] Verificando credenciais do Firebase...${NC}"
if [ ! -f "firebase-applet-config.json" ]; then
    echo -e "${YELLOW}Arquivo firebase-applet-config.json não encontrado.${NC}"
    read -p "Deseja colar o conteúdo JSON agora? (s/n): " CONFIGURE_FIREBASE
    if [[ "$CONFIGURE_FIREBASE" =~ ^[Ss]$ ]]; then
        echo "Cole o JSON abaixo e pressione Ctrl+D ao finalizar:"
        cat > "firebase-applet-config.json"
    fi
fi

# 4. Instalação
echo -e "${BLUE}[4/5] Instalando dependências...${NC}"
npm install || { echo -e "${RED}Erro no npm install${NC}"; exit 1; }

# 5. Build
echo -e "${BLUE}[5/5] Compilando para produção...${NC}"
npm run build || { echo -e "${RED}Erro no build${NC}"; exit 1; }

echo -e "\n${GREEN}🚀 INSTALAÇÃO CONCLUÍDA!${NC}"
echo -e "Para iniciar o Appcondomínio:"
echo -e "${YELLOW}pm2 start dist/server.cjs --name medassist${NC}"
echo -e "${YELLOW}pm2 save${NC}"
