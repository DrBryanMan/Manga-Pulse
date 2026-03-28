'use strict';

const COVER_COLORS = {
  onepiece: 'linear-gradient(160deg,#1a2a3a,#0d1117)',
  chainsaw: 'linear-gradient(160deg,#2a1a1a,#160a0a)',
  jujutsu: 'linear-gradient(160deg,#1a2a1a,#0a160a)',
  dandadan: 'linear-gradient(160deg,#2a2a1a,#16160a)',
  berserk: 'linear-gradient(160deg,#1a1a2a,#0a0a16)',
  vagabond: 'linear-gradient(160deg,#2a1f15,#160d08)',
  vinland: 'linear-gradient(160deg,#1f2a1a,#0d160a)',
  mha: 'linear-gradient(160deg,#2a1a1a,#1c0d0d)',
  spy: 'linear-gradient(160deg,#1a2030,#0d1520)',
  kaiju: 'linear-gradient(160deg,#201a2a,#100a1a)',
};

export const initImageFallbacks = (root = document) => {
  root.querySelectorAll('img[data-key]:not([data-fallback-bound])').forEach(img => {
    img.dataset.fallbackBound = 'true';
    img.addEventListener('error', () => {
      const placeholder = document.createElement('div');

      placeholder.className = img.className;
      placeholder.style.background = COVER_COLORS[img.dataset.key] ?? 'linear-gradient(135deg,#161d2a,#0b0f14)';
      placeholder.setAttribute('aria-label', img.alt || 'Обкладинка манґи');

      img.replaceWith(placeholder);
    });
  });
};
