import { router }          from './js/router.js';
import { initShell }        from './js/shell.js';
import { renderHome }       from './js/views/home.js';
import { renderSeries }     from './js/views/series.js';
import { renderMagazines }  from './js/views/magazines.js';
import { renderCalendar }   from './js/views/calendar.js';

const main = initShell();

router
  .on('/',          () => renderHome(main))
  .on('/series',    () => renderSeries(main))
  .on('/magazines', () => renderMagazines(main))
  .on('/calendar',  () => renderCalendar(main))
  .notFound(        () => renderHome(main))
  .listen();