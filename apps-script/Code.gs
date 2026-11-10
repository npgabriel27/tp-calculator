/**
 * tp-calculator: ponte entre o app e a planilha.
 *
 * O token NÃO fica neste arquivo. Defina-o em
 * Configurações do projeto → Propriedades do script → TOKEN.
 *
 * Requisições (POST, corpo JSON enviado como text/plain):
 *   { token, action: 'ping' }
 *   { token, action: 'push', ops: [{ aba, op: 'upsert' | 'delete', item }] }
 *   { token, action: 'pull' }  →  { ok, marcas, produtos, registros }
 */

const ABAS = {
  marcas: ['id', 'nome', 'ativa'],
  produtos: ['id', 'marca', 'rolos', 'metros', 'folhas'],
  registros: ['id', 'data', 'sessao', 'marca', 'rolos', 'metros', 'folhas', 'preco', 'm_por_real', 'comprado'],
};

// Colunas gravadas como texto puro (evita que o Sheets converta datas e IDs).
const COLUNAS_TEXTO = { id: true, nome: true, marca: true, data: true, sessao: true };

function doGet() {
  return saida({ ok: true, app: 'tp-calculator' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return saida({ ok: false, error: 'JSON inválido' });
  }

  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || body.token !== token) return saida({ ok: false, error: 'Token inválido' });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    switch (body.action) {
      case 'ping':
        return saida({ ok: true });
      case 'push':
        aplicar(body.ops || []);
        return saida({ ok: true });
      case 'pull':
        return saida({ ok: true, marcas: ler('marcas'), produtos: ler('produtos'), registros: ler('registros') });
      default:
        return saida({ ok: false, error: 'Ação desconhecida' });
    }
  } catch (err) {
    return saida({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/** Rode uma vez pelo editor para criar as abas com cabeçalho. */
function criarAbas() {
  Object.keys(ABAS).forEach(folha);
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function folha(nome) {
  const cols = ABAS[nome];
  if (!cols) throw new Error('Aba desconhecida: ' + nome);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function aplicar(ops) {
  const porAba = {};
  ops.forEach(function (op) {
    if (!ABAS[op.aba]) return;
    (porAba[op.aba] = porAba[op.aba] || []).push(op);
  });

  Object.keys(porAba).forEach(function (nome) {
    const cols = ABAS[nome];
    const sh = folha(nome);
    const ultima = sh.getLastRow();
    const linhaDe = {};
    if (ultima > 1) {
      sh.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (r, i) {
        linhaDe[String(r[0])] = i + 2;
      });
    }
    let proxima = ultima + 1;
    const apagar = [];

    porAba[nome].forEach(function (op) {
      const id = String((op.item && op.item.id) || '');
      if (!id) return;

      if (op.op === 'delete') {
        if (linhaDe[id]) {
          apagar.push(linhaDe[id]);
          delete linhaDe[id];
        }
        return;
      }

      const linha = linhaDe[id] || (linhaDe[id] = proxima++);
      cols.forEach(function (c, i) {
        if (COLUNAS_TEXTO[c]) sh.getRange(linha, i + 1).setNumberFormat('@');
      });
      const valores = cols.map(function (c) {
        const v = op.item[c];
        return v === undefined || v === null ? '' : v;
      });
      sh.getRange(linha, 1, 1, cols.length).setValues([valores]);
    });

    apagar.sort(function (a, b) { return b - a; }).forEach(function (l) { sh.deleteRow(l); });
  });
}

function ler(nome) {
  const sh = folha(nome);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const larg = sh.getLastColumn();
  const cab = sh.getRange(1, 1, 1, larg).getValues()[0].map(String);
  return sh
    .getRange(2, 1, n, larg)
    .getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      const o = {};
      cab.forEach(function (h, i) {
        const v = r[i];
        o[h] = v instanceof Date ? v.toISOString() : v;
      });
      return o;
    });
}
