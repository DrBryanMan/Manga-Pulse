export const createMangaCard = series => {
  const element = document.createElement('div');

  element.className = 'manga-card';
  element.dataset.seriesId = series.id;
  element.innerHTML = `
  `;

  return element;
};
