# Hub Demonstrativo — Loja Integrada ↔ UaiRango

Sistema de integração desenvolvido para sincronização entre plataformas de e-commerce e delivery, conectando a API da Loja Integrada com a API da UaiRango através de uma arquitetura modular em Node.js.

O projeto foi criado com foco em homologação, testes operacionais e automação de fluxo de pedidos, permitindo validar toda a comunicação entre marketplaces, catálogo, status de loja e eventos de pedidos.

---

## ✨ Principais funcionalidades

- Sincronização de produtos entre plataformas
- Integração de pedidos em tempo real
- Worker dedicado para processamento de eventos
- Polling automático de eventos da UaiRango
- Confirmação, despacho e cancelamento de pedidos
- Gestão de catálogo e categorias
- Controle de status da loja
- Upload e vínculo de imagens de produtos
- Ambiente demonstrativo para homologação
- Estrutura modular e escalável
- Integração via REST API
- Debug facilitado para testes operacionais

---

## ⚙️ Tecnologias utilizadas

- Node.js
- Express
- Axios
- JavaScript
- REST API
- Dotenv
- Sharp
- Body Parser
- FormData

---

## 🧩 Estrutura do projeto

O projeto possui uma arquitetura dividida por responsabilidades:

- `workers/` → processamento assíncrono e automações
- `routes/` → endpoints da aplicação
- `services/` → comunicação com APIs externas
- `tests/` → scripts de validação e testes
- `uploads/` → gerenciamento de imagens
- `utils/` → funções auxiliares

---

## 🔄 Fluxos automatizados

### Produtos
- Importação de catálogo
- Atualização de preço
- Atualização de status
- Upload automático de imagens
- Sincronização de categorias

### Pedidos
- Recebimento via polling
- Confirmação automática
- Preparação de pedidos
- Despacho
- Cancelamento
- Reprocessamento de falhas

---

## 🧪 Ambiente de homologação

O hub demonstrativo possui um ambiente dedicado para testes e homologação da integração, permitindo:

- Simular fluxos completos
- Validar payloads
- Testar endpoints rapidamente
- Monitorar respostas da API
- Executar ações operacionais em tempo real

---

## 🚀 Objetivo do projeto

Este projeto foi desenvolvido para facilitar integrações omnichannel entre plataformas de delivery e e-commerce, automatizando processos operacionais e reduzindo falhas manuais durante sincronizações de catálogo e pedidos.

---

## 📌 Observações

- Variáveis sensíveis estão protegidas via `.env`
- Arquivos sensíveis e dependências locais estão ignorados no `.gitignore`
- Estrutura preparada para expansão futura
- Projeto voltado para integração e automação operacional

---

## 👨‍💻 Desenvolvido por

**Mateus Gonçalves**
