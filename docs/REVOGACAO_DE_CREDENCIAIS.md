# Revogação de Credenciais — Lead King

## Quando revogar
- Suspeita de vazamento de `.env`
- Rotação periódica (recomendado: a cada 90 dias)
- Colaborador removido do projeto
- Dispositivo perdido/roubado

## Credenciais e como revogar

### Supabase Service Role Key
1. Acesse: `https://supabase.com/dashboard/project/PROJETO/settings/api`
2. Clique em **Regenerate** na Service Role Key
3. Atualize `.env` com a nova chave
4. Re-deploy: `npm run cf:deploy`

### Supabase Access Token
1. Acesse: `https://supabase.com/dashboard/account/tokens`
2. Delete o token atual e crie um novo
3. Atualize `.env` com o novo token

### Cloudflare API Token
1. Acesse: `https://dash.cloudflare.com/profile/api-tokens`
2. Delete o token atual e crie um novo com as mesmas permissões
3. Atualize `.env` com o novo token

### GitHub PAT
1. Acesse: `https://github.com/settings/tokens`
2. Delete o token e crie um novo
3. Atualize `.env` com o novo token

### PWA Operator Access Code
1. Delete a variável `PWA_OPERATOR_ACCESS_CODE` do `.env`
2. O deploy script gera automaticamente um novo código
3. Execute `npm run cf:deploy`
4. O novo código será configurado como secret no Cloudflare
5. No celular, o PWA pedirá o novo código na próxima requisição

## Importante
- Nunca imprima, copie ou compartilhe credenciais em chat/email
- Use apenas `.env` local e Cloudflare Secrets
- Após revogar, sempre executar `npm run cf:deploy` para atualizar secrets
