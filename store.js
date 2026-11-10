// Estado local, regras de cálculo e fila de sincronização.
// O celular é a fonte principal; tudo fica em localStorage.

const KEY = 'tpc:v1';
const HORA = 3600e3;

export const GAP_SESSAO = 6 * HORA;            // nova sessão após 6 h sem anotações
export const JANELA_MEDIA = 183 * 24 * HORA;   // média dos últimos ~6 meses
export const MIN_MEDIA = 3;                    // anotações mínimas para mostrar o indicador
export const LIMIAR_ESTOCAR = 10;              // % acima da média para sugerir estocar
export const FATOR_PADRAO = 1.33;

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function padrao() {
  return {
    settings: { fatorTripla: FATOR_PADRAO, scriptUrl: '', token: '' },
    marcas: [
      { id: 'personal', nome: 'Personal', ativa: true },
      { id: 'neve', nome: 'Neve', ativa: true },
    ],
    produtos: [
      { id: 'neve-12x30-2', marca: 'Neve', rolos: 12, metros: 30, folhas: 2 },
      { id: 'personal-16x30-2', marca: 'Personal', rolos: 16, metros: 30, folhas: 2 },
    ],
    registros: [],
    sessao: null,       // { id, inicio }
    fila: [],           // operações pendentes para a planilha
    seq: 0,
    ultimaSync: null,
  };
}

function carregar() {
  const base = padrao();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...base, ...s, settings: { ...base.settings, ...s.settings } };
    }
  } catch { /* dados corrompidos: começa do zero */ }
  return base;
}

export const state = carregar();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const ouvintes = new Set();
export function onChange(fn) { ouvintes.add(fn); }
// silencioso: salva sem redesenhar a tela (ex.: campos de Ajustes sendo editados)
function commit({ silencioso = false } = {}) {
  save();
  ouvintes.forEach((fn) => fn({ silencioso }));
}

// ---------- cálculo ----------

export const fator = () => {
  const f = Number(state.settings.fatorTripla);
  return f > 0 ? f : FATOR_PADRAO;
};
export const metrosEq = (p) => Number(p.metros) * (Number(p.folhas) === 3 ? fator() : 1);
export const mpr = (r) => (r.preco > 0 ? (Number(r.rolos) * metrosEq(r)) / r.preco : 0);
export const ordenar = (regs) => [...regs].sort((a, b) => mpr(b) - mpr(a));
export const chaveProduto = (p) =>
  `${String(p.marca).toLowerCase()}|${Number(p.rolos)}|${Number(p.metros)}|${Number(p.folhas)}`;

// ---------- sessão ----------

export function ensureSession(agora = Date.now()) {
  const s = state.sessao;
  if (s) {
    const datas = state.registros.filter((r) => r.sessao === s.id).map((r) => Date.parse(r.data));
    const ultimo = Math.max(Date.parse(s.inicio) || 0, ...datas);
    if (agora - ultimo <= GAP_SESSAO) return false;
  }
  state.sessao = { id: uid(), inicio: new Date(agora).toISOString() };
  save();
  return true;
}

export function novaSessao() {
  state.sessao = { id: uid(), inicio: new Date().toISOString() };
  commit();
}

export const regsSessao = () => state.registros.filter((r) => r.sessao === state.sessao?.id);

// ---------- fila de sincronização ----------

function enfileirar(aba, op, item) {
  state.fila = state.fila.filter((o) => !(o.aba === aba && o.id === item.id));
  state.seq = (state.seq || 0) + 1;
  const dados =
    op === 'delete'
      ? { id: item.id }
      : aba === 'registros'
        ? { ...item, m_por_real: Math.round(mpr(item) * 1000) / 1000 }
        : { ...item };
  state.fila.push({ seq: state.seq, aba, op, id: item.id, item: dados });
}

// ---------- registros ----------

export function anotar({ marca, rolos, metros, folhas, preco }) {
  ensureSession();
  const r = {
    id: uid(),
    data: new Date().toISOString(),
    sessao: state.sessao.id,
    marca, rolos, metros, folhas, preco,
    comprado: false,
  };
  state.registros.push(r);
  enfileirar('registros', 'upsert', r);
  memorizar(r);
  commit();
  return r;
}

export function editarRegistro(id, { marca, rolos, metros, folhas, preco }) {
  const r = state.registros.find((x) => x.id === id);
  if (!r) return;
  Object.assign(r, { marca, rolos, metros, folhas, preco });
  enfileirar('registros', 'upsert', r);
  memorizar(r);
  commit();
}

export function excluirRegistro(id) {
  const r = state.registros.find((x) => x.id === id);
  if (!r) return;
  state.registros = state.registros.filter((x) => x.id !== id);
  enfileirar('registros', 'delete', r);
  commit();
}

export function alternarComprado(id) {
  const r = state.registros.find((x) => x.id === id);
  if (!r) return;
  r.comprado = !r.comprado;
  enfileirar('registros', 'upsert', r);
  commit();
}

// ---------- produtos memorizados ----------

function memorizar(p) {
  const k = chaveProduto(p);
  if (state.produtos.some((x) => chaveProduto(x) === k)) return;
  const novo = { id: uid(), marca: p.marca, rolos: p.rolos, metros: p.metros, folhas: p.folhas };
  state.produtos.push(novo);
  enfileirar('produtos', 'upsert', novo);
}

export function removerProduto(id) {
  const p = state.produtos.find((x) => x.id === id);
  if (!p) return;
  state.produtos = state.produtos.filter((x) => x.id !== id);
  enfileirar('produtos', 'delete', p);
  commit();
}

// ---------- marcas ----------

export function adicionarMarca(nome) {
  nome = String(nome || '').trim();
  if (!nome) return null;
  let m = state.marcas.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
  if (m) {
    if (!m.ativa) {
      m.ativa = true;
      enfileirar('marcas', 'upsert', m);
    }
  } else {
    m = { id: uid(), nome, ativa: true };
    state.marcas.push(m);
    enfileirar('marcas', 'upsert', m);
  }
  commit();
  return m;
}

export function alternarMarca(id) {
  const m = state.marcas.find((x) => x.id === id);
  if (!m) return;
  m.ativa = !m.ativa;
  enfileirar('marcas', 'upsert', m);
  commit();
}

export function removerMarca(id) {
  const m = state.marcas.find((x) => x.id === id);
  if (!m) return;
  state.marcas = state.marcas.filter((x) => x.id !== id);
  enfileirar('marcas', 'delete', m);
  commit();
}

export const marcaAtiva = (nome) =>
  state.marcas.some((m) => m.ativa && m.nome.toLowerCase() === String(nome).toLowerCase());

// ---------- ajustes ----------

export function salvarAjustes(campos) {
  Object.assign(state.settings, campos);
  commit({ silencioso: true });
}

export function marcarSync() {
  state.ultimaSync = new Date().toISOString();
  commit({ silencioso: true });
}

export function confirmarEnvio(seqs) {
  const enviados = new Set(seqs);
  state.fila = state.fila.filter((o) => !enviados.has(o.seq));
}

// ---------- estatísticas ----------

export function media({ excluirSessao } = {}) {
  const limite = Date.now() - JANELA_MEDIA;
  const regs = state.registros.filter(
    (r) => r.preco > 0 && Date.parse(r.data) >= limite && r.sessao !== excluirSessao,
  );
  if (!regs.length) return null;
  return { valor: regs.reduce((s, r) => s + mpr(r), 0) / regs.length, n: regs.length };
}

export const melhorDeTodos = () => ordenar(state.registros)[0] || null;

export function sessoes() {
  const grupos = new Map();
  for (const r of state.registros) {
    if (!grupos.has(r.sessao)) grupos.set(r.sessao, []);
    grupos.get(r.sessao).push(r);
  }
  return [...grupos.entries()]
    .map(([id, regs]) => ({
      id,
      inicio: regs.reduce((min, r) => (r.data < min ? r.data : min), regs[0].data),
      regs: ordenar(regs),
    }))
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
}

// ---------- restauração ----------

const bool = (v) => v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
const num = (v) => Number(String(v).replace(',', '.')) || 0;
const iso = (v) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
};

export function substituirDados({ marcas = [], produtos = [], registros = [] }) {
  state.marcas = marcas
    .filter((m) => m.id && m.nome)
    .map((m) => ({ id: String(m.id), nome: String(m.nome), ativa: bool(m.ativa) }));
  state.produtos = produtos
    .filter((p) => p.id)
    .map((p) => ({ id: String(p.id), marca: String(p.marca), rolos: num(p.rolos), metros: num(p.metros), folhas: num(p.folhas) === 3 ? 3 : 2 }));
  state.registros = registros
    .filter((r) => r.id)
    .map((r) => ({
      id: String(r.id),
      data: iso(r.data),
      sessao: String(r.sessao),
      marca: String(r.marca),
      rolos: num(r.rolos),
      metros: num(r.metros),
      folhas: num(r.folhas) === 3 ? 3 : 2,
      preco: num(r.preco),
      comprado: bool(r.comprado),
    }));
  state.fila = [];
  const ultimo = [...state.registros].sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  state.sessao = ultimo ? { id: ultimo.sessao, inicio: ultimo.data } : null;
  ensureSession();
  commit();
}
