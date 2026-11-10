# tp-calculator — Plano

PWA para descobrir, no mercado, qual pacote de papel higiênico oferece o melhor **m/R$** (metros por real).

- Uso pessoal, no iPhone (Safari → Compartilhar → Adicionar à Tela de Início)
- Hospedagem: GitHub Pages — `https://npgabriel27.github.io/tp-calculator/`
- Backup e histórico: Google Sheets

## Regras de cálculo

- **m/R$** = rolos × metros equivalentes ÷ preço
- **Metros equivalentes:** a base é a folha dupla.
  - Folha dupla: fator 1.
  - Folha tripla: fator **1,33** por padrão, ajustável nos Ajustes. Exemplo: 20 m de tripla contam como 26,6 m de dupla.
- **Promoções:** você digita a quantidade levada e o preço final, por exemplo "leve 12, pague 11" vira 12 rolos com o preço pago. Preço de clube é digitado direto, sem campo especial.

## Telas

### 1. Sessão (tela principal)
- **Card fixo no topo:** a melhor opção da sessão, com o m/R$ em destaque.
- **Produtos memorizados:** botões como "Neve 12×30" e "Personal 16×30". Ao tocar num deles, você digita só o preço.
- **Produto novo:** botões para escolher marca, rolos, metros e tipo de folha (2F/3F), com opção de digitar outro valor.
- **Campo de preço:** teclado numérico que preenche da direita para a esquerda, sem vírgula. Exemplo: 1-2-9-0 vira R$ 12,90.
- **Comparação ao vivo:** enquanto você digita, aparece algo como "12% melhor que a atual" ou "5% pior".
- **Lista da sessão:**
  - Opções ordenadas da melhor para a pior, com a diferença percentual em relação à melhor.
  - Cada item pode ser editado ou excluído.
- **Botão "Comprei este".**
- **Início de sessão:** uma nova sessão começa sozinha se a última anotação tiver mais de 6 h. Também há um botão "Nova compra".

### 2. Histórico
- Média geral de m/R$ dos últimos 6 meses.
- Melhor m/R$ já visto.
- Sessões anteriores, mostrando o que foi comprado em cada uma.

### 3. Ajustes
- Marcas: incluir, remover e ativar/desativar. Começa com **Personal** e **Neve**.
- Fator da folha tripla.
- URL do Apps Script e token, guardados só no celular.
- Botões "Sincronizar agora" e "Restaurar da planilha".

## Indicador de oferta

O card da melhor opção compara o m/R$ com a sua média geral dos últimos 6 meses (sem contar a sessão atual). Exemplos:

- "18% acima da sua média: boa hora para estocar" (a partir de 10% acima)
- "6% abaixo da média"

Aqui, "acima" quer dizer mais metros por real, ou seja, melhor. O indicador só aparece com pelo menos 3 anotações no período.

## Dados

O celular é a base principal: o app funciona 100% offline. O Google Sheets serve de backup e sincroniza quando há internet.

### Planilha (três abas)

| Aba | Campos |
|---|---|
| `marcas` | id, nome, ativa |
| `produtos` | id, marca, rolos, metros, folhas (2/3) |
| `registros` | id, data, sessao, marca, rolos, metros, folhas, preco, m_por_real, comprado |

A aba `registros` guarda **todos os preços anotados**, não só o do produto comprado, para que a média seja mais confiável.

### Sincronização
- **Ponte com a planilha:** um Google Apps Script ligado à planilha, publicado como Web App.
- **Formato das requisições:** POST com `Content-Type: text/plain`. Isso evita a verificação prévia de CORS (preflight) que o Apps Script não aceita.
- **Fila offline:** registros novos entram numa fila local e são enviados quando há conexão.
- **IDs gerados no cliente:** permitem reenviar sem duplicar registros.
- **Restauração:** baixa tudo da planilha, para quando o iOS apagar os dados locais.
- **Segredos:** a URL do script e o token **nunca entram no repositório**, que é público.

## Visual

- **Aparência:** clean, com fundo claro e modo escuro automático.
- **Destaque:** números grandes e uma única cor de destaque (verde) para a melhor opção.
- **Uso com uma mão:** a área de digitação fica embaixo, ao alcance do polegar.
- **iPhone:** respeita as áreas seguras da tela (`safe-area`), tem `apple-touch-icon` e abre em tela cheia (modo standalone).

## Tecnologia

- HTML, CSS e JS puros (ES modules), sem etapa de build.
- `manifest.webmanifest` e service worker (`sw.js`) para funcionar offline e permitir a instalação.
- Armazenamento local em `localStorage`.
- Estrutura:

```
index.html
style.css
app.js          # telas e interação
store.js        # estado local, cálculo, fila de sincronização
sync.js         # comunicação com o Apps Script
sw.js
manifest.webmanifest
icons/
apps-script/Code.gs   # código do script, sem segredos
PLANO.md
```

## Fases

1. **Versão mínima (só no celular):** sessão, cadastro, destaque, comparação ao vivo, marcas, produtos memorizados, folha tripla, funcionamento offline e publicação no Pages.
2. **Sincronização com o Sheets:** script, fila offline e restauração.
3. **Histórico e indicador de oferta.**

## Fora do escopo por enquanto

- Leitura de etiqueta ou código de barras pela câmera
- Uso por mais de uma pessoa
- Campo separado para preço de clube ou promoções
- Média por produto

## Decisões

1. Fator da folha tripla: **1,33**, ajustável.
2. A média que define "oferta" usa os **últimos 6 meses**.
3. Só **média geral** (sem média por produto).
4. Usuário do GitHub: **npgabriel27**.
