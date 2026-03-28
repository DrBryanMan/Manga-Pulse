export function renderHome(container) {
  container.innerHTML = `
    <div class="container page-body">
      <section class="home-hero">
        <div class="home-hero-eyebrow">Каталог манги</div>
        <h1 class="home-hero-title">Ніколи не пропусти<br>новий розділ</h1>
        <p class="home-hero-sub">
          MangaCal — розклад виходів манги по журналах,
          рейтинги серій та персональні закладки.
        </p>
        <div class="home-hero-actions">
          <a class="btn-primary" href="#/series">Переглянути серії</a>
          <a class="btn-ghost"   href="#/calendar">Відкрити календар</a>
        </div>
      </section>
    </div>
  `;
}