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
