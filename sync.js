// Sincronização com o Google Sheets via Apps Script publicado como Web App.
// POST com Content-Type text/plain evita o preflight de CORS, que o Apps Script não aceita.

import { state, confirmarEnvio, marcarSync, substituirDados } from './store.js';

let emAndamento = null;
let timer = null;
export let ultimoErro = null;

const ouvintes = new Set();
export function onStatus(fn) { ouvintes.add(fn); }
const avisar = () => ouvintes.forEach((fn) => fn());

export const configurado = () => Boolean(state.settings.scriptUrl && state.settings.token);
export const sincronizando = () => Boolean(emAndamento);

async function chamar(payload) {
  const res = await fetch(state.settings.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: state.settings.token, ...payload }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Resposta inválida. Confira a URL do script.');
  }
  if (!data.ok) throw new Error(data.error || 'Erro no script');
  return data;
}

export function agendar(ms = 1500) {
  if (!configurado() || !state.fila.length) return;
  clearTimeout(timer);
  timer = setTimeout(() => sincronizar().catch(() => {}), ms);
}

export function sincronizar() {
  if (!configurado()) return Promise.reject(new Error('Preencha a URL e o token.'));
  if (!navigator.onLine) return Promise.reject(new Error('Sem conexão.'));
  if (emAndamento) return emAndamento;
  avisar();
  emAndamento = (async () => {
    const ops = state.fila.slice();
    if (ops.length) {
      await chamar({ action: 'push', ops: ops.map(({ aba, op, item }) => ({ aba, op, item })) });
      confirmarEnvio(ops.map((o) => o.seq));
    }
    ultimoErro = null;
    marcarSync();
  })()
    .catch((e) => {
      ultimoErro = e.message || String(e);
      throw e;
    })
    .finally(() => {
      emAndamento = null;
      avisar();
      // alterações feitas durante o envio
      if (!ultimoErro) agendar();
    });
  return emAndamento;
}

export async function restaurar() {
  if (!configurado()) throw new Error('Preencha a URL e o token.');
  if (state.fila.length) await sincronizar();
  const dados = await chamar({ action: 'pull' });
  substituirDados(dados);
  ultimoErro = null;
  marcarSync();
}

export async function testar() {
  await chamar({ action: 'ping' });
}
