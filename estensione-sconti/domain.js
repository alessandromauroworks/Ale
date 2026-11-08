// Dominio "registrabile" (euristica semplice): shop.example.it -> example.it
self.dominioDi = function (host) {
  host = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!host || host.indexOf('.') < 0 || host.indexOf(':') > -1 || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const p = host.split('.');
  if (p.length >= 3 && p[p.length - 1].length === 2 && /^(co|com|org|net|gov|edu|ac)$/.test(p[p.length - 2])) {
    return p.slice(-3).join('.');
  }
  return p.slice(-2).join('.');
};

// Valute: "EUR", "USD", "GBP", "CHF" o un simbolo diventano il simbolo da mostrare (€, $, £, CHF).
self.simboloValuta = function (s) {
  const t = String(s || '').trim().toUpperCase().replace(/\.$/, '');
  if (!t) return '€';
  if (t === '€' || t === 'EUR') return '€';
  if (t === '$' || t === 'USD' || t === 'US$') return '$';
  if (t === '£' || t === 'GBP') return '£';
  if (t === 'CHF' || t === 'FR' || t === 'SFR') return 'CHF';
  return t;
};

// Importo all'italiana con la valuta dopo la cifra: 1.250,00 € / 12,40 $ / 8,00 CHF
self.formattaImporto = function (n, simbolo) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' ' + self.simboloValuta(simbolo);
};

// Somme raggruppate per valuta: [{ simbolo: '€', totale: 12.5 }, ...] (prima l'euro, poi in ordine alfabetico).
self.sommaPerValuta = function (voci) {
  const m = {};
  for (const x of voci || []) {
    const s = self.simboloValuta(x.simbolo);
    m[s] = Math.round(((m[s] || 0) + (Number(x.risparmio) || 0)) * 100) / 100;
  }
  return Object.keys(m).sort((a, b) => (a === '€' ? -1 : b === '€' ? 1 : a.localeCompare(b))).map((s) => ({ simbolo: s, totale: m[s] }));
};
