const params = new URLSearchParams(location.search);
if (params.has('online') || params.has('room')) {
  document.documentElement.lang = 'ja';
  document.title = 'ふたりのあいだの海 — Between Tides';
  await import('./main.js');
} else {
  await import('./maze-main.js');
}
