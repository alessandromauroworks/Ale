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
    ['codici', 'prezzi', 'risparmi', 'opzioni'].forEach((s) => { $('s-' + s).hidden = s !== b.dataset.s; });
    if (b.dataset.s === 'risparmi') { caricaStorico(); caricaRegistro(); }
    if (b.dataset.s === 'prezzi') caricaPrezzi();
  }));

  let iniettato = false;
  // Lo stato del campo coupon si chiede al fondo, che interroga tutti i frame della scheda.
  async function statoTab() {
    let r = await msg({ type: 'statoTab', tabId: tab.id });
    if (r && r.n === 0 && !iniettato) { // scheda aperta prima dell'installazione: carico gli script in tutti i frame
      iniettato = true;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['domain.js', 'estrattore.js', 'cercatore.js', 'tester.js', 'lib-extra.js', 'pagina-extra.js'] });
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
      else if (c.esito === 'riprova') sub = 'Da riprovare (' + (c.motivo || 'dipende dal carrello') + ') · ultima prova ' + dataBreve(c.data);
      else sub = 'Mai provato · ' + (c.info ? c.info + ' · ' : '') + ({ manuale: 'aggiunto da te', 'sito del negozio': 'trovato nel sito del negozio', 'fonte indicata da te': 'da una fonte che hai scelto', condivisi: 'condiviso da altri', email: 'trovato in una tua email', 'email (automatico)': 'dalle tue email (automatico)', 'sito di coupon (aperto da te)': 'da un sito di coupon aperto da te', 'pagina (classe)': 'trovato nella pagina (poco sicuro)' }[c.source] || 'trovato nella pagina');
      li.innerHTML = '<span class="ico">' + (c.esito === 'ok' ? '✓' : c.esito === 'ko' ? '✗' : c.esito === 'riprova' ? '↻' : '○') + '</span><span class="t"><div class="cod"></div><div class="sub"></div></span><button class="del" title="Togli">×</button>';
      li.querySelector('.cod').textContent = c.code;
      li.querySelector('.sub').textContent = sub;
      li.querySelector('.del').onclick = async () => { await msg({ type: 'rimuovi', dominio, codice: c.code }); caricaCodici(); };
      lista.appendChild(li);
    }
    const n = s.codici.length;
    $('conteggio').textContent = (n === 1 ? '1 codice salvato per questo sito' : n + ' codici salvati per questo sito') +
      (s.nComuni ? ' · più ' + s.nComuni + ' codici comuni' : '');
    $('riprova').hidden = !s.codici.some((c) => c.esito === 'ko' || c.esito === 'riprova');
    $('comuni').checked = s.opzioni.usaComuni;
    $('max').value = s.opzioni.maxCodici;
    $('maxv').textContent = s.opzioni.maxCodici;
    $('esplora').checked = s.opzioni.esplora !== false;
    $('condividi').checked = !!s.opzioni.condividi;
    $('ricaricaAuto').checked = !!s.opzioni.ricaricaAuto;
    $('soloIcona').checked = !!s.opzioni.soloIcona;
    $('storicoPrezzi').checked = s.opzioni.storicoPrezzi !== false;
    $('gmail').checked = s.opzioni.gmail !== false;
    $('googleBadge').checked = !!s.opzioni.googleBadge;
    $('couponAperti').checked = !!s.opzioni.couponAperti;
    const cb = s.opzioni.cashback || {};
    $('cb-attivo').checked = !!cb.attivo;
    $('cb-servizio').value = cb.servizio || 'beruby';
    $('cb-url').value = cb.url || '';
    $('cb-url').hidden = $('cb-servizio').value !== 'altro';
    $('cb-tutti').checked = cb.tutti !== false;
    $('cb-negozi').value = (cb.negozi || []).join(', ');
    $('cb-negozi').hidden = $('cb-tutti').checked;
    disegnaFonti(s.opzioni.fonti || []);
    caricaChiave();
  }
  function disegnaFonti(fonti) {
    const ul = $('fonti');
    ul.innerHTML = '';
    fonti.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><button class="del" type="button" title="Togli">×</button>';
      li.querySelector('span').textContent = f.dominio + ' ← ' + f.url;
      li.querySelector('.del').onclick = async () => { const o = (await msg({ type: 'stato', dominio })).opzioni; o.fonti.splice(i, 1); await msg({ type: 'opzioni', opzioni: { fonti: o.fonti } }); caricaCodici(); };
      ul.appendChild(li);
    });
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


  // ---------- Prezzi ----------
  let firmaPrezzi = '';
  async function caricaPrezzi() {
    const vuoto = $('p-vuoto'), box = $('p-prodotto');
    if (!http) { vuoto.textContent = 'Apri la pagina di un prodotto.'; box.hidden = true; await caricaSeguiti(); return; }
    const r = await msg({ type: 'prodottoTab', tabId: tab.id });
    const p = r && r.prodotto, rec = r && r.rec;
    const firma = JSON.stringify([p && p.chiave, rec && rec.punti, rec && rec.avvisa]);
    if (firma === firmaPrezzi) return;
    firmaPrezzi = firma;
    if (!p) { vuoto.textContent = 'In questa pagina non vedo un prodotto con un prezzo.'; box.hidden = true; await caricaSeguiti(); return; }
    vuoto.textContent = '';
    box.hidden = false;
    $('p-nome').textContent = p.nome;
    const sv = p.valuta;
    if (rec && rec.punti.length) {
      $('p-grafico').innerHTML = CS_lib.grafico(rec.punti); // SVG fatto solo di numeri
      const st = CS_lib.statistiche(rec.punti);
      $('p-stat').textContent = 'Ora ' + euro(p.prezzo, sv) + ' · minimo ' + euro(st.min, sv) + ' · massimo ' + euro(st.max, sv) + ' · ' + st.n + (st.n === 1 ? ' giorno registrato' : ' giorni registrati') +
        (st.n > 1 && p.prezzo <= st.min ? ' · è il prezzo più basso che ho visto' : '');
    } else {
      $('p-grafico').textContent = '';
      $('p-stat').textContent = 'Ora ' + euro(p.prezzo, sv) + (rec === null && !p.chiave ? '' : ' · salvo il prezzo…');
    }
    $('avvisa').checked = !!(rec && rec.avvisa);
    $('avvisa').disabled = !rec;
    const cerca = $('cerca');
    cerca.innerHTML = '';
    for (const c of CS_lib.cercaUrl(p.nome)) {
      const a = document.createElement('a');
      a.href = c.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = c.nome; a.dataset.id = c.id;
      cerca.appendChild(a);
    }
    await caricaSeguiti();
  }
  async function caricaSeguiti() {
    const { seguiti } = await msg({ type: 'prezziSeguiti' });
    const ul = $('seguiti');
    ul.innerHTML = '';
    if (!seguiti.length) { ul.innerHTML = '<li class="piccolo">Nessun prodotto seguito.</li>'; return; }
    for (const x of seguiti) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="t"><div class="cod"></div><div class="sub"></div></span><button class="del" type="button" title="Smetti di seguire">×</button>';
      li.querySelector('.cod').textContent = x.nome || x.chiave;
      li.querySelector('.sub').textContent = x.dominio + (x.ultimo != null ? ' · ' + euro(x.ultimo, x.valuta) : '');
      li.querySelector('.del').onclick = async () => { await msg({ type: 'prezziAvvisa', chiave: x.chiave, avvisa: false }); firmaPrezzi = ''; caricaPrezzi(); };
      ul.appendChild(li);
    }
  }
  $('avvisa').onchange = async () => {
    const r = (await msg({ type: 'prodottoTab', tabId: tab.id })).prodotto;
    if (!r) return;
    const e = await msg({ type: 'prezziAvvisa', chiave: r.chiave, avvisa: $('avvisa').checked });
    $('p-errore').textContent = e.errore || '';
    if (e.errore) $('avvisa').checked = false;
    firmaPrezzi = '';
    caricaPrezzi();
  };

  // ---------- Registro cashback ----------
  const IN_RITARDO = 90;
  const oggiIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  async function caricaRegistro() {
    const { voci } = await msg({ type: 'cbLista' });
    const ul = $('cb-lista');
    ul.innerHTML = '';
    voci.sort((a, b) => (a.data < b.data ? 1 : -1));
    let ritardo = 0;
    for (const v of voci) {
      const giorni = CS_lib.giorniDa(v.data);
      const tardi = v.stato === 'in attesa' && giorni > IN_RITARDO;
      if (tardi) ritardo++;
      const li = document.createElement('li');
      if (tardi) li.className = 'ritardo';
      li.innerHTML = '<span class="t"><div class="cod"></div><div class="sub"></div></span><select></select><button class="del" type="button" title="Togli">×</button>';
      li.querySelector('.cod').textContent = v.negozio + ' · ' + euro(v.importo, '€');
      li.querySelector('.sub').textContent = dataBreve(v.data + 'T12:00:00') + (tardi ? ' · in attesa da ' + giorni + ' giorni: controlla con il servizio' : '');
      const sel = li.querySelector('select');
      for (const st of ['in attesa', 'accreditato', 'mancante']) { const o = document.createElement('option'); o.textContent = st; o.selected = st === v.stato; sel.appendChild(o); }
      sel.onchange = async () => { await msg({ type: 'cbStato', id: v.id, stato: sel.value }); caricaRegistro(); };
      li.querySelector('.del').onclick = async () => { await msg({ type: 'cbRimuovi', id: v.id }); caricaRegistro(); };
      ul.appendChild(li);
    }
    if (!voci.length) ul.innerHTML = '<li class="piccolo">Nessuna voce.</li>';
    const av = $('cb-avviso');
    av.hidden = !ritardo;
    av.textContent = ritardo ? (ritardo === 1 ? '1 cashback è' : ritardo + ' cashback sono') + ' "in attesa" da più di ' + IN_RITARDO + ' giorni: chiedi al servizio.' : '';
    $('tab-risparmi').innerHTML = 'Risparmi' + (ritardo ? ' <span class="puntino" title="Cashback in attesa da più di 90 giorni">●</span>' : '');
  }
  $('cb-data').value = oggiIso();
  $('cb-form').onsubmit = async (e) => {
    e.preventDefault();
    const r = await msg({ type: 'cbAggiungi', negozio: $('cb-negozio').value, importo: $('cb-importo').value, data: $('cb-data').value, stato: $('cb-stato').value });
    $('cb-errore').textContent = r.errore || '';
    if (!r.errore) { $('cb-negozio').value = ''; $('cb-importo').value = ''; caricaRegistro(); }
  };

  // ---------- Chiave personale e cashback (Opzioni) ----------
  async function caricaChiave() {
    const r = await msg({ type: 'chiaveStato' });
    const el = $('chiave-stato');
    if (!r.presente) { el.textContent = 'Nessuna chiave salvata.'; $('chiave-agg').disabled = true; return; }
    $('chiave-agg').disabled = false;
    const st = r.stato || {};
    el.textContent = 'Chiave salvata su questo computer.' + (st.errore ? ' Ultimo tentativo: ' + st.errore + '.' : st.ts ? ' Ultimo aggiornamento: ' + dataBreve(st.ts) + ' (' + (st.n || 0) + ' codici).' : '');
  }
  $('chiave-form').onsubmit = async (e) => {
    e.preventDefault();
    const r = await msg({ type: 'chiaveImposta', chiave: $('chiave').value });
    $('chiave').value = '';
    if (r.errore) $('chiave-stato').textContent = r.errore; else { if (r.presente) await msg({ type: 'personaliAggiorna' }); caricaChiave(); }
  };
  $('chiave-agg').onclick = async () => { $('chiave-stato').textContent = 'Aggiorno…'; await msg({ type: 'personaliAggiorna' }); caricaChiave(); };
  async function salvaCashback() {
    const negozi = $('cb-negozi').value.split(/[,\s]+/).filter(Boolean);
    await msg({ type: 'opzioni', opzioni: { cashback: { attivo: $('cb-attivo').checked, servizio: $('cb-servizio').value, url: $('cb-url').value.trim(), tutti: $('cb-tutti').checked, negozi } } });
    $('cb-url').hidden = $('cb-servizio').value !== 'altro';
    $('cb-negozi').hidden = $('cb-tutti').checked;
  }
  ['cb-attivo', 'cb-servizio', 'cb-tutti'].forEach((id) => { $(id).onchange = salvaCashback; });
  ['cb-url', 'cb-negozi'].forEach((id) => { $(id).onchange = salvaCashback; });
  for (const id of ['soloIcona', 'storicoPrezzi', 'gmail', 'googleBadge', 'couponAperti']) {
    $(id).onchange = () => msg({ type: 'opzioni', opzioni: { [id]: $(id).checked } });
  }
  // Spedizione gratuita: la riga compare nella scheda Codici
  async function aggiornaSped() {
    if (!http) return;
    const r = await msg({ type: 'spedizioneTab', tabId: tab.id });
    const t = r && r.spedizione ? CS_lib.testoSpedizione(r.spedizione) : '';
    $('sped').hidden = !t;
    $('sped').textContent = t;
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
    caricaRegistro();
    aggiornaSped();
    setInterval(aggiorna, 1000);
    setInterval(() => { if (!$('s-prezzi').hidden) caricaPrezzi(); }, 1500);
    setInterval(aggiornaSped, 3000);
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
  $('esplora').onchange = () => msg({ type: 'opzioni', opzioni: { esplora: $('esplora').checked } });
  $('ricaricaAuto').onchange = () => msg({ type: 'opzioni', opzioni: { ricaricaAuto: $('ricaricaAuto').checked } });
  $('condividi').onchange = () => msg({ type: 'opzioni', opzioni: { condividi: $('condividi').checked } });
  $('fonte-form').onsubmit = async (e) => {
    e.preventDefault();
    let url = $('fonte-url').value.trim(), sito = $('fonte-sito').value.trim().toLowerCase();
    try { if (!sito) sito = dominioDi(new URL(url).hostname); } catch (x) { return; }
    const o = (await msg({ type: 'stato', dominio })).opzioni;
    await msg({ type: 'opzioni', opzioni: { fonti: (o.fonti || []).concat([{ url, dominio: sito }]) } });
    $('fonte-url').value = ''; $('fonte-sito').value = '';
    caricaCodici();
  };
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
  // Versione, novità, permessi (Firefox chiede i permessi sui siti a parte) e aggiornamento pronto
  (async function extra() {
    const v = chrome.runtime.getManifest().version;
    $('versione').textContent = v;
    try { $('novita-testo').textContent = (await (await fetch(chrome.runtime.getURL('CHANGELOG.md'))).text()).replace(/^# .*\n+/, ''); } catch (e) {}
    try {
      if (!(await chrome.permissions.contains({ origins: ['<all_urls>'] }))) $('permessi').hidden = false;
    } catch (e) {}
    $('perm-btn').onclick = async () => { try { if (await chrome.permissions.request({ origins: ['<all_urls>'] })) { $('permessi').hidden = true; aggiorna(); } } catch (e) {} };
    try { await msg({ type: 'controllaAggiornamento', soloControlla: true }); } catch (e) {} // niente permesso "alarms": il controllo si fa anche ogni volta che si apre il popup
    const ag = (await chrome.storage.local.get('aggiornamentoPronto')).aggiornamentoPronto;
    if (ag && ag !== v) { $('agg-v').textContent = ag; $('aggiorna-banner').hidden = false; }
    $('agg-btn').onclick = () => msg({ type: 'ricarica' });
  })();
  init();
})();
