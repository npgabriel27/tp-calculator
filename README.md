# tp-calculator
Calculadora de ofertas de papel higiênico: mostra qual pacote rende mais **metros por real** (m/R$).

App: https://npgabriel27.github.io/tp-calculator/

Detalhes e regras em [PLANO.md](PLANO.md).

## Instalar no iPhone

Abra o link no Safari → Compartilhar → **Adicionar à Tela de Início**.

## Rodar localmente

Não há build. Sirva a pasta com qualquer servidor estático, por exemplo:

```sh
python -m http.server 8000
```

e abra http://localhost:8000.

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

Ao publicar mudanças, aumente `VERSAO` em `sw.js` para os aparelhos descartarem o cache antigo.

## Backup no Google Sheets (opcional)

1. Crie uma planilha no Google Sheets.
2. **Extensões → Apps Script**. Cole o conteúdo de [apps-script/Code.gs](apps-script/Code.gs) e salve.
3. **Configurações do projeto → Propriedades do script → Adicionar**: nome `TOKEN`, valor = uma senha longa qualquer.
4. No editor, rode a função `criarAbas` uma vez e autorize o acesso.
5. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL que termina em `/exec`.
7. No app, em **Ajustes → Google Sheets**, cole a URL e o token e toque em **Sincronizar agora**.

A URL e o token ficam só no aparelho e nunca entram no repositório.
Se o iOS apagar os dados do app, use **Restaurar da planilha**.

Ao alterar o `Code.gs`, faça **Implantar → Gerenciar implantações → Editar → Nova versão** para manter a mesma URL.
