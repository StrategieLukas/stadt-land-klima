import type { Browser } from 'playwright';
import { assert, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import { newContext } from '../lib/browser.js';
import type { TestFixture } from '../lib/fixture.js';
import { PNG_1X1 } from '../lib/images.js';
import type { TestRunner } from '../lib/runner.js';
import { visitDaysAway, visitHasEnded } from '../../../../src/frontend/shared/tour.js';
import { formatEventDateTimeRange, getEventPhase } from '../../../../src/frontend/shared/eventDateTime.js';

type RecordId = { id: string | number; slug?: string };

async function pageHtml(url: string): Promise<string> {
  const response = await fetch(url);
  assert(response.ok, `${url} should return 200, received ${response.status}`);
  return response.text();
}

export async function runTourSeriesFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const { admin, config } = fixture;
  const slug = `automated-tour-${config.runId}`;
  const ids: { series?: RecordId; emptySeries?: RecordId; events: RecordId[]; articles: RecordId[]; links: RecordId[]; report?: RecordId; photos: RecordId[]; file?: RecordId } = {
    events: [], articles: [], links: [], photos: [],
  };
  const now = Date.now();
  const start = (days: number) => new Date(now + days * 86_400_000).toISOString();
  const title = `Automated tour ${config.runId}`;
  const emptySlug = `${slug}-without-public-stops`;
  const emptyTitle = `Automated upcoming tour ${config.runId}`;
  const projectTitle = `Automated tour project ${config.runId}`;
  const controlTitle = `Automated other project ${config.runId}`;
  const reportTitle = `Automated visit report ${config.runId}`;

  try {
    await runner.step('Tour series: Berlin-day visit banner transitions', async () => {
      const today = new Date('2026-10-04T10:00:00Z');
      assert(visitDaysAway('2026-10-05T08:00:00Z', today) === 1, 'Tomorrow should be one Berlin calendar day away');
      assert(visitDaysAway('2026-10-04T08:00:00Z', today) === 0, 'Earlier today should still count as today');
      assert(!visitHasEnded('2026-10-04T08:00:00Z', null, today), 'A visit without an end time should remain current through its Berlin day');
      assert(visitHasEnded('2026-10-03T08:00:00Z', null, today), 'A visit from the previous Berlin day should be past');
      assert(visitHasEnded('2026-10-04T08:00:00Z', '2026-10-04T09:00:00Z', today), 'An explicit end time should determine when a visit is past');
      const dateOnlyStart = '2026-10-04T00:00:00+02:00';
      assert(getEventPhase(dateOnlyStart, null, true, today) === 'current', 'Date-only events should remain current throughout their Berlin day');
      assert(getEventPhase(dateOnlyStart, null, true, new Date('2026-10-03T21:59:59Z')) === 'future', 'Date-only events should be future before their Berlin day');
      assert(getEventPhase(dateOnlyStart, null, true, new Date('2026-10-04T22:00:00Z')) === 'past', 'Date-only events should become past after their Berlin day');
      assert(!formatEventDateTimeRange(dateOnlyStart, null, 'de-DE', true).includes(':'), 'Date-only display should never invent an hour');
      assert(formatEventDateTimeRange(dateOnlyStart, null, 'de-DE').includes('00:00'), 'Timed events should keep their clock time');
    });
    await runner.step('Tour series: published itinerary and linked project preview', async () => {
      ids.file = await admin.uploadFile<RecordId>(`${slug}.png`, 'image/png', PNG_1X1, title);
      ids.series = await admin.createItem<RecordId>('event_series', {
        slug, title, introduction: 'A journey across local climate projects.', format: 'tour', status: 'published', featured_on_projects: true,
      });
      ids.emptySeries = await admin.createItem<RecordId>('event_series', {
        slug: emptySlug, title: emptyTitle,
        format: 'tour', status: 'published', featured_on_projects: true,
      });
      const past = await admin.createItem<RecordId>('events', {
        slug: `${slug}-first`, title: `First stop ${config.runId}`, status: 'published', event_type: 'other',
        event_category: 'own_public', start_date: start(-2), end_date: start(-2), location: 'Berlin', state: 'Berlin',
        geolocation: { type: 'Point', coordinates: [13.405, 52.52] }, series: ids.series.id, series_order: 1,
      });
      const future = await admin.createItem<RecordId>('events', {
        slug: `${slug}-second`, title: `Second stop ${config.runId}`, status: 'published', event_type: 'tour_stop', date_only: true,
        event_category: 'internal', start_date: start(2), location: 'Potsdam', state: 'Brandenburg',
        geolocation: { type: 'Point', coordinates: [13.064, 52.399] }, series: ids.series.id, series_order: 2,
      });
      ids.events.push(past, future);
      for (const [offset, place] of ['Zwickau', 'Osterburg', 'Eichwalde', 'Mittweida', 'Jena', 'Barleben', 'Dessau', 'Erfurt'].entries()) {
        ids.events.push(await admin.createItem<RecordId>('events', {
          slug: `${slug}-stop-${offset + 3}`, title: `${place} stop ${config.runId}`, status: 'published',
          event_type: 'tour_stop', date_only: true, start_date: start(offset + 3),
          location: place, state: 'Sachsen', series: ids.series.id, series_order: offset + 3,
          geolocation: { type: 'Point', coordinates: [12.5 + offset * .1, 50.7 + offset * .1] },
        }));
      }
      const projectBase = {
        author: 'Automated editor', municipality_name: 'Berlin', state: 'Berlin', image: ids.file.id,
        image_credits: 'Automated fixture', sectors: ['Strom'], article_text: 'A factual preview for the automated tour.',
      };
      const project = await admin.createItem<RecordId>('articles', {
        ...projectBase, title: projectTitle, slug: `${slug}-project`, abstract: 'A project preview.', profile_stage: 'preview', status: 'published',
      });
      const control = await admin.createItem<RecordId>('articles', {
        ...projectBase, title: controlTitle, slug: `${slug}-control`, profile_stage: 'complete', status: 'published',
      });
      ids.articles.push(project, control);
      ids.links.push(await admin.createItem<RecordId>('events_articles', { events_id: past.id, articles_id: project.id }));
      ids.links.push(await admin.createItem<RecordId>('events_articles', { events_id: future.id, articles_id: project.id }));
      ids.report = await admin.createItem<RecordId>('news_items', {
        slug: `${slug}-report`, title: reportTitle, teaser: 'The visit found practical lessons.', report_event: past.id, status: 'draft',
      });
      ids.photos.push(await admin.createItem<RecordId>('news_journey_photos', {
        news_items_id: ids.report.id, file: ids.file.id, sort: 1, alt: 'Automated tour scene', caption: 'A stop on the journey', credit: 'Automated fixture',
      }));
      ids.photos.push(await admin.createItem<RecordId>('news_journey_photos', {
        news_items_id: ids.report.id, file: ids.file.id, sort: 2, alt: 'Another automated tour scene', caption: 'A second view', credit: 'Second fixture credit',
      }));

      const journey = await pageHtml(`${config.frontendUrl}/events/series/${slug}`);
      assertIncludes(journey, title, 'Tour page should render the series');
      assertIncludes(journey, 'Berlin', 'Tour page should render the first stop');
      assertIncludes(journey, 'Potsdam', 'Tour page should render the second stop');
      assertIncludes(journey, 'Nächster Halt', 'Tour itinerary should identify the next stop');
      assert(journey.indexOf(`id="stop-${past.slug}"`) < journey.indexOf(`id="stop-${future.slug}"`), 'The stop boxes should follow the explicit series order');
      assertIncludes(journey, '10</strong>', 'Tour facts should show all ten stops');
      assertIncludes(journey, projectTitle, 'Tour page should show the linked project');
      assertNotIncludes(journey, reportTitle, 'Draft report must not appear on the tour page');
      assertNotIncludes(journey, 'A stop on the journey', 'Draft report photos must not appear on the tour page');

      const allDayIcs = await (await fetch(`${config.frontendUrl}/api/events/${future.slug}.ics`)).text();
      assertIncludes(allDayIcs, 'DTSTART;VALUE=DATE:', 'Date-only calendar entries should use an all-day start');
      assertIncludes(allDayIcs, 'DTEND;VALUE=DATE:', 'Date-only calendar entries should have an exclusive next-day end');
      const timedIcs = await (await fetch(`${config.frontendUrl}/api/events/${past.slug}.ics`)).text();
      assertIncludes(timedIcs, 'DTSTART:', 'Timed calendar entries should retain their UTC timestamp');

      const filterContext = await newContext(browser);
      try {
        const filterPage = await filterContext.newPage();
        await filterPage.goto(`${config.frontendUrl}/projects?tour=${slug}`, { waitUntil: 'domcontentloaded' });
        const filteredText = await filterPage.locator('body').innerText();
        assertIncludes(filteredText, projectTitle, 'Tour filter should include a project linked from two stops');
        assertNotIncludes(filteredText, controlTitle, 'Tour filter should exclude an unlinked project');
        await filterPage.goto(`${config.frontendUrl}/projects?tour=${emptySlug}`, { waitUntil: 'domcontentloaded' });
        assert(await filterPage.locator('.slk-filter-panel .slk-filter-pill:visible').filter({ hasText: emptyTitle }).count() === 1, 'A published tour should remain selectable before any public stop or project is available');
        assertIncludes(await filterPage.locator('body').innerText(), 'Für diese Tour sind noch keine Erfolgsprojekte veröffentlicht.', 'Empty tour filter should explain the absence of published projects');
        assert(await filterPage.locator(`a.canonical-button[href="/events/series/${slug}"]`).count() === 1, 'Tour hero link should use the canonical button');
        const phonePage = await filterContext.newPage();
        await phonePage.setViewportSize({ width: 390, height: 844 });
        await phonePage.goto(`${config.frontendUrl}/projects`, { waitUntil: 'networkidle' });
        const phoneTourFilter = phonePage.getByRole('button', { name: 'Alle Touren' });
        assert(await phoneTourFilter.isVisible(), 'Tour filter should be visible on phones while the other filters are collapsed');
        await phoneTourFilter.click();
        const phoneTourOptions = await phonePage.locator('.slk-filter-menu:visible button').allInnerTexts();
        assert(phoneTourOptions.includes(emptyTitle), `Phone tour menu should include the published tour; visible options: ${JSON.stringify(phoneTourOptions)}`);
        await phonePage.getByRole('button', { name: emptyTitle }).click();
        await phonePage.waitForURL(`**/projects?tour=${emptySlug}`);
      } finally {
        await filterContext.close();
      }
      const projectPage = await pageHtml(`${config.frontendUrl}/projects/${project.slug}`);
      assertIncludes(projectPage, 'Vorschau', 'Preview project should be labelled');
      assertIncludes(projectPage, title, 'Preview project should link back to the tour');
    });

    await runner.step('Tour series: published report, journey photo, and bidirectional links', async () => {
      assert(ids.report && ids.series, 'Tour fixtures must exist');
      await admin.updateItem('news_items', ids.report.id, { status: 'published' });
      const journey = await pageHtml(`${config.frontendUrl}/events/series/${slug}`);
      assertIncludes(journey, 'The visit found practical lessons.', 'Published report teaser should appear in its chapter');
      assertIncludes(journey, 'A stop on the journey', 'Selected journey photo caption should appear');
      assertIncludes(journey, 'Automated fixture', 'Selected photo credit should appear');
      assertIncludes(journey, 'A second view', 'Second selected journey photo should appear');
      assertIncludes(journey, 'Second fixture credit', 'Second photo credit should appear');
      const reportPage = await pageHtml(`${config.frontendUrl}/news/${ids.report.slug}`);
      assertIncludes(reportPage, title, 'Report should link to its tour');
      assertIncludes(reportPage, projectTitle, 'Report should link to the project');
      const eventPage = await pageHtml(`${config.frontendUrl}/events/${ids.events[0].slug}`);
      assertIncludes(eventPage, projectTitle, 'Event should link to its project');
      assertIncludes(eventPage, reportTitle, 'Event should link to its report');
      await admin.updateItem('articles', ids.articles[0].id, { profile_stage: 'complete' });
      const completedProject = await pageHtml(`${config.frontendUrl}/projects/${ids.articles[0].slug}`);
      assertIncludes(completedProject, title, 'Completed project should retain its tour connection');
      assertIncludes(completedProject, `/news/${ids.report.slug}`, 'Completed project should retain the published report link');

      const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/events/series/${slug}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.tour-collage').first().waitFor();
        await page.waitForLoadState('networkidle').catch(() => undefined);
        assert(await page.locator('.tour-collage').count() === 10, 'The geographic journal should retain all ten linked stories');
        assert(await page.locator('.series-hero__route-label').count() === 10, 'Hero illustration should include every published tour stop');
        assert((await page.locator('.series-hero__route-label').last().innerText()).includes('Erfurt'), 'Hero illustration should retain the final stop');
        assert(await page.locator('.tour-explorer__waypoint').count() === 10, 'Every published stop should have a scroll waypoint');
        assert(await page.locator('.leaflet-overlay-pane path[stroke-dasharray="4 9"]').count() === 1, 'Map should render the dotted spline route');
        assert(await page.locator('.tour-map-pin').count() === 10, 'Every mapped stop should have a numbered map pin');
        await page.locator('.tour-explorer__nav a').first().click();
        assert(await page.locator('.tour-explorer__prints:visible figure').count() === 2, 'Published journey photos should appear as two postcards over the map');
        assert((await page.locator('.tour-explorer__prints:visible').innerText()).includes('Second fixture credit'), 'Map postcards should retain photo credits');
        await page.locator('.tour-explorer__waypoint').nth(4).scrollIntoViewIfNeeded();
        await page.waitForURL(`**#stop-${ids.events[4].slug}`);
        assert(await page.locator('.tour-collage:visible h3').innerText() === 'Eichwalde', 'Scrolling should activate the corresponding postcard on the map');
        await page.waitForFunction(() => {
          const nav = document.querySelector('.tour-explorer__nav');
          const active = nav?.querySelector('.is-active');
          if (!nav || !active) return false;
          const navBounds = nav.getBoundingClientRect();
          const activeBounds = active.getBoundingClientRect();
          return activeBounds.left >= navBounds.left && activeBounds.right <= navBounds.right;
        });
        assert(await page.locator('.tour-explorer__current').count() === 0, 'Map should not repeat the active stop in a corner badge');
        assert(await page.locator('.tour-explorer__toolbar small').evaluate((hint) => hint.getBoundingClientRect().height > 20), 'Scroll hint should wrap onto two lines');
        await page.getByRole('button', { name: 'Nächste Station' }).click();
        await page.waitForURL(`**#stop-${ids.events[5].slug}`);
        await page.getByRole('button', { name: 'Vorherige Station' }).click();
        await page.waitForURL(`**#stop-${ids.events[4].slug}`);
        await page.getByRole('button', { name: 'Listenansicht' }).click();
        assert(await page.locator('.tour-explorer__map').isHidden(), 'Desktop list view should hide the map');
        assert(await page.locator('.tour-collage:visible').count() === 10, 'Desktop list view should show every stop');
        await page.getByRole('button', { name: 'Kartenansicht' }).click();
        assert(await page.locator('.tour-explorer__map').isVisible(), 'Desktop map view should restore the map');
        assert(await page.locator('.tour-collage__eyebrow, .tour-collage__pin span').count() === 0, 'Stop boxes should not duplicate the station label or number inside the pin');
        assert(await page.evaluate(() => {
          const globalHeader = document.querySelector('.slk-header-surface')!.getBoundingClientRect();
          const tourHeader = document.querySelector('.tour-explorer__header')!.getBoundingClientRect();
          const scene = document.querySelector('.tour-explorer__scene')!.getBoundingClientRect();
          return tourHeader.top >= globalHeader.bottom - 3 && scene.top >= tourHeader.bottom - 3;
        }), 'Tour controls and map should stack below the global header');
        // The fixture's nearby Berlin and Potsdam pins overlap at overview zoom.
        await page.locator('.tour-map-pin').nth(1).dispatchEvent('click');
        await page.waitForURL(`**#stop-${ids.events[1].slug}`);
        assert(await page.locator('.tour-explorer__nav a').nth(1).getAttribute('aria-current') === 'location', 'Map pin should select its story and route position');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.tour-explorer.is-mobile').waitFor();
        assert(await page.locator('.tour-explorer__waypoint').count() === 0, 'Mobile should not use scroll-driven waypoints');
        assert(await page.locator('.tour-collage:visible').count() === 10, 'Mobile should show every stop as a regular box');
        assert(await page.locator('.tour-explorer__prints').count() === 0, 'Mobile photos should stay with their stop box');
        assert(await page.locator(`#stop-${ids.events[0].slug} .tour-photos figure`).count() === 2, 'Mobile report photos should appear in the stop box');
        await page.getByRole('button', { name: 'Ganze Route zeigen' }).click();
        await page.getByRole('button', { name: 'Karte ausblenden' }).click();
        await page.locator('.tour-explorer__map').waitFor({ state: 'hidden', timeout: 5_000 });
        assert(await page.locator('.tour-explorer__map').isHidden(), 'Mobile map should collapse');
        await page.locator('.tour-explorer__nav a').nth(1).click();
        await page.waitForURL(`**#stop-${ids.events[1].slug}`);
        assert(await page.locator('.tour-explorer__nav a').nth(1).getAttribute('aria-current') === 'location', 'Selected stop should become active');
        await page.goto(`${config.frontendUrl}/events/series/${slug}#stop-${ids.events[0].slug}`, { waitUntil: 'domcontentloaded' });
        assert(await page.locator(`#stop-${ids.events[0].slug}`).count() === 1, 'Direct stop fragment should resolve to a chapter');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert(await page.locator('.tour-photos figure').first().evaluate((figure) => getComputedStyle(figure).transform === 'none'), 'Reduced motion should remove the photo tilt');
        for (const width of [390, 768, 960, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px layout should not overflow horizontally`);
          assert(await page.locator('.tour-explorer__map').evaluate((map) => map.getBoundingClientRect().width >= document.body.clientWidth - 1), `${width}px tour map should use the full content viewport width`);
          assert(await page.locator('.series-hero h1').evaluate((title) => title.getBoundingClientRect().right <= title.closest('.series-hero__copy')!.getBoundingClientRect().right + 1), `${width}px tour heading should not overlap the artwork`);
        }
      } finally {
        await context.close();
      }
    });
  } finally {
    const ignore = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { process.stderr.write(`Tour fixture cleanup: ${String(error)}\n`); } };
    for (const photo of ids.photos.reverse()) await ignore(() => admin.deleteItem('news_journey_photos', photo.id));
    if (ids.report) await ignore(() => admin.deleteItem('news_items', ids.report!.id));
    for (const link of ids.links.reverse()) await ignore(() => admin.deleteItem('events_articles', link.id));
    for (const event of ids.events.reverse()) await ignore(() => admin.deleteItem('events', event.id));
    for (const article of ids.articles.reverse()) await ignore(() => admin.deleteItem('articles', article.id));
    if (ids.series) await ignore(() => admin.deleteItem('event_series', ids.series!.id));
    if (ids.emptySeries) await ignore(() => admin.deleteItem('event_series', ids.emptySeries!.id));
    if (ids.file) await ignore(() => admin.request('DELETE', `/files/${ids.file!.id}`));
  }
}
