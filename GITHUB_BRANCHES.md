# GitHub Branches - Troca de Senha no Primeiro Login

## Informações do Repositório

- **URL**: https://github.com/Strawyeye59900z/AppMHVL
- **Branch Principal**: `main` (produção)
- **Branch de Teste**: `feature/first-login-password-reset` (desenvolvimento)

## Branches Disponíveis

### 1. `main` (Produção)
- Branch principal do projeto
- Código estável e testado
- Use para produção no LXC

### 2. `feature/first-login-password-reset` (Nova - Teste)
- **Status**: ✅ Pronta para testes
- **Contém**: Novo recurso de troca de senha no primeiro login
- **Commit**: `bfae455`

#### Alterações incluídas:

```
✅ src/App.tsx
   - Importação do novo componente ResetPasswordFirstLogin
   - Verificação de firstLogin após autenticação
   - Redirecionamento para tela de troca de senha

✅ src/components/ResetPasswordFirstLogin.tsx (NOVO)
   - Componente completo com validações
   - Interface responsiva com design escuro
   - Feedback visual de sucesso

✅ FIRST_LOGIN_SETUP.md (NOVO)
   - Documentação completa de implementação backend
   - Exemplo de código para o endpoint
   - Instruções de setup

✅ IMPLEMENTATION_SUMMARY.md (NOVO)
   - Resumo técnico das alterações
   - Fluxo visual
   - Checklist de implementação
```

## Como Usar as Branches

### Opção 1: Clonar a branch de teste no LXC

```bash
# Acesse seu servidor LXC
ssh seu_usuario@seu_lxc

# Acesse o diretório do projeto
cd /caminho/do/seu/AppMHVL

# Clone a branch de teste
git clone -b feature/first-login-password-reset https://github.com/Strawyeye59900z/AppMHVL.git

# Ou se já tem o repo clonado
git fetch origin feature/first-login-password-reset
git checkout feature/first-login-password-reset
```

### Opção 2: Puxar as alterações (Recomendado)

Se você já tem o repositório clonado no LXC:

```bash
# No seu LXC
cd /caminho/do/seu/AppMHVL

# Busque todas as branches remotas
git fetch origin

# Mude para a branch de teste
git checkout feature/first-login-password-reset

# Verifique o status
git log --oneline -5
```

### Opção 3: Merge para produção (Depois de testes)

Depois de testar e validar a funcionalidade:

```bash
# Volte para main
git checkout main

# Puxe as últimas atualizações
git pull origin main

# Faça merge da branch de teste
git merge feature/first-login-password-reset

# Envie para o GitHub
git push origin main
```

## Passo a Passo Completo - LXC

### 1. Preparação (primeira vez)

```bash
# Acesse o LXC
ssh seu_usuario@seu_lxc

# Navegue ao diretório do projeto
cd /caminho/do/seu/AppMHVL

# Configure git se necessário
git config user.name "Seu Nome"
git config user.email "seu_email@example.com"
```

### 2. Buscar a branch

```bash
# Busque as referências remotas
git fetch origin

# Liste as branches disponíveis
git branch -a

# Você verá algo como:
# main
# remotes/origin/feature/first-login-password-reset
# remotes/origin/main
```

### 3. Ativar a branch de teste

```bash
# Troque para a branch de teste
git checkout feature/first-login-password-reset

# Confirme que está na branch correta
git branch

# Você verá:
# * feature/first-login-password-reset
#   main
```

### 4. Verificar as alterações

```bash
# Veja o histórico de commits
git log --oneline -10

# Veja as diferenças em relação a main
git diff main

# Liste os arquivos alterados/criados
git diff --name-status main
```

### 5. Instalar dependências (se necessário)

```bash
# Instale dependências do Node.js
npm install

# Ou se usar yarn
yarn install
```

### 6. Implementar o endpoint no backend

**Importante**: A branch contém apenas o frontend. Você precisa:

1. Ler `FIRST_LOGIN_SETUP.md`
2. Implementar o endpoint no seu `server.ts`:
   ```typescript
   app.post('/api/residents/change-password-first-login', async (req, res) => {
     // ... código do FIRST_LOGIN_SETUP.md
   });
   ```
3. Modificar `/api/residents/signup` para retornar `firstLogin: true`

### 7. Testar

```bash
# Compile/rode a aplicação
npm run dev  # ou seu comando de desenvolvimento

# Teste no navegador
# http://localhost:3000
```

### 8. Fazer merge para produção (opcional)

Depois de validado:

```bash
# Volte para main
git checkout main

# Atualize a branch principal
git pull origin main

# Faça merge
git merge feature/first-login-password-reset

# Envie para o GitHub
git push origin main
```

## Resumo dos Comandos Principais

```bash
# Buscar branches remotas
git fetch origin

# Ver todas as branches
git branch -a

# Trocar de branch
git checkout feature/first-login-password-reset

# Ver status
git status

# Ver commits recentes
git log --oneline -10

# Ver diferenças
git diff main

# Fazer merge (estando em main)
git merge feature/first-login-password-reset

# Enviar para GitHub
git push origin main
```

## Estrutura de Arquivos

```
AppMHVL/
├── src/
│   ├── components/
│   │   ├── ResetPasswordFirstLogin.tsx (NOVO)
│   │   ├── ResidentAuth.tsx
│   │   ├── App.tsx (MODIFICADO)
│   │   └── ...
│   └── ...
├── FIRST_LOGIN_SETUP.md (NOVO) ← Leia isto!
├── IMPLEMENTATION_SUMMARY.md (NOVO)
├── GITHUB_BRANCHES.md (ESTE ARQUIVO)
├── server.ts (REQUER MODIFICAÇÕES)
└── ...
```

## Checklist de Implementação

- [ ] Clonar/buscar a branch `feature/first-login-password-reset`
- [ ] Ler `FIRST_LOGIN_SETUP.md`
- [ ] Implementar o endpoint `/api/residents/change-password-first-login`
- [ ] Modificar `/api/residents/signup` (firstLogin: true)
- [ ] Testar o fluxo de novo residente
- [ ] Validar formulário de troca de senha
- [ ] Fazer merge para `main` (após testes)
- [ ] Fazer deploy em produção

## Problemas Comuns

### "Branch not found"

```bash
# Certifique-se de fazer fetch
git fetch origin

# Lista as branches remotas
git branch -r
```

### "Your branch is behind origin/main"

```bash
# Puxe as atualizações
git pull origin main
```

### Conflitos ao fazer merge

```bash
# Se houver conflitos:
# 1. Resolva manualmente os arquivos conflitantes
# 2. Stage os arquivos resolvidos
git add .

# 3. Complete o merge
git commit -m "Resolve merge conflicts"
```

### Descartar alterações locais

```bash
# Descarte alterações não commitadas
git restore .

# Ou resete para a versão remota
git reset --hard origin/feature/first-login-password-reset
```

## Contato / Suporte

Se tiver dúvidas sobre a implementação:
1. Leia `FIRST_LOGIN_SETUP.md`
2. Verifique `IMPLEMENTATION_SUMMARY.md`
3. Consulte os exemplos de código

## Links Úteis

- **Repository**: https://github.com/Strawyeye59900z/AppMHVL
- **Pull Request**: https://github.com/Strawyeye59900z/AppMHVL/pull/new/feature/first-login-password-reset
- **Branch**: https://github.com/Strawyeye59900z/AppMHVL/tree/feature/first-login-password-reset

---

**Última atualização**: 2026-09-25
**Commit**: bfae455
**Branch**: feature/first-login-password-reset
