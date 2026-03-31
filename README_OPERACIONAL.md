# 🚀 Manual Operacional - Lead King
> Documentação exclusiva para o time comercial (SDR/BDR) da Digital Prime.

---

## 1. O que é o Lead King?
O Lead King é o motor de Forense de Empresas e Captação de Leads B2B da Digital Prime. Ele usa o navegador invisível da máquina para varrer milhares de alvos, extrair os dados e descobrir os **problemas (dores)** que as empresas têm no Google (sem site, sem instagram, avaliação ruim).

O objetivo principal da ferramenta **NÃO** é achar empresas ricas, mas achar empresas **invisíveis digitalmente** ou com reputação fraca, pois essas são as oportunidades onde a Digital Prime atua melhor.

---

## 2. Como Operar (Passo a Passo Básico)

1. **Abra o sistema:** Inicie a janela do robô (via atalho ou comando na pasta raiz).
2. **Defina o Alvo:**
   - Digite o **Nicho** (ex: *Borracharia, Dermatologistas*)
   - Digite a **Cidade** (ex: *Sorocaba, Curitiba*)
3. **Pressione "INICIAR CAPTAÇÃO":**
   - O botão ficará vermelho ("Pausar Motor").
   - Acompanhe o **Console Live** adicionando empresas na tabela na sua frente.
4. **Após o término (ou clocando em Pausar):**
   - O robô vai gerar *automaticamente* uma planilha da rodada e salvar na sua Área de Trabalho.
   - Use os menus suspensos caso precise aprovar ou negar oportunidades pelo **CRM Offline** da tela ("Novo", "Fechado", "Perdido").

---

## 3. O que são as pontuações (Score e Prioridade)?
Cada lead revelado passa por um Raio-X. O robô vai classificar o lead como **QUENTE**, **MORNO** ou **FRIO** e exibir sua pontuação.

* **Isso é muito importante:** A pontuação **alta** reflete que a empresa tem MUITO a melhorar. Ou seja, ela é "Quente" porque possui *falhas na presença digital* e você terá argumentos fortes para abordá-la.
* Por exemplo: Empresas ocultas sem telefone e sem foto, ou com avaliações 2.5 estrelas ganham +25 pontos na inteligência da máquina.

---

## 4. O Sistema de Resgates (⚠️ Repescado)
Se você limpa a tela para outra execução ou amanhã pesquisa na mesma cidade, o robô bloqueia repetidos (para você não falar com a mesma pessoa à toa).

Se o robô encontrar um lead velho numa pesquisa de hoje que tenha a mesma identidade passada, mas houver sentido em abordá-lo de novo, ele adiciona na tela com a flag laranja **⚠️ REPESCADO**. Isso significa que ele já está nos relatórios de ontem, mas voltou pelo radar hoje. 

---

## 5. Modo de Piloto Automático (CRON)
Lá embaixo na tela, há um agendador *"Automação (Cron)"*:
1. Digite a quantidade de minutos (ex: `60`).
2. Clique em **Agendar**.
3. A cada hora, a plataforma executará varreduras silenciosas pelos nichos preenchidos na barra lateral e arquivará no disco, **enquanto seu navegador fica aberto.** 

---

## 6. Exportação e Envio pro CRM Principal

O robô salva tudo sozinho na sua Desktop na pasta principal **"CRM Extrator Leads"**.
*(Lá você verá suas tabelas Excel `.csv` e livretos `.pdf`).*

**Mandar pro Pipedrive, RD Station ou Make:**
1. Na barra lateral: Role para baixo, em **Webhook**.
2. Cole o link especial do Make.com ou RD Station que seu Gestor passou (`http...`).
3. Clique em **Salvar**.
4. No botão do topo da tabela (verde: **☁️ Enviar p/ Webhook**), ele transmitirá toda a grade que você está vendo agora diretamente pro CRM da empresa para facilitar suas tarefas, sem precisar baixar o Excel e importar se não quiser.

> Bom trabalho e boas Vendas! Caso algo falhe, contate seu Líder Técnico ou Developer para verificar a conexão do NodeJS com o Playwright!
