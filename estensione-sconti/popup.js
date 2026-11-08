// Finestra dell'estensione.
(function () {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  let tab = null, dominio = '', http = false;
  const msg = (m) => chrome.runtime.sendMessage(m);
  const euro = (n, s) => formattaImporto(n, s);
  const dataBreve = (t) => (t ? new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

  document.querySelectorAll('.scheda').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.scheda').forEach((x) => x.classList.toggle('attiva', x === b));
    ['codici', 'risparmi', 'opzioni'].forEach((s) => { $('s-' + s).hidden = s !== b.dataset.s; });
    if (b.dataset.s === 'risparmi') caricaStorico();
  }));

  let iniettato = false;
  // Lo stato del campo coupon si chiede al fondo, che interroga tutti i frame della scheda.
  async function statoTab() {
    let r = await msg({ type: 'statoTab', tabId: tab.id });
    if (r && r.n === 0 && !iniettato) { // scheda aperta prima dell'installazione: carico gli script in tutti i frame
      iniettato = true;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['domain.js', 'cercatore.js', 'tester.js'] });
        await new Promise((x) => setTimeout(x, 500));
        r = await msg({ type: 'statoTab', tabId: tab.id });
      } catch (e) {}
    }
    return r;
  }

  async function caricaCodici() {
    const s = await msg({ type: 'stato', dominio });
    const lista = $('lista');
    lista.innerHTML = '';
    for (const c of s.codici) {
      const li = document.createElement('li');
      const classe = c.esito === 'ok' ? 'ok' : c.esito === 'ko' ? 'ko' : 'mai';
      li.className = classe;
      let sub;
      if (c.esito === 'ok') sub = 'Funziona' + (c.sconto ? ': -' + euro(c.sconto, c.simbolo) : '') + ' · provato il ' + dataBreve(c.data);
      else if (c.esito === 'ko') sub = 'Non funziona (' + (c.motivo || 'nessuna reazione') + ') · provato il ' + dataBreve(c.data);
      else sub = 'Mai provato · ' + (c.source === 'manuale' ? 'aggiunto da te' : 'trovato nella pagina');
      li.innerHTML = '<span class="ico">' + (c.esito === 'ok' ? '✓' : c.esito === 'ko' ? '✗' : '○') + '</span><span class="t"><div class="cod"></div><div class="sub"></div></span><button class="del" title="Togli">×</button>';
      li.querySelector('.cod').textContent = c.code;
      li.querySelector('.sub').textContent = sub;
      li.querySelector('.del').onclick = async () => { await msg({ type: 'rimuovi', dominio, codice: c.code }); caricaCodici(); };
      lista.appendChild(li);
    }
    const n = s.codici.length;
    $('conteggio').textContent = (n === 1 ? '1 codice salvato per questo sito' : n + ' codici salvati per questo sito') +
      (s.nComuni ? ' · più ' + s.nComuni + ' codici comuni' : '');
    $('riprova').hidden = !s.codici.some((c) => c.esito === 'ko');
    $('comuni').checked = s.opzioni.usaComuni;
    $('max').value = s.opzioni.maxCodici;
    $('maxv').textContent = s.opzioni.maxCodici;
  }

  async function caricaStorico() {
    const { storico } = await msg({ type: 'leggiStorico' });
    // Un totale per ogni valuta: mai sommare euro, dollari e sterline insieme.
    const somme = sommaPerValuta(storico);
    $('totale').textContent = somme.length ? somme.map((x) => euro(x.totale, x.simbolo)).join(' + ') : euro(0, '€');
    const ul = $('storico');
    ul.innerHTML = '';
    if (!storico.length) { ul.innerHTML = '<li class="piccolo">Ancora nessun risparmio.</li>'; return; }
    for (const x of storico) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="t"><div class="cod"></div><div class="sub"></div></span><b></b>';
      li.querySelector('.cod').textContent = x.codice;
      li.querySelector('.sub').textContent = x.dominio + ' · ' + dataBreve(x.data);
      li.querySelector('b').textContent = euro(x.risparmio, x.simbolo);
      ul.appendChild(li);
    }
  }

  async function aggiorna() {
    const r = (await msg({ type: 'sessGet', tabId: tab.id })).st;
    const g = $('genera'), sp = $('spiega'), ris = $('risultato');
    const inCorso = r && !r.concluso && r.dominio === dominio && Date.now() - r.ts < 60000;
    if (inCorso) {
      g.disabled = true; g.textContent = 'Sto provando…';
      sp.textContent = 'Provo: ' + (r.corrente || '...') + ' (' + Math.min(r.idx, r.coda.length) + ' di ' + r.coda.length + ')';
      ris.hidden = true;
      return;
    }
    g.textContent = 'Genera sconto';
    if (r && r.concluso && r.dominio === dominio && Date.now() - r.ts < 600000) {
      const c = r.concluso;
      ris.hidden = false;
      ris.className = 'risultato' + (c.tipo === 'ok' ? ' ok' : '');
      ris.textContent = c.tipo === 'ok'
        ? 'Risparmi ' + (c.sconto ? euro(c.sconto, c.simbolo) : '') + ' con ' + c.code + (c.provati ? ' (' + c.provati + ' codici provati in ' + c.secondi + ' s)' : '')
        : c.testo + (c.provati ? ' (' + c.provati + ' codici provati in ' + c.secondi + ' s)' : '');
      caricaCodici();
    } else ris.hidden = true;
    if (!http) { g.disabled = true; sp.textContent = 'Cacciasconti funziona solo sulle pagine dei negozi online.'; return; }
    const st = await statoTab();
    if (st && st.campo) { g.disabled = false; sp.textContent = ''; }
    else { g.disabled = true; sp.textContent = 'Vai alla pagina del carrello o del pagamento.'; }
  }

  async function avvia(riprova) {
    $('genera').disabled = true;
    await msg({ type: 'avviaTab', tabId: tab.id, riprova: !!riprova });
    aggiorna();
  }

  async function init() {
    if (q.get('tab')) tab = await chrome.tabs.get(parseInt(q.get('tab'), 10));
    else tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    http = !!(tab && /^https?:/.test(tab.url || ''));
    if (http) {
      const host = new URL(tab.url).hostname;
      dominio = dominioDi(host);
      $('sito').textContent = dominio;
    } else $('sito').textContent = 'Nessun negozio aperto';
    await caricaCodici();
    await aggiorna();
    setInterval(aggiorna, 1000);
  }

  $('genera').onclick = () => avvia(false);
  $('riprova').onclick = () => avvia(true);
  $('aggiungi').onsubmit = async (e) => {
    e.preventDefault();
    if (!http) { $('errore').textContent = 'Apri prima la pagina di un negozio.'; return; }
    const r = await msg({ type: 'aggiungi', dominio, codice: $('nuovo').value });
    $('errore').textContent = r.errore || '';
    if (!r.errore) { $('nuovo').value = ''; caricaCodici(); }
  };
  $('comuni').onchange = async () => { await msg({ type: 'opzioni', opzioni: { usaComuni: $('comuni').checked } }); caricaCodici(); };
  $('max').oninput = () => { $('maxv').textContent = $('max').value; };
  $('max').onchange = () => msg({ type: 'opzioni', opzioni: { maxCodici: $('max').value } });
  $('esporta').onclick = async () => {
    const { dati } = await msg({ type: 'esporta' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
    a.download = 'cacciasconti-codici.json';
    a.click();
  };
  $('importa').onclick = () => $('file').click();
  $('file').onchange = async () => {
    const f = $('file').files[0];
    if (!f) return;
    try {
      const r = await msg({ type: 'importa', dati: JSON.parse(await f.text()) });
      $('errore').textContent = r.errore || 'Codici caricati.';
    } catch (e) { $('errore').textContent = 'File non valido.'; }
    caricaCodici();
  };
  init();
})();
