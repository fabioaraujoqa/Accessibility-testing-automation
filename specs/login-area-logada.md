# Plano de testes de acessibilidade: login → área logada

## Application Overview

Jornada de acessibilidade da app de demonstração (http://localhost:4173): login.html (heading "Entrar", textbox "Usuário", textbox "Senha", button "Entrar") → area-logada.html (heading "Olá, <usuário>", table "Últimos lançamentos"). Credenciais fictícias: usuario-demo / senha-demo. Sessão guardada em localStorage['demo-sessao']; sem sessão, area-logada.html redireciona para login.html. Explorado via snapshots em 2026-11-13. Nota: planner_setup_page só funcionou com project "a11y" e abriu outra URL (grupocarrefourbrasil.com.br), ignorada; a exploração partiu de login.html. Estados de scan = nomes sugeridos para lib/journey.ts. Escopo = trecho que mudou.

## Test Scenarios

### 1. Jornada login → área logada (a11y)

**Seed:** `tests/seed.spec.ts`

#### 1.1. Caminho feliz: login válido leva à área logada

**File:** `tests/journeys/login-area-logada.a11y.spec.ts`

**Steps:**
  1. Navegar para http://localhost:4173/login.html (sem sessão). ESTADO 'login-inicial'. Escopo: main (heading 'Entrar' + form#form-login com textbox 'Usuário', textbox 'Senha', button 'Entrar').
    - expect: Título 'Demo · Entrar'; html lang=pt-BR
    - expect: Scan axe sem violações novas
    - expect: Cada campo tem label associado (label for=usuario/senha) e autocomplete username/current-password
  2. Preencher textbox 'Usuário' com usuario-demo e textbox 'Senha' com senha-demo. ESTADO opcional 'login-preenchido'. Escopo: form#form-login.
    - expect: Sem mudança de estrutura; sem violações
  3. Clicar em button 'Entrar'. ESTADO 'area-logada'. Escopo: main (heading 'Olá, usuario-demo' + table 'Últimos lançamentos').
    - expect: URL http://localhost:4173/area-logada.html; título 'Demo · Minha conta'
    - expect: heading level 1 'Olá, usuario-demo'
    - expect: table com caption 'Últimos lançamentos', columnheaders Data/Descrição/Valor (th scope=col) e 2 linhas (10/11 Supermercado R$ 152,30; 08/11 Farmácia R$ 48,90)
    - expect: Scan axe sem violações novas

#### 1.2. Envio com campos vazios

**File:** `tests/journeys/login-vazio.a11y.spec.ts`

**Steps:**
  1. Abrir login.html. ESTADO 'login-inicial' (escopo main).
    - expect: Formulário renderizado, nenhum erro visível
  2. Clicar em button 'Entrar' sem preencher nada. ESTADO 'login-erro-validacao'. Escopo: form#form-login (textbox 'Usuário' e 'Senha', ambos required).
    - expect: URL permanece em login.html
    - expect: Validação nativa do navegador: foco vai para textbox 'Usuário'; validationMessage 'Preencha este campo.' em ambos os campos
    - expect: Nenhum elemento role=alert, aria-live ou aria-invalid no DOM; nenhum texto de erro no body (body.innerText = 'Entrar Usuário Senha Entrar')
    - expect: O scan axe não enxerga o balão nativo (não faz parte do DOM): validar foco e validationMessage por asserção explícita
  3. Preencher só 'Usuário' e enviar. ESTADO 'login-erro-senha'. Escopo: textbox 'Senha'.
    - expect: Foco deve ir para textbox 'Senha' com validationMessage; URL permanece em login.html

#### 1.3. Acesso direto à área logada sem sessão

**File:** `tests/journeys/area-logada-sem-sessao.a11y.spec.ts`

**Steps:**
  1. Com localStorage limpo (sem 'demo-sessao'), navegar para http://localhost:4173/area-logada.html. ESTADO 'redirecionado-login'. Escopo: main (form de login).
    - expect: Redireciona para login.html; título 'Demo · Entrar'; heading 'Entrar'
    - expect: Nenhum dado da área logada (tabela de lançamentos) é exposto
    - expect: Scan axe sem violações novas

#### 1.4. Navegação só por teclado na jornada

**File:** `tests/keyboard/login-area-logada.kbd.spec.ts`

**Steps:**
  1. Em login.html, pressionar Tab: Usuário → Senha → Entrar; digitar credenciais; Enter no campo Senha. ESTADO 'login-inicial' e 'area-logada'.
    - expect: Ordem de foco lógica, foco visível em cada controle, sem armadilha
    - expect: Enter envia o formulário e chega a area-logada.html
