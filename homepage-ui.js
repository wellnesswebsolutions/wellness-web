(() => {
  const progressBar = document.getElementById('bar');

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-totop]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  if (!progressBar) return;

  const updateProgress = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0
      ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
      : 0;

    progressBar.style.width = `${progress * 100}%`;
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
})();
