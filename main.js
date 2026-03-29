import { router }              from './js/router.js';
import { initShell }            from './js/shell.js';
import { renderHome }           from './js/views/home.js';
import { renderSeries }         from './js/views/series.js';
import { renderSeriesDetail }   from './js/views/series-detail.js';
import { renderMagazines }      from './js/views/magazines.js';
import { renderMagazineDetail } from './js/views/magazine-detail.js';
import { renderIssue }          from './js/views/issue.js';
import { renderCalendar }       from './js/views/calendar.js';

const main = initShell();

router
  .on('/',                          () => renderHome(main))
  .on('/series',                    () => renderSeries(main))
  .on('/series/:id',                (_, p) => renderSeriesDetail(main, p))
  .on('/magazines',                 () => renderMagazines(main))
  .on('/magazines/:slug',           (_, p) => renderMagazineDetail(main, p))
  .on('/magazines/:slug/series',    (_, p) => renderMagazineDetail(main, { ...p, subpage: 'series' }))
  .on('/magazines/:slug/issues',    (_, p) => renderMagazineDetail(main, { ...p, subpage: 'issues' }))
  .on('/magazines/:slug/:issue',    (_, p) => renderIssue(main, p))
  .on('/calendar',                  () => renderCalendar(main))
  .notFound(                        () => renderHome(main))
  .listen();