#!/bin/bash

# Script para puxar a branch de teste no LXC
# Uso: bash pull-feature-branch.sh

set -e  # Exit on any error

echo "=========================================="
echo "Puxando Branch de Teste - First Login"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar se está em um repositório git
if [ ! -d .git ]; then
    echo -e "${RED}❌ Erro: Este não é um repositório Git${NC}"
    echo "Execute este script no diretório raiz do projeto AppMHVL"
    exit 1
fi

# 1. Buscar todas as branches remotas
echo -e "${BLUE}1. Buscando branches remotas...${NC}"
git fetch origin
echo -e "${GREEN}✓ Branches atualizadas${NC}"
echo ""

# 2. Verificar branch atual
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}2. Branch atual: ${YELLOW}$CURRENT_BRANCH${NC}"
echo ""

# 3. Listar branches disponíveis
echo -e "${BLUE}3. Branches disponíveis:${NC}"
git branch -a | sed 's/^/  /'
echo ""

# 4. Trocar para a branch de teste
echo -e "${BLUE}4. Trocando para branch de teste...${NC}"
if git rev-parse --verify origin/feature/first-login-password-reset > /dev/null 2>&1; then
    git checkout feature/first-login-password-reset 2>/dev/null || git checkout -b feature/first-login-password-reset origin/feature/first-login-password-reset
    echo -e "${GREEN}✓ Branch alterada com sucesso${NC}"
else
    echo -e "${RED}❌ Branch feature/first-login-password-reset não encontrada no remoto${NC}"
    exit 1
fi
echo ""

# 5. Mostrar informações da branch
echo -e "${BLUE}5. Informações da branch:${NC}"
echo -e "  Ramo atual: ${YELLOW}$(git branch | grep '^\*' | sed 's/^\* //')${NC}"
echo -e "  Último commit: ${YELLOW}$(git log -1 --oneline)${NC}"
echo ""

# 6. Mostrar arquivos alterados
echo -e "${BLUE}6. Arquivos alterados nesta branch:${NC}"
git diff --name-status main | sed 's/^/  /'
echo ""

# 7. Mostrar logs
echo -e "${BLUE}7. Últimos commits:${NC}"
git log --oneline main..feature/first-login-password-reset | sed 's/^/  /'
echo ""

# 8. Instalação de dependências (opcional)
read -p "Deseja instalar/atualizar dependências Node.js? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${BLUE}Instalando dependências...${NC}"
    if [ -f "package.json" ]; then
        if command -v npm &> /dev/null; then
            npm install
            echo -e "${GREEN}✓ Dependências instaladas${NC}"
        elif command -v yarn &> /dev/null; then
            yarn install
            echo -e "${GREEN}✓ Dependências instaladas${NC}"
        else
            echo -e "${RED}❌ npm ou yarn não encontrado${NC}"
        fi
    fi
    echo ""
fi

# 9. Resumo final
echo -e "${GREEN}=========================================="
echo "✓ Sucesso! Branch pronta para uso"
echo "==========================================${NC}"
echo ""
echo "Próximos passos:"
echo "1. Leia: FIRST_LOGIN_SETUP.md"
echo "2. Implemente o endpoint no server.ts:"
echo "   POST /api/residents/change-password-first-login"
echo "3. Teste a funcionalidade"
echo "4. Após validado, faça merge para main:"
echo ""
echo -e "${YELLOW}  git checkout main"
echo "  git merge feature/first-login-password-reset"
echo "  git push origin main${NC}"
echo ""
echo "Documentação:"
echo "  - FIRST_LOGIN_SETUP.md (Implementação backend)"
echo "  - IMPLEMENTATION_SUMMARY.md (Resumo técnico)"
echo "  - GITHUB_BRANCHES.md (Guia de branches)"
echo ""
