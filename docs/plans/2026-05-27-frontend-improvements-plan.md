# Frontend Improvements Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implementar as 3 sugestões de melhorias arquiteturais no front-end: remoção de código morto, adoção de bundler (Vite) e implementação de store state pattern.

**Architecture:** 
1. Limpeza do repositório apagando HTMLs órfãos que já foram migrados para o `app.html`.
2. Adicionar suporte ao Vite para build e minificação de assets via `package.json` e `vite.config.js`.
3. Criar uma classe simples `Store` em `js/store.js` baseada no padrão Pub/Sub ou proxy reativo para centralizar dados compartilhados em memória, reduzindo a dependência excessiva no LocalStorage.

**Tech Stack:** Vanilla JavaScript, Vite, Node.js (NPM).

---

### Task 1: Remover Arquivos HTML Residuais

**Files:**
- Delete: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/dashboard.html`
- Delete: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/estoque.html`
- Delete: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/funcionarios.html`
- Delete: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/inventory-list.html`
- Delete: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/patient.html`

**Step 1: Apagar os arquivos órfãos via comando de terminal**

Run: `Remove-Item "dashboard.html", "estoque.html", "funcionarios.html", "inventory-list.html", "patient.html"`
Expected: Arquivos devem ser removidos com sucesso.

**Step 2: Verificar limpeza do diretório**

Run: `ls *.html`
Expected: Deve exibir apenas `app.html`, `index.html`, `login.html`, `home-screen.html`, `preview-logos.html`.

**Step 3: Commit**

```bash
git add .
git commit -m "chore: remove arquivos HTML legados unificados no app.html"
```

---

### Task 2: Configurar Minificação e Build (Vite)

**Files:**
- Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/package.json`
- Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/vite.config.js`

**Step 1: Inicializar o NPM e Vite**

Run: `npm init -y`
Expected: `package.json` criado com sucesso.

**Step 2: Instalar o Vite como dependência de desenvolvimento**

Run: `npm install -D vite`
Expected: Pasta `node_modules` gerada e Vite instalado.

**Step 3: Criar vite.config.js básico**

Criar arquivo `vite.config.js` com suporte para múltiplos entry points (`login.html` e `app.html`):

```javascript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html')
      }
    }
  }
});
```

**Step 4: Atualizar package.json scripts**

Adicionar os scripts `"dev": "vite", "build": "vite build", "preview": "vite preview"` no `package.json`.

**Step 5: Testar o build**

Run: `npm run build`
Expected: A pasta `dist` deve ser criada com os arquivos minificados.

**Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "build: configurar Vite para minificacao e bundler"
```

---

### Task 3: Gerenciamento de Estado (Store Pattern)

**Files:**
- Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/js/store.js`
- Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/app.html`

**Step 1: Criar classe Global Store**

Criar arquivo `js/store.js`:

```javascript
/**
 * js/store.js - Store simples baseada em Event Target
 */
class AppStore extends EventTarget {
    constructor() {
        super();
        this.state = {
            userRole: localStorage.getItem('sgdm_userRole') || null,
            userName: localStorage.getItem('sgdm_userName') || null,
            notifications: []
        };
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
}

window.globalStore = new AppStore();
```

**Step 2: Injetar store.js no app.html**

No `app.html`, adicione a linha de importação no HEAD antes do `config.js`.

**Step 3: Testar funcionamento no Console (Verificação)**

Abrir a aplicação (ou não causar erro de syntax error), checar que `window.globalStore` é injetado.

**Step 4: Commit**

```bash
git add js/store.js app.html
git commit -m "feat: adicionar pattern de gerencia de estado centralizado"
```
