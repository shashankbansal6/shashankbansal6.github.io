// Picks the theme before anything paints: ?theme= wins, then the saved choice, else watercolor.
// A separate file (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  var q = new URLSearchParams(location.search).get('theme');
  var t = q;
  try { t = q || localStorage.getItem('theme'); if (q) localStorage.setItem('theme', q); } catch (e) {}
  if (t !== 'ink') document.documentElement.dataset.theme = 'watercolor';
})();
