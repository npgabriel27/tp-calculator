import * as S from './store.js';
import * as Sync from './sync.js';

const { state } = S;

// ---------- utilitários ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = (v) => 'R$ ' + fmt(v, 2);
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dataHora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rotulo = (p) => `${p.marca} ${p.rolos}×${fmt(Number(p.metros), Number.isInteger(Number(p.metros)) ? 0 : 1)}${Number(p.folhas) === 3 ? ' 3F' : ''}`;
const pct = (a, b) => Math.round((a / b - 1) * 100);

const ROLOS = [4, 8, 12, 16, 24, 32];
const METROS = [20, 30, 40, 50, 60];

// ---------- estado da tela ----------

const ui = {
  tab: 'sessao',
  sel: { marca: null, rolos: null, metros: null, folhas: 2 },
  cents: 0,
  editId: null,
  novoAberto: false,
};

const selCompleta = () => ui.sel.marca && ui.sel.rolos > 0 && ui.sel.metros > 0;
const precoAtual = () => ui.cents / 100;
const limparEntrada = () => {
  ui.sel = { marca: null, rolos: null, metros: null, folhas: 2 };
  ui.cents = 0;
  ui.editId = null;
  ui.novoAberto = false;
};

// ---------- render: sessão ----------

function indicadorOferta(melhor) {
  const m = S.media({ excluirSessao: state.sessao?.id });
  if (!m || m.n < S.MIN_MEDIA) return '<div class="oferta muted">Ainda sem histórico suficiente para comparar com a média.</div>';
  const d = pct(S.mpr(melhor), m.valor);
  if (d >= S.LIMIAR_ESTOCAR) return `<div class="oferta destaque">${d}% acima da sua média: boa hora para estocar</div>`;
  if (d > 0) return `<div class="oferta">${d}% acima da média</div>`;
  if (d < 0) return `<div class="oferta muted">${-d}% abaixo da média</div>`;
  return '<div class="oferta muted">Na média</div>';
}

function renderSessao() {
  const regs = S.ordenar(S.regsSessao());
  const melhor = regs[0];

  $('#best').innerHTML = melhor
    ? `<div class="best-top">
         <span class="eyebrow">Melhor opção</span>
         <span class="best-preco">${brl(melhor.preco)}</span>
       </div>
       <div class="best-prod">${esc(rotulo(melhor))}</div>
       <div class="best-num"><b>${fmt(S.mpr(melhor))}</b><span>m/R$</span></div>
       ${indicadorOferta(melhor)}
       <button type="button" class="btn ${melhor.comprado ? 'btn-ok-ghost' : 'btn-primary'}" data-action="comprei" data-id="${melhor.id}">
         ${melhor.comprado ? '✓ Comprado' : 'Comprei este'}
       </button>`
    : `<div class="eyebrow">Melhor opção</div>
       <div class="vazio">Escolha um produto e digite o preço para começar.</div>`;
  $('#best').classList.toggle('empty', !melhor);

  const n = regs.length;
  $('#sessao-info').textContent = `Compra de ${dataCurta(state.sessao.inicio)} · ${n} ${n === 1 ? 'anotação' : 'anotações'}`;

  $('#lista').innerHTML = regs
    .map((r, i) => {
      const d = i === 0 ? '' : `${pct(S.mpr(r), S.mpr(melhor))}%`;
      return `<li class="item ${i === 0 ? 'top' : ''} ${r.comprado ? 'comprado' : ''} ${r.id === ui.editId ? 'editando' : ''}">
        <div class="item-main">
          <div class="item-title">${esc(rotulo(r))}</div>
          <div class="item-sub">${brl(r.preco)} · ${fmt(r.rolos * S.metrosEq(r), 0)} m</div>
        </div>
        <div class="item-num"><b>${fmt(S.mpr(r))}</b><small>${i === 0 ? 'melhor' : d.replace('-', '−')}</small></div>
        <div class="item-actions">
          <button type="button" class="icon ${r.comprado ? 'on' : ''}" data-action="comprei" data-id="${r.id}" aria-label="Comprei este">✓</button>
          <button type="button" class="icon" data-action="editar" data-id="${r.id}" aria-label="Editar">✎</button>
          <button type="button" class="icon" data-action="excluir" data-id="${r.id}" aria-label="Excluir">✕</button>
        </div>
      </li>`;
    })
    .join('');
}

// ---------- render: entrada ----------

function chip(label, action, v, on, extra = '') {
  return `<button type="button" class="chip ${on ? 'on' : ''} ${extra}" data-action="${action}" data-v="${esc(v)}">${esc(label)}</button>`;
}

function renderEntrada() {
  const s = ui.sel;
  const chaveSel = selCompleta() ? S.chaveProduto(s) : null;

  const produtos = state.produtos
    .filter((p) => S.marcaAtiva(p.marca))
    .sort((a, b) => a.marca.localeCompare(b.marca) || a.rolos - b.rolos || a.metros - b.metros);
  $('#produtos-chips').innerHTML =
    produtos.map((p) => chip(rotulo(p), 'prod', p.id, S.chaveProduto(p) === chaveSel)).join('') +
    chip(ui.novoAberto ? 'Fechar ▴' : '+ Novo', 'novo-toggle', '', false, 'ghost');

  $('#novo').hidden = !ui.novoAberto;
  if (ui.novoAberto) {
    const marcas = state.marcas.filter((m) => m.ativa).map((m) => m.nome);
    if (s.marca && !marcas.some((m) => m.toLowerCase() === s.marca.toLowerCase())) marcas.push(s.marca);
    $('#marca-chips').innerHTML =
      marcas.map((m) => chip(m, 'marca', m, s.marca === m)).join('') + chip('Outra…', 'marca-outra', '', false, 'ghost');

    const rolos = [...ROLOS];
    if (s.rolos && !rolos.includes(s.rolos)) rolos.push(s.rolos);
    $('#rolos-chips').innerHTML =
      rolos.map((n) => chip(String(n), 'rolos', n, s.rolos === n)).join('') + chip('Outro…', 'rolos-outro', '', false, 'ghost');

    const metros = [...METROS];
    if (s.metros && !metros.includes(s.metros)) metros.push(s.metros);
    $('#metros-chips').innerHTML =
      metros.map((n) => chip(fmt(n, Number.isInteger(n) ? 0 : 1), 'metros', n, s.metros === n)).join('') +
      chip('Outro…', 'metros-outro', '', false, 'ghost');

    $('#folhas-chips').innerHTML =
      chip('Dupla (2F)', 'folhas', 2, Number(s.folhas) === 2) + chip('Tripla (3F)', 'folhas', 3, Number(s.folhas) === 3);
  }

  $('#edit-banner').hidden = !ui.editId;
  $('#produto-atual').textContent = selCompleta()
    ? rotulo(s)
    : ui.novoAberto
      ? 'Complete marca, rolos e metros'
      : 'Escolha um produto';
  $('#preco').textContent = brl(precoAtual());
  $('#preco').classList.toggle('zero', ui.cents === 0);
  $('#btn-ok').textContent = ui.editId ? 'Salvar' : 'Anotar';
  $('#btn-ok').disabled = !(selCompleta() && ui.cents > 0);

  renderComparacao();
}

function renderComparacao() {
  const el = $('#comparacao');
  el.className = 'comparacao';
  if (!selCompleta() || ui.cents === 0) {
    el.textContent = '';
    return;
  }
  const x = S.mpr({ ...ui.sel, preco: precoAtual() });
  const outros = S.ordenar(S.regsSessao().filter((r) => r.id !== ui.editId));
  let txt = `${fmt(x)} m/R$`;
  if (outros.length) {
    const d = pct(x, S.mpr(outros[0]));
    if (d > 0) {
      txt += ` · ${d}% melhor que a atual`;
      el.classList.add('melhor');
    } else if (d < 0) {
      txt += ` · ${-d}% pior`;
      el.classList.add('pior');
    } else {
      txt += ' · igual à atual';
    }
  } else {
    txt += ' · primeira da compra';
  }
  el.textContent = txt;
}

// ---------- render: histórico ----------

function renderHistorico() {
  const m = S.media();
  const top = S.melhorDeTodos();
  const sess = S.sessoes();

  const lista = sess
    .map((s) => {
      const comprados = s.regs.filter((r) => r.comprado);
      const atual = s.id === state.sessao?.id;
      const resumo = comprados.length
        ? 'Comprou: ' + comprados.map((r) => `${esc(rotulo(r))} por ${brl(r.preco)} (${fmt(S.mpr(r))} m/R$)`).join('; ')
        : 'Nada marcado como comprado';
      return `<details class="hist-sessao">
        <summary>
          <div class="hist-top"><b>${dataCurta(s.inicio)}</b>${atual ? ' <span class="tag">atual</span>' : ''}
            <span class="muted"> · ${s.regs.length} ${s.regs.length === 1 ? 'anotação' : 'anotações'}</span></div>
          <div class="hist-resumo ${comprados.length ? '' : 'muted'}">${resumo}</div>
        </summary>
        <ul class="hist-regs">
          ${s.regs
            .map(
              (r) => `<li class="${r.comprado ? 'comprado' : ''}"><span>${esc(rotulo(r))}${r.comprado ? ' ✓' : ''}</span>
                <span class="muted">${brl(r.preco)}</span><b>${fmt(S.mpr(r))}</b></li>`,
            )
            .join('')}
        </ul>
      </details>`;
    })
    .join('');

  $('#tab-historico').innerHTML = `
    <div class="stats">
      <div class="stat">
        <span class="eyebrow">Média · 6 meses</span>
        <b>${m ? fmt(m.valor) : '—'}</b>
        <span class="muted">${m ? `m/R$ · ${m.n} ${m.n === 1 ? 'anotação' : 'anotações'}` : 'sem anotações'}</span>
      </div>
      <div class="stat">
        <span class="eyebrow">Melhor já visto</span>
        <b class="verde">${top ? fmt(S.mpr(top)) : '—'}</b>
        <span class="muted">${top ? `${esc(rotulo(top))} · ${brl(top.preco)} · ${dataCurta(top.data)}` : 'sem anotações'}</span>
      </div>
    </div>
    <h2>Compras</h2>
    ${lista || '<p class="muted">Nenhuma compra anotada ainda.</p>'}
  `;
}

// ---------- render: ajustes ----------

function statusSync() {
  if (!Sync.configurado()) return 'Sincronização desligada: preencha a URL e o token.';
  const partes = [];
  if (Sync.sincronizando()) partes.push('Sincronizando…');
  const n = state.fila.length;
  partes.push(n ? `${n} ${n === 1 ? 'alteração pendente' : 'alterações pendentes'}` : 'Tudo enviado');
  if (state.ultimaSync) partes.push(`última sincronização ${dataHora(state.ultimaSync)}`);
  if (Sync.ultimoErro) partes.push(`erro: ${Sync.ultimoErro}`);
  return partes.join(' · ');
}

function renderStatusSync() {
  const el = $('#sync-status');
  if (el) {
    el.textContent = statusSync();
    el.classList.toggle('erro', Boolean(Sync.ultimoErro));
  }
}

function renderAjustes() {
  const marcas = state.marcas
    .map(
      (m) => `<li>
        <label class="toggle"><input type="checkbox" data-action="marca-toggle" data-id="${m.id}" ${m.ativa ? 'checked' : ''}>
          <span>${esc(m.nome)}</span></label>
        <button type="button" class="icon" data-action="marca-remover" data-id="${m.id}" aria-label="Remover ${esc(m.nome)}">✕</button>
      </li>`,
    )
    .join('');

  const produtos = [...state.produtos]
    .sort((a, b) => a.marca.localeCompare(b.marca) || a.rolos - b.rolos)
    .map(
      (p) => `<li><span>${esc(rotulo(p))}${S.marcaAtiva(p.marca) ? '' : ' <span class="muted">(marca inativa)</span>'}</span>
        <button type="button" class="icon" data-action="produto-remover" data-id="${p.id}" aria-label="Esquecer">✕</button></li>`,
    )
    .join('');

  $('#tab-ajustes').innerHTML = `
    <h2>Marcas</h2>
    <ul class="ajustes-lista">${marcas}</ul>
    <form class="linha-form" data-form="marca">
      <input name="nome" placeholder="Nova marca" autocomplete="off" enterkeyhint="done">
      <button type="submit" class="btn">Incluir</button>
    </form>

    <h2>Produtos memorizados</h2>
    <ul class="ajustes-lista">${produtos || '<li class="muted">Nenhum ainda.</li>'}</ul>

    <h2>Folha tripla</h2>
    <label class="campo-form">
      <span>Fator sobre a folha dupla (20 m de tripla = 20 × fator)</span>
      <input id="fator" inputmode="decimal" value="${fmt(S.fator(), 2)}">
    </label>

    <h2>Google Sheets</h2>
    <label class="campo-form">
      <span>URL do Apps Script</span>
      <input id="script-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(state.settings.scriptUrl)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <label class="campo-form">
      <span>Token</span>
      <input id="token" type="password" value="${esc(state.settings.token)}" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <p class="muted pequeno">Ficam guardados só neste aparelho.</p>
    <div class="botoes">
      <button type="button" class="btn btn-primary" data-action="sync">Sincronizar agora</button>
      <button type="button" class="btn" data-action="restaurar">Restaurar da planilha</button>
    </div>
    <p id="sync-status" class="muted pequeno"></p>
  `;
  renderStatusSync();
}

// ---------- render geral ----------

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${ui.tab}`));
  $('#entrada').hidden = ui.tab !== 'sessao';
  if (ui.tab === 'sessao') {
    renderSessao();
    renderEntrada();
  } else if (ui.tab === 'historico') {
    renderHistorico();
  } else {
    renderAjustes();
  }
}

// ---------- ações ----------

function pedirNumero(msg) {
  const v = prompt(msg);
  if (v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return n > 0 ? n : null;
}

function confirmarEntrada() {
  if (!selCompleta() || ui.cents === 0) return;
  const dados = { ...ui.sel, folhas: Number(ui.sel.folhas), preco: precoAtual() };
  if (ui.editId) S.editarRegistro(ui.editId, dados);
  else S.anotar(dados);
  limparEntrada();
  render();
  $('#main').scrollTo({ top: 0, behavior: 'smooth' });
}

async function comFeedback(botao, fn, ok) {
  botao.disabled = true;
  try {
    await fn();
    if (ok) alert(ok);
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    botao.disabled = false;
    renderStatusSync();
  }
}

const acoes = {
  tab: (b) => {
    ui.tab = b.dataset.tab;
    render();
    $('#main').scrollTo({ top: 0 });
  },
  prod: (b) => {
    const p = state.produtos.find((x) => x.id === b.dataset.v);
    if (!p) return;
    ui.sel = { marca: p.marca, rolos: p.rolos, metros: p.metros, folhas: p.folhas };
    ui.novoAberto = false;
    renderEntrada();
  },
  'novo-toggle': () => {
    ui.novoAberto = !ui.novoAberto;
    renderEntrada();
  },
  marca: (b) => { ui.sel.marca = b.dataset.v; renderEntrada(); },
  'marca-outra': () => {
    const m = S.adicionarMarca(prompt('Nome da marca'));
    if (m) ui.sel.marca = m.nome;
    renderEntrada();
  },
  rolos: (b) => { ui.sel.rolos = Number(b.dataset.v); renderEntrada(); },
  'rolos-outro': () => {
    const n = pedirNumero('Quantos rolos?');
    if (n) ui.sel.rolos = Math.round(n);
    renderEntrada();
  },
  metros: (b) => { ui.sel.metros = Number(b.dataset.v); renderEntrada(); },
  'metros-outro': () => {
    const n = pedirNumero('Metros por rolo?');
    if (n) ui.sel.metros = n;
    renderEntrada();
  },
  folhas: (b) => { ui.sel.folhas = Number(b.dataset.v); renderEntrada(); },
  key: (b) => {
    const k = b.dataset.k;
    if (k === 'ok') return confirmarEntrada();
    if (k === 'back') ui.cents = Math.floor(ui.cents / 10);
    else if (ui.cents < 100000) ui.cents = ui.cents * 10 + Number(k); // até R$ 9.999,99
    renderEntrada();
  },
  'cancelar-edicao': () => { limparEntrada(); render(); },
  comprei: (b) => S.alternarComprado(b.dataset.id),
  editar: (b) => {
    const r = state.registros.find((x) => x.id === b.dataset.id);
    if (!r) return;
    ui.editId = r.id;
    ui.sel = { marca: r.marca, rolos: r.rolos, metros: r.metros, folhas: r.folhas };
    ui.cents = Math.round(r.preco * 100);
    ui.novoAberto = true;
    render();
  },
  excluir: (b) => {
    const r = state.registros.find((x) => x.id === b.dataset.id);
    if (r && confirm(`Excluir ${rotulo(r)} a ${brl(r.preco)}?`)) {
      if (ui.editId === r.id) limparEntrada();
      S.excluirRegistro(r.id);
    }
  },
  'nova-compra': () => {
    if (S.regsSessao().length && !confirm('Começar uma nova compra? A atual vai para o histórico.')) return;
    limparEntrada();
    S.novaSessao();
  },
  'marca-remover': (b) => {
    const m = state.marcas.find((x) => x.id === b.dataset.id);
    if (m && confirm(`Remover a marca ${m.nome}? As anotações antigas continuam no histórico.`)) S.removerMarca(m.id);
  },
  'produto-remover': (b) => S.removerProduto(b.dataset.id),
  sync: (b) => comFeedback(b, () => Sync.sincronizar(), 'Sincronizado.'),
  restaurar: (b) => {
    if (!confirm('Substituir os dados deste aparelho pelos da planilha?')) return;
    comFeedback(b, () => Sync.restaurar(), 'Dados restaurados da planilha.');
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled || b.type === 'checkbox') return;
  acoes[b.dataset.action]?.(b);
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.action === 'marca-toggle') return S.alternarMarca(t.dataset.id);
  if (t.id === 'fator') {
    const f = Number(t.value.replace(',', '.'));
    if (f >= 1 && f <= 3) S.salvarAjustes({ fatorTripla: f });
    else {
      alert('Use um fator entre 1 e 3.');
      renderAjustes();
    }
  }
  if (t.id === 'script-url') S.salvarAjustes({ scriptUrl: t.value.trim() });
  if (t.id === 'token') S.salvarAjustes({ token: t.value.trim() });
});

document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.form !== 'marca') return;
  e.preventDefault();
  S.adicionarMarca(f.nome.value);
});

// teclado físico (útil no computador)
document.addEventListener('keydown', (e) => {
  if (ui.tab !== 'sessao' || e.target.matches('input, textarea')) return;
  if (/^[0-9]$/.test(e.key)) acoes.key({ dataset: { k: e.key } });
  else if (e.key === 'Backspace') acoes.key({ dataset: { k: 'back' } });
  else if (e.key === 'Enter') acoes.key({ dataset: { k: 'ok' } });
});

// ---------- ciclo de vida ----------

S.onChange(({ silencioso }) => {
  if (silencioso) renderStatusSync();
  else render();
  Sync.agendar();
});
Sync.onStatus(renderStatusSync);

function aoVoltar() {
  if (S.ensureSession()) {
    limparEntrada();
    render();
  }
  if (Sync.configurado() && state.fila.length && navigator.onLine) Sync.sincronizar().catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') aoVoltar();
});
window.addEventListener('online', aoVoltar);

S.ensureSession();
render();
aoVoltar();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
