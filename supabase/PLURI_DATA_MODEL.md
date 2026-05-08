# Pluri data model

Este schema foi pensado para casar com o fluxo atual do app e com a evolução para SaaS multiusuario.

## Ideia central

- `profiles`: dados basicos do usuario autenticado no Supabase Auth
- `households`: a "casa" ou workspace financeiro
- `household_members`: pessoas exibidas no app
- `cards`: cartoes configurados pela casa
- `member_card_preferences`: cartao favorito por pessoa
- `savings_goals`: meta de economia
- `expenses`: gastos

## Como isso conversa com o app

### 1. Cadastro/login

O usuario cria conta no Supabase Auth.

Ao criar a conta:
- um registro em `profiles` e criado automaticamente pelo trigger `handle_new_user`

### 2. Onboarding

No primeiro acesso o app deve pedir:
- nome do app/casa
- se e `solo` ou `couple`
- nome da pessoa 1
- nome da pessoa 2 se for casal

Fluxo sugerido:

1. criar `households`
2. criar o primeiro `household_members` com `role = owner`
3. se for casal, criar o segundo `household_members`
4. marcar `profiles.onboarding_completed = true`

### 3. Tela principal

O app deve carregar:
- a `household` ativa do usuario
- os `household_members` ativos
- os `cards`
- a `savings_goals` ativa
- os `expenses`

### 4. Modo solo

Quando `households.household_type = 'solo'`:
- existe so um membro ativo
- a UI nao mostra seletor entre duas pessoas

### 5. Modo casal

Quando `households.household_type = 'couple'`:
- existem dois membros ativos
- a UI mostra alternancia entre os dois
- totais e grafico sao calculados por `member_id`

## Mapeamento do codigo atual para o banco

### Config do app

Hoje no localStorage:
- `app_config_v1`

No banco:
- `households.name`
- `households.household_type`
- `household_members.display_name`
- `households.logo_url` se quiser logo customizada por workspace

### Meta

Hoje no localStorage:
- `meta_v12`

No banco:
- `savings_goals`

### Cartoes

Hoje no localStorage:
- `cartoes_v12`

No banco:
- `cards`

### Cartao favorito por pessoa

Hoje no localStorage:
- `cartaoFavorito_v12`

No banco:
- `member_card_preferences`

### Gastos

Hoje no localStorage:
- `gastos_v12`

No banco:
- `expenses`

## Campos importantes em `expenses`

- `household_id`: separa os dados de cada casa
- `member_id`: quem pagou
- `card_id`: cartao usado, quando existir
- `payment_method`: normalizei para valores tecnicos
- `occurred_on`: data do gasto
- `is_fixed`: gasto fixo

## Categorias

No schema eu deixei `category` como texto simples porque o app atual tem categorias fixas no front:

- `Comida`
- `Lazer`
- `Mercado`
- `Viagem`
- `Outros`

Se depois voce quiser categorias customizaveis, o proximo passo seria criar:
- `expense_categories`

## Setup de Auth no dashboard

No projeto `Pluri`, configure:

- `Site URL`
- `Redirect URLs`
- `Email templates`
- `Reset password redirect`

Fluxos que o app deve suportar:

- signup com email/senha
- login
- esqueci minha senha
- atualizar senha apos recovery
- logout

## O que falta no codigo

O schema ja cobre a estrutura necessaria, mas o front ainda precisa ser migrado de:

- `localStorage`
- Google Apps Script / Sheets

para:

- Supabase Auth
- Supabase Database

## Ordem recomendada de implementacao

1. conectar Supabase no front
2. criar telas de login/cadastro/reset
3. criar onboarding
4. substituir leitura/escrita de configuracao
5. substituir leitura/escrita de cartoes
6. substituir leitura/escrita de gastos
7. remover dependencia de Sheets
