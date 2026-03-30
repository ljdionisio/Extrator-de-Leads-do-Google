# 🤖 Extrator de Leads Google (Lead King) - Digital Prime

Esta é a versão fechada, operacional e puramente local do Extrator de Leads corporativos no Google Maps. A plataforma opera nativamente na sua máquina (arquitetura *Local-First*), com extrema estabilidade na varredura.

## 🚀 Como Iniciar a Operação
O fluxo oficial (ÚNICO Caminho) é o mais simples possível:
1. Dê **duplo clique** no arquivo `iniciar_robo.bat`.
2. A tela do sistema vai iniciar e conectar você automaticamente na interface web operando no seu próprio navegador. A interface abrirá no endereço local.
3. Não feche a tela preta do terminal! Ela processa as requisições ativamente.

## 💾 Onde ficam os Arquivos e Dados?
Tudo acontece sem nuvens ou servidores caros.
- **Os leads capturados** são preservados instantaneamente no arquivo `/data/leads.json`. Você não precisa interagir ele. Quando ligar o robô novamente seu progresso volta.
- As integrações e credenciais privadas precisam ser preenchidas apenas utilizando as instruções do arquivo copiando o modelo `.env.example` para `.env` (quando exigido na implantação).

## 📄 Como Exportar Resultados
Pela própria interface do usuário contida no Chrome:
- **Botão Exportar CSV:** Para planilhas (Score, nome, link, telefone). Salvo diretamente na mesma pasta padrão deste modelo `Extrator de Leads Google`.
- **Botão Exportar PDF:** Para o relatório executivo formatado da própria prospectagem (Resumo do Nicho e da Tabela Completa). Salvo diretamente na mesma pasta padrão em `.pdf`.

## 🛑 Estrutura Privada e Empacotamento
Por padrão comercial da aplicação:
- Jamais use estruturas oriundas do diretório _/legacy_backup/ (este diretório contém códigos do ambiente histórico QA apenas, foi mantido fora do pipeline da máquina).
- Somente os contatos da pasta *modules/* ditam toda a análise e captação dos contatos.
