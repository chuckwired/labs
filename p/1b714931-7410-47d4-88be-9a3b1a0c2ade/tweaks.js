/* Temporary tweaks panel. Loads only with ?tweaks in the URL. Safe to delete this file,
   the loader line in index.html and fonts/sig/ once a signature font is chosen. */
(function () {
  var sig = document.querySelector('.sig');
  if (!sig) return;

  var FONTS = [
    ['Mrs Saint Delafield', 'mrs-saint-delafield'],
    ['Herr Von Muellerhoff', 'herr-von-muellerhoff'],
    ['Whisper', 'whisper'],
    ['Monsieur La Doulaise', 'monsieur-la-doulaise'],
    ['Mr De Haviland', 'mr-de-haviland'],
    ['Mrs Sheppards', 'mrs-sheppards'],
    ['Qwigley', 'qwigley'],
    ['Alex Brush', 'alex-brush'],
    ['Pinyon Script', 'pinyon-script'],
    ['Italianno', 'italianno'],
    ['Meddon', 'meddon'],
    ['Rouge Script', 'rouge-script'],
    ['Send Flowers', 'send-flowers'],
    ['Waterfall', 'waterfall'],
    ['Updock', 'updock'],
    ['Sacramento', 'sacramento'],
    ['Mea Culpa', 'mea-culpa'],
    ['Ballet', 'ballet']
  ];
  var KEY = 'sig-tweaks';
  var baseSize = parseFloat(getComputedStyle(sig).fontSize) || 64;
  var st = { f: FONTS[0][1], size: Math.round(baseSize), tilt: -2 };
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) for (var k in st) if (k in s) st[k] = s[k]; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#tw{position:fixed;right:16px;bottom:16px;z-index:100;width:min(340px,calc(100vw - 32px));max-height:min(70vh,560px);display:flex;flex-direction:column;background:var(--glass,var(--bg));color:var(--ink);border:1px solid var(--line2);border-radius:10px;backdrop-filter:blur(10px);font:400 12px/1.4 var(--sans);box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
    '#tw[hidden]{display:none}' +
    '@media(max-width:700px){#tw{left:16px;width:auto;max-height:50vh}#tw .rows{grid-template-columns:1fr 1fr 1fr}#tw .f span{font-size:26px}#tw .f{min-height:54px;padding:4px 8px 6px}}' +
    '#tw header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--line)}' +
    '#tw b{font:500 11px var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}' +
    '#tw button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}' +
    '#tw header button{color:var(--dim);padding:2px 6px}#tw header button:hover{color:var(--ink)}' +
    '#tw .rows{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px}' +
    '#tw .f{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 10px 8px;border:1px solid var(--line2);border-radius:8px;text-align:left;min-height:64px}' +
    '#tw .f:hover{border-color:var(--dim)}#tw .f[aria-pressed=true]{border-color:var(--ink);background:var(--line)}' +
    '#tw .f span{font-size:34px;line-height:1.1;white-space:nowrap}#tw .f small{font:400 10px var(--sans);color:var(--dim)}' +
    '#tw .ctl{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--line)}' +
    '#tw .ctl output{text-align:right;color:var(--dim);font-variant-numeric:tabular-nums}' +
    '#tw input[type=range]{width:100%;accent-color:var(--ink)}' +
    '#tw .foot{display:flex;justify-content:space-between;padding:8px 12px 10px;border-top:1px solid var(--line);color:var(--dim)}' +
    '#twp{position:fixed;right:16px;bottom:16px;z-index:100;padding:8px 12px;border:1px solid var(--line2);border-radius:999px;background:var(--glass,var(--bg));color:var(--ink);font:500 11px var(--sans);letter-spacing:.2em;text-transform:uppercase;cursor:pointer}' +
    '#twp[hidden]{display:none}';
  document.head.appendChild(css);

  var panel = document.createElement('div');
  panel.id = 'tw';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Signature tweaks');
  panel.innerHTML =
    '<header><b>Tweaks · signature</b><button type="button" id="twx" aria-label="Close tweaks">Hide</button></header>' +
    '<div class="rows"></div>' +
    '<label class="ctl"><span>Size</span><input id="twsz" type="range" min="36" max="140" step="1"><output id="twszo"></output></label>' +
    '<label class="ctl"><span>Tilt</span><input id="twtl" type="range" min="-10" max="6" step="0.5"><output id="twtlo"></output></label>' +
    '<div class="foot"><span id="twn"></span><button type="button" id="twr">Reset</button></div>';
  var pill = document.createElement('button');
  pill.id = 'twp'; pill.type = 'button'; pill.hidden = true; pill.textContent = 'Tweaks';
  document.body.appendChild(panel); document.body.appendChild(pill);

  var rows = panel.querySelector('.rows'), btns = {};
  FONTS.forEach(function (x) {
    var fam = 'SigT ' + x[1];
    var face = new FontFace(fam, 'url(fonts/sig/' + x[1] + '.woff2)');
    document.fonts.add(face); face.load().catch(function () {});
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'f'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span style="font-family:\'' + fam + '\',cursive">—Chuck</span><small>' + x[0] + '</small>';
    b.addEventListener('click', function () { st.f = x[1]; apply(true); });
    rows.appendChild(b); btns[x[1]] = b;
  });

  var sz = panel.querySelector('#twsz'), tl = panel.querySelector('#twtl');
  sz.addEventListener('input', function () { st.size = +sz.value; apply(); });
  tl.addEventListener('input', function () { st.tilt = +tl.value; apply(); });
  panel.querySelector('#twr').addEventListener('click', function () {
    st = { f: FONTS[0][1], size: Math.round(baseSize), tilt: -2 }; apply(true);
  });
  panel.querySelector('#twx').addEventListener('click', function () { panel.hidden = true; pill.hidden = false; });
  pill.addEventListener('click', function () { panel.hidden = false; pill.hidden = true; });

  function apply(save) {
    sig.style.fontFamily = '"SigT ' + st.f + '",cursive';
    sig.style.fontSize = st.size + 'px';
    sig.style.transform = 'rotate(' + st.tilt + 'deg)';
    for (var k in btns) btns[k].setAttribute('aria-pressed', String(k === st.f));
    sz.value = st.size; tl.value = st.tilt;
    panel.querySelector('#twszo').textContent = st.size + 'px';
    panel.querySelector('#twtlo').textContent = st.tilt + '°';
    var name = FONTS.filter(function (x) { return x[1] === st.f; })[0][0];
    panel.querySelector('#twn').textContent = name + ' · ' + st.size + 'px · ' + st.tilt + '°';
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  apply();
  window.scrollTo(0, sig.getBoundingClientRect().top + scrollY - innerHeight * (innerWidth < 700 ? 0.18 : 0.4));
})();
