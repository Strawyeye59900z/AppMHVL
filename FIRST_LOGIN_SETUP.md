# Setup de Troca de Senha no Primeiro Login

## O que foi adicionado

Um novo fluxo foi implementado para que os residentes troquem sua senha na primeira vez que fazem login. Isso funciona da seguinte forma:

1. **Frontend (React)** ✅ COMPLETO:
   - Novo componente: `ResetPasswordFirstLogin.tsx`
   - Verifica se `resident.firstLogin === true` após login
   - Se true, exibe a tela de troca de senha antes de qualquer outra coisa
   - Após a troca bem-sucedida, define `firstLogin = false` e prossegue normalmente

2. **Backend (Necessário)** 🔧 CONFIGURE NO SEU LXC:
   Você precisa criar um endpoint POST no seu servidor (LXC no Proxmox) para: `/api/residents/change-password-first-login`

## Implementação do Backend

### Endpoint necessário:

```
POST /api/residents/change-password-first-login
```

**Request Body:**
```json
{
  "residentId": "string",
  "newPassword": "string"
}
```

**Response (200 OK):**
```json
{
  "id": "string",
  "name": "string",
  "apartment": "string",
  "block": "string",
  "phone": "string",
  "photoDataUrl": null,
  "registeredAt": "2025-01-15T10:30:00.000Z",
  "syncStatus": "pending",
  "firstLogin": false,
  // ... outros campos do residente
}
```

**Response (erro):**
```json
{
  "error": "Descrição do erro"
}
```

### Implementação em Node.js/Express (seu server.ts no LXC):

Adicione este endpoint em seu `server.ts` após o endpoint `/api/residents/reset-password`:

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

### Checklist de configuração:

- [ ] Adicione o código acima no seu `server.ts` no LXC (após o endpoint `/api/residents/reset-password`)
- [ ] Certifique-se de que a coleção `residents` no PocketBase tem um campo `firstLogin` do tipo booleano
- [ ] Quando criar novos residentes via signup, defina `firstLogin: true` no backend
- [ ] Teste fazendo login com um novo residente

## Como o fluxo de login funciona agora:

1. Residente faz login via `ResidentAuth` (frontend)
2. Backend retorna o residente COM `firstLogin: true` (primeira vez)
3. Frontend detecta `firstLogin === true`
4. Mostra a tela `ResetPasswordFirstLogin`
5. Residente digita nova senha
6. Frontend envia POST para `/api/residents/change-password-first-login`
7. Backend atualiza senha e `firstLogin: false` no PocketBase
8. Frontend recebe resposta e atualiza o estado local
9. Residente é redirecionado para fazer upload de foto (se necessário)

## Ajuste necessário no signup

No seu endpoint `/api/residents/signup`, certifique-se de que está retornando `firstLogin: true`:

```typescript
// Em /api/residents/signup
const created = await pbAdmin.collection('residents').create({
  username: cleanUsername,
  email: loginEmail,
  password,
  passwordConfirm: password,
  name: name.trim(),
  apartment: apartment.trim(),
  block: block.trim() || 'Único',
  phone: phone ? phone.trim() : '',
  registeredAt: new Date().toISOString(),
  syncStatus: 'pending',
  firstLogin: true,  // ✅ IMPORTANTE: Mude de false para true
});
```

## Também para membros adicionados

Se você tem um endpoint para adicionar membros da família, ajuste também:

```typescript
// Em /api/residents/add-member
const newMember = await pbAdmin.collection('residents').create({
  // ... outros campos ...
  firstLogin: true,  // ✅ Mude de false para true se quiser que também troquem senha
});
```

## Testando

1. No seu LXC, implemente o novo endpoint no `server.ts`
2. Reinicie o servidor (se necessário)
3. No frontend, crie um novo residente via signup (ou use um existente se modificar `firstLogin` manualmente no BD)
4. Faça login
5. Você deve ver a tela de troca de senha
6. Defina uma nova senha
7. Você deve ser redirecionado para a próxima etapa (foto ou dashboard)

## Notas importantes

- A senha deve ter no mínimo 4 caracteres (validação no frontend e backend)
- O campo `firstLogin` deve existir na coleção `residents` do PocketBase
- Não exponha a senha no retorno (remova o campo `password` da resposta, que já é feito com `const { password: _, ...safeResident }`)
- A função `residentPhotoDataUrl()` já existe no seu `server.ts`, use-a como mostrado no exemplo
