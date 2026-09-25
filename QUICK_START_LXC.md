# Quick Start - Puxar Branch no LXC

## Resumo Executivo

Você tem uma nova feature pronta no GitHub em uma branch de teste. Siga os passos abaixo para puxar e implementar no LXC.

## Comandos Rápidos

### 1. Buscar a branch
```bash
cd /seu/caminho/AppMHVL
git fetch origin
git checkout feature/first-login-password-reset
```

### 2. Verificar as alterações
```bash
git log --oneline -5
git diff main --name-status
```

### 3. Instalar dependências (se necessário)
```bash
npm install
# ou
yarn install
```

### 4. Implementar o endpoint no backend

**Abra seu `server.ts` e adicione isso após `/api/residents/reset-password`:**

```typescript
// Change password on first login (called by Resident)
app.post('/api/residents/change-password-first-login', async (req, res) => {
  const { residentId, newPassword } = req.body;
  if (!residentId || !newPassword) {
    return res.status(400).json({ error: 'ResidentId e nova senha são obrigatórios.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
  }
  try {
    const resident = await pbAdmin.collection('residents').getOne(residentId);
    if (!resident) {
      return res.status(404).json({ error: 'Morador não encontrado.' });
    }
    const updated = await pbAdmin.collection('residents').update(residentId, {
      password: newPassword,
      passwordConfirm: newPassword,
      firstLogin: false,
    }) as unknown as ServerResident;
    const rec = updated as any;
    rec.photoDataUrl = residentPhotoDataUrl(rec);
    const { password: _, ...safeResident } = rec;
    res.json(safeResident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

### 5. Modificar /api/residents/signup

**Encontre a linha `firstLogin: false` e mude para `firstLogin: true`:**

```typescript
// ANTES:
const created = await pbAdmin.collection('residents').create({
  // ...
  firstLogin: false,  // ❌ ANTES
});

// DEPOIS:
const created = await pbAdmin.collection('residents').create({
  // ...
  firstLogin: true,   // ✅ DEPOIS
});
```

### 6. Testar

```bash
npm run dev
# Acesse http://localhost:3000
# Crie um novo residente e faça login
# Você deve ver a tela de troca de senha
```

### 7. Fazer merge para produção (após testes)

```bash
git checkout main
git pull origin main
git merge feature/first-login-password-reset
git push origin main
```

## Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `FIRST_LOGIN_SETUP.md` | Documentação detalhada de implementação |
| `IMPLEMENTATION_SUMMARY.md` | Resumo técnico e fluxo visual |
| `GITHUB_BRANCHES.md` | Guia completo de branches |
| `src/components/ResetPasswordFirstLogin.tsx` | Novo componente (NOVO) |
| `src/App.tsx` | Integração do fluxo (MODIFICADO) |

## O que foi adicionado

- ✅ Componente React para troca de senha
- ✅ Verificação de `firstLogin` após login
- ✅ Validações frontend (senha mínimo 4 caracteres)
- ✅ Interface responsiva e intuitiva

## O que você precisa fazer

1. ⬜ Implementar endpoint `/api/residents/change-password-first-login`
2. ⬜ Modificar `/api/residents/signup` para `firstLogin: true`
3. ⬜ Testar o fluxo
4. ⬜ Fazer merge para `main` (opcional, mas recomendado)

## Links

- **Repository**: https://github.com/Strawyeye59900z/AppMHVL
- **Branch**: feature/first-login-password-reset
- **Commit**: bfae455

## Dúvidas?

Leia os arquivos nesta ordem:
1. Este arquivo (QUICK_START_LXC.md)
2. FIRST_LOGIN_SETUP.md (implementação backend)
3. GITHUB_BRANCHES.md (guia completo)
4. IMPLEMENTATION_SUMMARY.md (referência técnica)
