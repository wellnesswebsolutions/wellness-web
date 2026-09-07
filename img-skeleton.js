// Skeleton shimmer for lazy-loaded images: every img[loading="lazy"] gets a
// shimmering placeholder (via CSS) until it actually finishes loading, then
// fades into the real picture. Shared by every page.
document.addEventListener('DOMContentLoaded', () => {
  const imgs = document.querySelectorAll('img[loading="lazy"]');

  imgs.forEach((img) => {
    const markLoaded = () => img.classList.add('img-loaded');
    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
    } else {
      img.addEventListener('load', markLoaded, { once: true });
      img.addEventListener('error', markLoaded, { once: true });
    }
  });
});
