import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Browser } from 'playwright';
import { assert, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import { newContext } from '../lib/browser.js';
import { DirectusClient } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';
import { visitDaysAway, visitHasEnded } from '../../../../src/frontend/shared/tour.js';
import { formatEventDateTimeRange, getEventPhase } from '../../../../src/frontend/shared/eventDateTime.js';

type RecordId = { id: string | number; slug?: string };

async function pageHtml(url: string): Promise<string> {
  const response = await fetch(url);
  assert(response.ok, `${url} should return 200, received ${response.status}`);
  return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

export async function runTourSeriesFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const { admin, config } = fixture;
  const slug = `automated-tour-${config.runId}`;
  const ids: { series?: RecordId; emptySeries?: RecordId; events: RecordId[]; articles: RecordId[]; links: RecordId[]; report?: RecordId; photos: RecordId[]; eventReport?: RecordId; blocks: RecordId[]; tourBlocks: RecordId[]; media: RecordId[]; video?: RecordId; file?: RecordId; landscape?: RecordId } = {
    events: [], articles: [], links: [], photos: [], blocks: [], tourBlocks: [], media: [],
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
      ids.file = await admin.uploadFile<RecordId>(`${slug}.png`, 'image/png', await readFile(new URL('../fixtures/tour-portrait.png', import.meta.url)), title);
      ids.landscape = await admin.uploadFile<RecordId>(`${slug}-landscape.png`, 'image/png', await readFile(new URL('../fixtures/tour-landscape.png', import.meta.url)), title);
      ids.series = await admin.createItem<RecordId>('success_project_tours', {
        slug, title, introduction: '<p>A journey across <strong>local climate projects</strong>.</p><p><a href="/projects">Explore the projects</a></p>',
        closing_reflection: '<h2>Lessons from the tour</h2><p>What we learned <em>together</em>.</p><ul><li>Practical climate action</li><li>Shared experience</li></ul>',
        status: 'published', featured_on_projects: true, cover_image: ids.file.id, cover_image_credits: 'Tour teaser fixture credit',
      });
      ids.emptySeries = await admin.createItem<RecordId>('success_project_tours', {
        slug: emptySlug, title: emptyTitle,
        status: 'published', featured_on_projects: true,
      });
      const seriesAlias = await fetch(`${config.frontendUrl}/events/series/${slug}/?view=map`, { redirect: 'manual' });
      assert(seriesAlias.status === 301 && seriesAlias.headers.get('location') === `/projects/tours/${slug}?view=map`, 'Matching published tour slugs should permanently redirect legacy series URLs and preserve query strings');
      ids.tourBlocks.push(await admin.createItem<RecordId>('blocks', {
        uuid: randomUUID(), entity_type: 'success_project_tours', entity_uuid: ids.series.id, tour: ids.series.id,
        field_name: 'content', bundle: 'container', status: 'draft', sort_order: 0,
        props: { blocks: [{ uuid: randomUUID(), bundle: 'heading', props: { text: 'Draft tour overview block' }, options: {} }] }, options: {},
      }));
      const past = await admin.createItem<RecordId>('success_project_tour_stops', {
        slug: `${slug}-first`, title: `First stop ${config.runId}`, status: 'published', start_date: start(-2), end_date: start(-2), location: 'Berlin', state: 'Berlin',
        geolocation: { type: 'Point', coordinates: [13.405, 52.52] }, tour: ids.series.id, sort: 1, visit_details: '<p>Obsolete visit information fixture.</p>',
      });
      const future = await admin.createItem<RecordId>('success_project_tour_stops', {
        slug: `${slug}-second`, title: `Second stop ${config.runId}`, status: 'published', date_only: true, start_date: start(2), location: 'Potsdam', state: 'Brandenburg',
        geolocation: { type: 'Point', coordinates: [13.064, 52.399] }, tour: ids.series.id, sort: 2,
      });
      ids.events.push(past, future);
      for (const [offset, place] of ['Zwickau', 'Osterburg', 'Eichwalde', 'Mittweida', 'Jena', 'Barleben', 'Dessau', 'Erfurt'].entries()) {
        ids.events.push(await admin.createItem<RecordId>('success_project_tour_stops', {
          slug: `${slug}-stop-${offset + 3}`, title: `${place} stop ${config.runId}`, status: 'published',
          date_only: true, start_date: start(offset + 3),
          location: place, state: 'Sachsen', tour: ids.series.id, sort: offset + 3,
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
      await admin.updateItem('articles', project.id, { date_created: null });
      assert((await admin.readItem<{date_created:string|null}>('articles', project.id)).date_created === null, 'The project fixture should reproduce a missing creation date');
      const projectIndex = await pageHtml(`${config.frontendUrl}/projects`);
      assertIncludes(projectIndex, projectTitle, 'Published projects without a date should render without an SSR error');
      assertNotIncludes(projectIndex, 'Automated editor, </p>', 'A missing date should not leave a dangling author separator');
      ids.links.push(await admin.createItem<RecordId>('success_project_tour_stops_articles', { stop: past.id, articles_id: project.id }));
      ids.links.push(await admin.createItem<RecordId>('success_project_tour_stops_articles', { stop: future.id, articles_id: project.id }));
      ids.report = await admin.createItem<RecordId>('news_items', {
        slug:`${slug}-report`,title:reportTitle,status:'draft',tour_stop:past.id,is_tour_redirect:true,
      });
      await admin.updateItem('success_project_tour_stops',past.id,{report_status:'draft',report_title:reportTitle,teaser:'The visit found practical lessons.',image:ids.file.id,image_credits:'Report cover fixture'});
      ids.media.push(await admin.createItem<RecordId>('success_project_tour_media',{stop:past.id,file:ids.file.id,sort:1,alt:'Automated tour scene',caption:'A stop on the journey',credit:'Automated fixture'}));
      ids.media.push(await admin.createItem<RecordId>('success_project_tour_media',{stop:past.id,file:ids.landscape.id,sort:2,alt:'Another automated tour scene',caption:'A second view',credit:'Second fixture credit'}));
      const nestedUuid=randomUUID();
      ids.blocks.push(await admin.createItem<RecordId>('blocks',{uuid:randomUUID(),entity_type:'success_project_tour_stops',entity_uuid:past.id,tour_stop:past.id,field_name:'content',bundle:'container',status:'published',sort_order:0,props:{blocks:[{uuid:nestedUuid,bundle:'heading',props:{text:'Preserved nested tour report'},options:{}},{uuid:randomUUID(),bundle:'image',props:{imageId:ids.landscape.id,alt:'Owned inline report image',caption:'Preserved inline image'},options:{}}]},options:{}}));
      ids.eventReport=past;
      const scope={entity_type:'success_project_tour_stops',entity_uuid:past.id,field_name:'content'};
      const editing=await admin.request<{blocks:unknown[];revision:string}>('GET','/blokkli-persistence/state',{query:scope});
      await admin.request('POST','/blokkli-persistence/publish',{body:{...scope,blocks:editing.blocks,baseRevision:editing.revision}});
      const block=await admin.readItem<{tour_stop:string;props:{blocks:{uuid:string}[]}}>('blocks',ids.blocks[0].id);
      assert(block.tour_stop===past.id&&block.props.blocks[0].uuid===nestedUuid,'Publishing should preserve stop ownership and nested block UUIDs');
      const journey = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}`);
      assertIncludes(journey, title, 'Tour page should render the series');
      assertIncludes(journey, 'Berlin', 'Tour page should render the first stop');
      assertIncludes(journey, 'Potsdam', 'Tour page should render the second stop');
      assertIncludes(journey, 'Nächster Halt', 'Tour itinerary should identify the next stop');
      assert(journey.indexOf(`id="stop-${past.slug}"`) < journey.indexOf(`id="stop-${future.slug}"`), 'The stop boxes should follow the explicit series order');
      assertIncludes(journey, '10</strong>', 'Tour facts should show all ten stops');
      assertIncludes(journey, projectTitle, 'Tour page should show the linked project');
      assertIncludes(journey, 'Zum Erfolgsprojekt-Eintrag …', 'Published related projects should receive a canonical action beside the report');
      assertNotIncludes(journey, 'Draft tour overview block', 'Draft tour overview blocks must remain private');
      await admin.updateItem('articles', project.id, { status: 'draft' });
      const unpublishedProjectTour = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}`);
      assertNotIncludes(unpublishedProjectTour, `/projects/${project.slug}`, 'Draft related projects must not appear on the tour');
      assertNotIncludes(await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${past.slug}`), `/projects/${project.slug}`, 'Draft related projects must not appear on the stop page');
      await admin.updateItem('articles', project.id, { status: 'published' });
      assertIncludes(await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${past.slug}`), 'Zum Erfolgsprojekt-Eintrag …', 'Publishing a related project should add its action to the stop page');
      assertNotIncludes(journey, reportTitle, 'Draft report must not appear on the tour page');
      assertNotIncludes(journey, 'Besuchsbericht lesen', 'Draft reports must not show report actions in server-rendered tour cards');
      assertNotIncludes(await pageHtml(`${config.frontendUrl}/projects/${project.slug}`), 'Besuchsbericht lesen', 'Project banners must not advertise draft visit reports');
      assertNotIncludes(journey, 'A stop on the journey', 'Draft report photos must not appear on the tour page');
      assertNotIncludes(await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${past.slug}`), 'Preserved nested tour report', 'Published blocks of a draft report must remain private');
      assertNotIncludes(await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${past.slug}`), 'Obsolete visit information fixture.', 'Unreported stops should not render redundant visit details');
      assert((await fetch(`${config.frontendUrl}/api/tour-media/${ids.file.id}`)).status === 404, 'Draft report media must remain private');

      const privateCalendar = await fetch(`${config.frontendUrl}/api/events/${future.slug}.ics`);
      assert(privateCalendar.status === 404, 'Internal visits must not offer calendar downloads');
      const privatePage = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${future.slug}`);
      assertNotIncludes(privatePage, 'Nicht öffentlicher Projektbesuch', 'Tour detail pages should omit the private-visit label');
      assertNotIncludes(privatePage, 'https://example.org/private-registration', 'Private visits must hide registration');
      const listings = await pageHtml(`${config.frontendUrl}/events`);
      assertNotIncludes(listings, future.slug!, 'Tour stops must stay out of the events feed');
      assertNotIncludes(listings, 'Nicht öffentlicher Projektbesuch', 'The event feed should omit the private-visit label');
      assertNotIncludes(listings, `href="/api/events/${future.slug}.ics"`, 'Internal tour cards must still hide calendar downloads');
      const ordinarySeries=await admin.createItem<RecordId>('event_series',{slug:`${slug}-ordinary-series`,title:`Ordinary series ${config.runId}`,status:'published',format:'standard'});
      const ordinary=await admin.createItem<RecordId>('events',{slug:`${slug}-ordinary-event`,title:`Ordinary event ${config.runId}`,status:'published',event_category:'own_public',event_type:'other',date_only:true,start_date:start(2),series:ordinarySeries.id});
      try {
        const calendar=await(await fetch(`${config.frontendUrl}/api/events/${ordinary.slug}.ics`)).text();
        assertIncludes(calendar,'DTSTART;VALUE=DATE:','Ordinary date-only events retain all-day calendars');
        assertIncludes(await pageHtml(`${config.frontendUrl}/events`),ordinary.slug!,'Ordinary events remain in the events feed');
        const ordinaryResponse=await fetch(`${config.frontendUrl}/events/series/${ordinarySeries.slug}`,{redirect:'manual'});
        assert(ordinaryResponse.status===200 && !ordinaryResponse.headers.has('location'),'Ordinary event series without a matching tour slug must retain their existing page');
      } finally {await admin.deleteItem('events',ordinary.id);await admin.deleteItem('event_series',ordinarySeries.id);}

      const filterContext = await newContext(browser);
      try {
        const filterPage = await filterContext.newPage();
        await filterPage.goto(`${config.frontendUrl}/projects?tour=${slug}`, { waitUntil: 'domcontentloaded' });
        const filteredText = await filterPage.locator('body').innerText();
        assertIncludes(filteredText, projectTitle, 'Tour filter should include a project linked from two stops');
        assertNotIncludes(filteredText, controlTitle, 'Tour filter should exclude an unlinked project');
        await filterPage.goto(`${config.frontendUrl}/projects?tour=${emptySlug}`, { waitUntil: 'domcontentloaded' });
        await filterPage.locator('.slk-filter-panel .slk-filter-pill:visible').filter({ hasText: emptyTitle }).waitFor();
        assert(await filterPage.locator('.slk-filter-panel .slk-filter-pill:visible').filter({ hasText: emptyTitle }).count() === 1, 'A published tour should remain selectable before any public stop or project is available');
        assertIncludes(await filterPage.locator('body').innerText(), 'Für diese Tour sind noch keine Erfolgsprojekte veröffentlicht.', 'Empty tour filter should explain the absence of published projects');
        const heroLinkCount = await filterPage.locator(`header a.canonical-button[href="/projects/tours/${slug}"]`).count();
        assert(heroLinkCount === 1, `Tour hero link should use the canonical button; found ${heroLinkCount}`);
        assert(await filterPage.locator(`header a[href="/projects/tours/${emptySlug}"]`).count() === 1, 'A featured published tour should be promoted even before stops are published');
        await admin.updateItem('success_project_tours', ids.series.id, { featured_on_projects: false });
        await filterPage.reload({ waitUntil: 'networkidle' });
        assert(await filterPage.locator(`header a[href="/projects/tours/${slug}"]`).count() === 0, 'An unfeatured tour should not have a header promotion');
        await filterPage.goto(`${config.frontendUrl}/projects?tour=${slug}`, { waitUntil: 'networkidle' });
        assertIncludes(await filterPage.locator('body').innerText(), projectTitle, 'Unfeatured tours should retain project filtering');
        assert(await filterPage.locator('.slk-filter-panel .slk-filter-pill:visible').filter({ hasText: title }).count() === 1, 'An unfeatured published tour should remain selectable');
        await admin.updateItem('success_project_tours', ids.series.id, { featured_on_projects: true });
        await filterPage.reload({ waitUntil: 'networkidle' });
        assert(await filterPage.locator(`header a[href="/projects/tours/${slug}"]`).count() === 1, 'Re-enabling promotion should restore the header link');
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
        await filterPage.goto(`${config.frontendUrl}/projects/${project.slug}`, { waitUntil: 'networkidle' });
        const tourTeaser = filterPage.locator('.project-tour-banner__media').first();
        await tourTeaser.locator('img').scrollIntoViewIfNeeded();
        await tourTeaser.locator('img').evaluate((image:HTMLImageElement) => image.decode());
        assertIncludes(await tourTeaser.innerText(), 'Tour teaser fixture credit', 'The tour teaser should retain its image credit');
        const desktopPosition = await filterPage.locator('.project-tour-banner__visit').first().evaluate(visit => {
          const copy = visit.querySelector('.project-tour-banner__copy')!.getBoundingClientRect();
          const media = visit.querySelector('.project-tour-banner__media')!.getBoundingClientRect();
          return media.left >= copy.right;
        });
        assert(desktopPosition, 'The tour teaser should appear to the right of the desktop banner copy');
        await admin.updateItem('success_project_tours', ids.series.id, { cover_image: null });
        await filterPage.reload({ waitUntil: 'networkidle' });
        assert(await filterPage.locator('.project-tour-banner__media').count() === 0, 'Tours without a teaser should omit the image column');
        assert(await filterPage.locator('.project-tour-banner .canonical-button').count() === 2, 'Missing tour images must preserve journey links while hiding draft report actions');
        await admin.updateItem('success_project_tours', ids.series.id, { cover_image: ids.file.id });
        await phonePage.goto(`${config.frontendUrl}/projects/${project.slug}`, { waitUntil: 'networkidle' });
        assert(await phonePage.locator('.project-tour-banner__visit').first().evaluate(visit => {
          const copy = visit.querySelector('.project-tour-banner__copy')!.getBoundingClientRect();
          const media = visit.querySelector('.project-tour-banner__media')!.getBoundingClientRect();
          return media.top >= copy.bottom;
        }), 'Mobile banners should place the tour teaser below the copy');
        assert(await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'The project banner should not cause mobile overflow');
        assert(await phonePage.getByRole('link', { name: 'Besuchsbericht lesen …', exact: true }).count() === 0, 'Mobile project banners must hide draft report actions');
      } finally {
        await filterContext.close();
      }
      const projectPage = await pageHtml(`${config.frontendUrl}/projects/${project.slug}`);
      assertIncludes(projectPage, 'Vorschau', 'Preview project should be labelled');
      assertIncludes(projectPage, title, 'Preview project should link back to the tour');
    });

    await runner.step('Tour series: native stop reports, media carousel, and publication gates', async () => {
      assert(ids.report && ids.series && ids.eventReport, 'Tour fixtures must exist');
      await admin.updateItem('news_items', ids.report.id, { status: 'published' });
      await admin.updateItem('success_project_tour_stops', ids.eventReport.id, { report_status: 'published' });
      await admin.updateItem('blocks', ids.blocks[0].id, { status: 'published' });
      const journey = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}`);
      assertIncludes(journey, 'The visit found practical lessons.', 'Published report teaser should appear in its chapter');
      assertIncludes(journey, 'A stop on the journey', 'Selected journey photo caption should appear');
      assertIncludes(journey, 'Automated fixture', 'Selected photo credit should appear');
      assertNotIncludes(journey, `/news/${ids.report.slug}`, 'Tour should only link to canonical tour-stop pages');
      const alias = await fetch(`${config.frontendUrl}/news/${ids.report.slug}`, { redirect: 'manual' });
      assert(alias.status === 301 && alias.headers.get('location') === `/projects/tours/${slug}/${ids.events[0].slug}`, 'Legacy report URL should permanently redirect');
      const reportPage = await pageHtml(`${config.frontendUrl}/news/${ids.report.slug}`);
      assertIncludes(reportPage, title, 'Report should link to its tour');
      assertIncludes(reportPage, projectTitle, 'Report should link to the project');
      const eventPage = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${ids.events[0].slug}`);
      assertNotIncludes(eventPage, 'Informationen zum Besuch', 'Stop reports should omit the visit-information disclosure');
      assertNotIncludes(eventPage, 'Obsolete visit information fixture.', 'Stop reports should omit the original visit-information copy');
      assertIncludes(eventPage, projectTitle, 'Stop should link to its project');
      assertIncludes(eventPage, reportTitle, 'Stop should link to its report');
      assertIncludes(eventPage, `Zur ${title}`, 'Stop navigation should name its series');
      await admin.updateItem('articles', ids.articles[0].id, { profile_stage: 'complete' });
      const completedProject = await pageHtml(`${config.frontendUrl}/projects/${ids.articles[0].slug}`);
      assertIncludes(completedProject, title, 'Completed project should retain its tour connection');
      assertIncludes(completedProject, `/projects/tours/${slug}/${ids.events[0].slug}`, 'Completed project should link to the canonical stop page');
      assertNotIncludes(completedProject, `/news/${ids.report.slug}`, 'Project page should not duplicate report destinations');
      const newsFeed = await pageHtml(`${config.frontendUrl}/news`);
      assertNotIncludes(newsFeed, `/news/${ids.report.slug}`, 'Migrated source must disappear from the news feed');
      assertIncludes(eventPage, 'Preserved nested tour report', 'Stop should render migrated nested content');

      const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/news`);
        assert(await page.locator(`a[href="/projects/tours/${slug}/${ids.events[0].slug}"]`).count() === 1, 'Published retrospective report should appear exactly once in the feed');
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.tour-collage').first().waitFor();
        await page.waitForLoadState('networkidle').catch(() => undefined);
        assertIncludes(await page.locator('.series-intro strong').innerText(), 'local climate projects', 'Tour introduction should render rich-text emphasis');
        assert(await page.locator('.series-intro a[href="/projects"]').count() === 1, 'Tour introduction should render HTML links');
        assertIncludes(await page.locator('.series-outro__reflection h2').innerText(), 'Lessons from the tour', 'Closing reflection should render an HTML heading');
        assert(await page.locator('.series-outro__reflection li').count() === 2, 'Closing reflection should render an HTML list');
        assertIncludes(await page.locator('.series-outro__reflection em').innerText(), 'together', 'Closing reflection should render rich-text emphasis');
        assert(await page.locator('.tour-collage').count() === 10, 'The geographic journal should retain all ten linked stories');
        assertNotIncludes((await page.locator('.tour-collage').allInnerTexts()).join('\n'), 'Nicht öffentlicher Projektbesuch', 'Tour cards should omit the private-visit attendance label');
        assert(await page.locator('.series-hero__route-label').count() === 10, 'Hero illustration should include every published tour stop');
        assert((await page.locator('.series-hero__route-label').last().innerText()).includes('Erfurt'), 'Hero illustration should retain the final stop');
        assert(await page.locator('.tour-explorer__waypoint').count() === 10, 'Every published stop should have a scroll waypoint');
        assert(await page.locator('.leaflet-overlay-pane path[stroke-dasharray="4 9"]').count() === 1, 'Map should render the dotted spline route');
        assert(await page.locator('.tour-map-pin').count() === 10, 'Every mapped stop should have a numbered map pin');
        await page.locator('.tour-explorer__map').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.tour-explorer__nav a:first-child')?.getAttribute('aria-current') === 'location');
        const mapBounds = await page.locator('.leaflet-container').boundingBox();
        assert(mapBounds, 'Tour map should have a visible wheel target');
        const scrollBeforeWheel = await page.evaluate(() => window.scrollY);
        await page.mouse.move(mapBounds.x + mapBounds.width * .2, mapBounds.y + mapBounds.height * .5);
        await page.mouse.wheel(0, 400);
        await page.waitForFunction((previousScroll) => window.scrollY > previousScroll + 300, scrollBeforeWheel);
        assert(await page.locator('.tour-explorer__waypoint').first().evaluate(el => Math.abs(el.getBoundingClientRect().height - Math.max(576, window.innerHeight)) < 1), 'Stop waypoints should use the shorter max(36rem, 100svh) interval');
        await page.locator('.tour-explorer__nav a').first().click();
        const stopLinks = page.locator('.tour-explorer__nav a');
        assert(await stopLinks.evaluateAll(links => links.filter(link => (link as HTMLElement).tabIndex === 0).length) === 1, 'Only the selected stop should be in the navigation tab order');
        await stopLinks.first().focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForURL(`**#stop-${ids.events[1].slug}`);
        assert(await stopLinks.nth(1).evaluate(link => link === document.activeElement && link.getAttribute('aria-current') === 'location'), 'Right arrow should select and focus the next stop');
        await page.keyboard.press('End');
        await page.waitForURL(`**#stop-${ids.events[9].slug}`);
        assert(await stopLinks.last().evaluate(link => link === document.activeElement), 'End should select and focus the final stop');
        await page.keyboard.press('ArrowRight');
        assert(await stopLinks.last().getAttribute('aria-current') === 'location', 'Right arrow should stay at the final stop');
        await page.keyboard.press('ArrowLeft');
        await page.waitForURL(`**#stop-${ids.events[8].slug}`);
        assert(await stopLinks.nth(8).evaluate(link => link === document.activeElement), 'Left arrow should focus the previous stop');
        await page.keyboard.press('Home');
        await page.waitForURL(`**#stop-${ids.events[0].slug}`);
        await page.keyboard.press('ArrowLeft');
        assert(await stopLinks.first().getAttribute('aria-current') === 'location', 'Left arrow should stay at the first stop');
        await page.keyboard.press('Tab');
        assert(await page.getByRole('button', { name: 'Nächste Station' }).evaluate(button => button === document.activeElement), 'Tab should leave the stop strip after its single tab stop');
        assert(await page.locator('.tour-explorer__prints:visible figure').count() === 2, 'Published journey photos should appear as two postcards over the map');
        const postcards = page.locator('.tour-explorer__prints:visible figure');
        const postcardImages = postcards.locator('img');
        await postcardImages.evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
        assert(await postcardImages.first().evaluate((image: HTMLImageElement) => image.naturalHeight > image.naturalWidth), 'Portrait postcard downloads must retain their original portrait shape');
        assert(await postcardImages.last().evaluate((image: HTMLImageElement) => image.naturalWidth > image.naturalHeight), 'Landscape postcard downloads must retain their original landscape shape');
        assert(await postcardImages.evaluateAll(images => images.every(element => {
          const image = element as HTMLImageElement;
          return !new URL(image.src).searchParams.has('height')
            && Math.abs(image.clientWidth / image.clientHeight - image.naturalWidth / image.naturalHeight) < .015
            && getComputedStyle(image).objectFit === 'contain';
        })), 'Map postcard images must use uncropped downloads and preserve their natural rendered aspect ratios');
        const firstPose = await postcards.first().evaluate(el => getComputedStyle(el).transform);
        assert(firstPose !== await postcards.last().evaluate(el => getComputedStyle(el).transform), 'Postcards should have different stable offsets and angles');
        assert(await page.locator('.tour-explorer__prints:visible').evaluate(el => getComputedStyle(el).overflowX === 'visible' && getComputedStyle(el).overflowY === 'visible'), 'Rotated postcards should not create scrollbar containers');
        const postcardBounds = await postcards.evaluateAll(elements => elements.map(el => { const bounds = el.getBoundingClientRect(); return { left: bounds.left, right: bounds.right }; }));
        assert(postcardBounds[0].right < postcardBounds[1].left, 'Two postcards should remain separated');
        await postcards.first().hover();
        assert(await postcards.first().evaluate(el => getComputedStyle(el).zIndex === '20'), 'Hovered postcards should come to the forefront');
        assert((await page.locator('.tour-explorer__prints:visible').innerText()).includes('Second fixture credit'), 'Map postcards should retain photo credits');
        const reportAction = page.locator('.tour-collage:visible .tour-collage__primary');
        assert(await reportAction.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(175, 202, 11)', 'Light-mode visit reports should retain brand lime green');
        assert(await reportAction.locator('span').last().evaluate(el => getComputedStyle(el).color) === 'rgb(255, 255, 255)', 'Lime CanonicalButton labels should default to white');
        assert(await reportAction.locator('.canonical-button__icon').evaluate(el => getComputedStyle(el).borderRightColor) === 'rgb(255, 255, 255)', 'Light-mode icon dividers should match the white label');
        await page.evaluate(() => { document.documentElement.dataset.theme = 'staedteChallengeDark'; });
        assert(await postcards.first().evaluate(el => {
          const expected = getComputedStyle(document.querySelector('.tour-media-viewer')!).backgroundColor;
          return getComputedStyle(el).backgroundColor === expected && getComputedStyle(el).borderTopColor === expected;
        }), 'Dark postcards should use the normal theme surface for their frames and backgrounds');
        assert(await postcards.first().locator('figcaption').evaluate(el => getComputedStyle(el).color === getComputedStyle(document.body).color), 'Dark postcard captions should use readable theme text');
        const cardPinColor = await page.locator('.tour-collage:visible .tour-collage__pin path').evaluate(el => getComputedStyle(el).fill);
        assert(cardPinColor === 'rgb(22, 186, 231)', 'Dark mode must retain the first stop’s blue pin color');
        assert(await page.locator('.tour-map-pin--active path').evaluate(el => getComputedStyle(el).fill) === cardPinColor, 'Card and map pins should retain the same station color in dark mode');
        assert(await page.locator('.tour-map-pin--active').evaluate(el => !getComputedStyle(el).filter.includes('rgb(255, 255, 255)')), 'Selected map pins should not have a white glow');
        assert(await reportAction.evaluate(el => getComputedStyle(el).getPropertyValue('--btn-color').trim()) === '#AFCA0B', 'Dark-mode visit reports should retain their brand lime accent');
        assert(await reportAction.evaluate(el => getComputedStyle(el).backgroundColor) !== 'rgb(175, 202, 11)', 'CanonicalButton backgrounds should be muted in dark mode');
        assert(await reportAction.locator('span').last().evaluate(el => getComputedStyle(el).color) === 'rgb(255, 255, 255)', 'Editorial theme rules must preserve CanonicalButton’s white text on muted lime');
        assert(await reportAction.locator('.canonical-button__icon').evaluate(el => getComputedStyle(el).borderRightColor) === 'rgb(16, 24, 32)', 'Dark-mode icon dividers should use the dark theme page color');
        await page.evaluate(() => { document.documentElement.dataset.theme = 'staedteChallemgeTheme'; });
        const secondPreview = page.locator('.tour-explorer__prints:visible button').nth(1);
        await secondPreview.click();
        const dialog = page.locator('dialog[open]');
        assert(await dialog.isVisible(), 'Map media should open in a dialog');
        assert(await dialog.evaluate(el => getComputedStyle(el).backgroundColor === getComputedStyle(el.querySelector('.tour-media-viewer__stage')!).backgroundColor), 'Media letterboxing should use the surrounding theme background');
        const lightBackground = await dialog.evaluate(el => getComputedStyle(el).backgroundColor);
        await page.evaluate(() => { document.documentElement.dataset.theme = 'staedteChallengeDark'; });
        assert(await dialog.evaluate(el => getComputedStyle(el).backgroundColor === getComputedStyle(el.querySelector('.tour-media-viewer__stage')!).backgroundColor && getComputedStyle(el).backgroundColor !== 'rgb(0, 0, 0)'), 'Dark mode should use the normal theme surface for letterboxing');
        assert(await dialog.evaluate(el => getComputedStyle(el).backgroundColor) !== lightBackground, 'Carousel backgrounds should respond to theme changes');
        await page.evaluate(() => { document.documentElement.dataset.theme = 'staedteChallemgeTheme'; });
        assertIncludes(await dialog.innerText(), '2 von 2', 'Viewer should start at the clicked entry');
        await page.waitForFunction(() => {
          const image = document.querySelector('dialog[open] img') as HTMLImageElement | null;
          return image && image.naturalWidth > image.naturalHeight && image.complete;
        });
        assert(await dialog.locator('img').evaluate(el => getComputedStyle(el).objectFit === 'contain'), 'Full-size landscape images should remain uncropped');
        const landscapeFrame = await dialog.boundingBox();
        await page.keyboard.press('ArrowLeft');
        assertIncludes(await dialog.innerText(), '1 von 2', 'Keyboard navigation should move through the gallery');
        assert(await stopLinks.first().getAttribute('aria-current') === 'location', 'Carousel arrow keys must not change the selected tour stop');
        await page.waitForFunction(() => {
          const image = document.querySelector('dialog[open] img') as HTMLImageElement | null;
          return image && image.naturalHeight > image.naturalWidth && image.complete;
        });
        const portraitFrame = await dialog.boundingBox();
        assert(landscapeFrame && portraitFrame && Math.abs(landscapeFrame.height - portraitFrame.height) < 1 && Math.abs(landscapeFrame.width - portraitFrame.width) < 1, 'The media viewer should keep its size when switching image formats');
        await page.keyboard.press('Escape');
        assert(await page.locator('dialog[open]').count() === 0, 'Escape should close the viewer');
        assert(await secondPreview.evaluate(el => el === document.activeElement), 'Closing should restore focus to the preview');
        await page.goto(`${config.frontendUrl}/news/${ids.report.slug}#block-${(await admin.readItem<{uuid:string}>('blocks', ids.blocks[0].id)).uuid}`);
        assert(page.url().includes(`/projects/tours/${slug}/${ids.events[0].slug}#block-`), 'Legacy fragments should survive redirects');
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}`);
        await page.waitForLoadState('networkidle').catch(() => undefined);
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
        assert(await page.getByRole('button', { name: 'Ganze Route zeigen' }).isVisible(), 'Whole-route control should be available in map view');
        await page.getByRole('button', { name: 'Liste', exact: true }).click();
        assert(await page.getByRole('button', { name: 'Ganze Route zeigen' }).count() === 0, 'Whole-route control should disappear in list view');
        assert(await page.getByRole('button', { name: 'Liste', exact: true }).getAttribute('aria-pressed') === 'true', 'The labelled toggle should identify list view as selected');
        assert(await page.locator('.tour-explorer__map').isHidden(), 'Desktop list view should hide the map');
        assert(await page.locator('.tour-collage:visible').count() === 10, 'Desktop list view should show every stop');
        const unlinkedCard = page.locator(`#stop-${ids.events[2].slug}`);
        assert(await unlinkedCard.locator('.tour-collage__project').count() === 0, 'Stops without published related projects should not render project actions');
        assert(await unlinkedCard.locator('.tour-collage__primary, .tour-collage__actions').count() === 0, 'Unreported stops without projects should have neither a report action nor an empty action footer');
        assertIncludes(await page.locator(`#stop-${ids.events[0].slug} .tour-collage__primary`).innerText(), 'Besuchsbericht lesen …', 'Published reports should retain their translated visit-report action');
        assert(await page.locator(`#stop-${ids.events[1].slug} .tour-collage__primary`).count() === 0, 'List cards must hide report actions for draft reports');
        assert(await page.locator(`#stop-${ids.events[1].slug} .tour-collage__project`).count() === 1, 'Published project actions should remain available without a published report');
        assert(await page.locator('.tour-card-media .tour-media-preview').first().evaluate(el => Math.abs(el.getBoundingClientRect().height - 224) < 1), 'Card media should have a fixed 14rem height');
        await page.getByRole('button', { name: 'Karte', exact: true }).focus();
        await page.keyboard.press('Enter');
        assert(await page.getByRole('button', { name: 'Karte', exact: true }).getAttribute('aria-pressed') === 'true', 'The labelled toggle should support keyboard activation and identify map view as selected');
        assert(await page.getByRole('button', { name: 'Ganze Route zeigen' }).isVisible(), 'Whole-route control should return with map view');
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
        assert(await page.locator('.tour-collage:visible .tour-collage__primary').count() === 0, 'Map overlays must hide report actions for draft reports');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.tour-explorer.is-mobile').waitFor();
        assert(await page.locator('.tour-explorer__waypoint').count() === 0, 'Mobile should not use scroll-driven waypoints');
        assert(await page.locator('.tour-collage:visible').count() === 10, 'Mobile should show every stop as a regular box');
        assert(await page.locator('.tour-collage__primary').count() === 1, 'Mobile tour cards should offer a report action only for the published report');
        assert(await page.locator('.tour-explorer__prints').count() === 0, 'Mobile photos should stay with their stop box');
        assert(await page.locator(`#stop-${ids.events[0].slug} .tour-card-media`).count() === 1, 'Mobile should show one fixed-height media preview per stop');
        await page.getByRole('button', { name: 'Ganze Route zeigen' }).click();
        await page.getByRole('button', { name: 'Liste', exact: true }).click();
        assert(await page.getByRole('button', { name: 'Ganze Route zeigen' }).count() === 0, 'Mobile list view should also hide the whole-route control');
        await page.locator('.tour-explorer__map').waitFor({ state: 'hidden', timeout: 5_000 });
        assert(await page.locator('.tour-explorer__map').isHidden(), 'Mobile map should collapse');
        await page.locator('.tour-explorer__nav a').nth(1).click();
        await page.waitForURL(`**#stop-${ids.events[1].slug}`);
        assert(await page.locator('.tour-explorer__nav a').nth(1).getAttribute('aria-current') === 'location', 'Selected stop should become active');
        await page.locator('.tour-explorer__nav a').nth(1).focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForURL(`**#stop-${ids.events[2].slug}`);
        assert(await page.locator('.tour-explorer__nav a').nth(2).evaluate(link => link === document.activeElement && link.getAttribute('aria-current') === 'location'), 'Keyboard navigation should also select and focus stops in the mobile layout');
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}#stop-${ids.events[0].slug}`, { waitUntil: 'domcontentloaded' });
        assert(await page.locator(`#stop-${ids.events[0].slug}`).count() === 1, 'Direct stop fragment should resolve to a chapter');
        await page.getByRole('button', { name: 'Karte', exact: true }).click();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert(await page.locator('.tour-card-media').first().evaluate((figure) => getComputedStyle(figure).transform === 'none'), 'Reduced-motion card previews should remain still');
        for (const width of [390, 768, 960, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForFunction(() => {
            const map = document.querySelector('.tour-explorer__map');
            return map && map.getBoundingClientRect().width >= document.body.clientWidth - 1;
          });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px layout should not overflow horizontally`);
          assert(await page.locator('.tour-explorer__map').evaluate((map) => map.getBoundingClientRect().width >= document.body.clientWidth - 1), `${width}px tour map should use the full content viewport width`);
          assert(await page.locator('.series-hero h1').evaluate((title) => title.getBoundingClientRect().right <= title.closest('.series-hero__copy')!.getBoundingClientRect().right + 1), `${width}px tour heading should not overlap the artwork`);
        }
      } finally {
        await context.close();
      }
    });
    await runner.step('Tour series: report actions follow publication status', async () => {
      assert(ids.eventReport && ids.articles[0], 'Report-action fixtures must exist');
      try {
        for (const reportStatus of ['published', 'draft', 'archived']) {
          await admin.updateItem('success_project_tour_stops', ids.eventReport.id, { report_status: reportStatus });
          const journey = await pageHtml(`${config.frontendUrl}/projects/tours/${slug}`);
          const project = await pageHtml(`${config.frontendUrl}/projects/${ids.articles[0].slug}`);
          for (const html of [journey, project]) {
            if (reportStatus === 'published') assertIncludes(html, 'Besuchsbericht lesen …', 'Published reports should have a read action');
            else assertNotIncludes(html, 'Besuchsbericht lesen', `${reportStatus} reports must not have a read action`);
          }
          assertIncludes(journey, 'Zum Erfolgsprojekt-Eintrag …', 'Report status must not hide published related projects');
          assertIncludes(project, 'Reise entdecken', 'Report status must not hide the tour discovery action');
        }
      } finally {
        await admin.updateItem('success_project_tour_stops', ids.eventReport.id, { report_status: 'published' });
      }
    });
    await runner.step('Tour series: tour, stop and report publication permissions', async () => {
      assert(ids.series && ids.eventReport && ids.landscape,'Publication fixtures must exist');
      const context=await newContext(browser);
      try {
        const page=await context.newPage();
        await page.goto(`${config.frontendUrl}/events/series/${slug}?view=map#stop-${ids.events[0].slug}`);
        assert(page.url().includes(`/projects/tours/${slug}?view=map#stop-${ids.events[0].slug}`),'Legacy tour overview redirects should preserve query strings and stop fragments in the browser');
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}`);
        // The browser token was removed from public runtime config. The permission checks
        // now verify that the Nuxt public endpoints (which use the server token internally)
        // respect the publication status. We check the Nuxt SSR pages and the tour-media
        // proxy instead of Directus directly, since the browser no longer has a token.
        await admin.request('PATCH',`/files/${ids.landscape.id}`,{body:{folder:'795b5a8b-0419-4fae-9959-a33af1fd2f37'}});
        for(const tourStatus of ['draft','published','archived'])for(const stopStatus of ['draft','published','archived'])for(const reportStatus of ['draft','published','archived']){
          await admin.updateItem('success_project_tours',ids.series.id,{status:tourStatus});
          await admin.updateItem('success_project_tour_stops',ids.eventReport.id,{status:stopStatus,report_status:reportStatus});
          const stopVisible=tourStatus==='published'&&stopStatus==='published';
          const reportVisible=stopVisible&&reportStatus==='published';
          // Check the tour-media proxy — it enforces publication status server-side
          const streamed=await fetch(`${config.frontendUrl}/api/tour-media/${ids.landscape.id}`);
          assert(streamed.ok===reportVisible,`Tour-media proxy must follow all publication statuses (${tourStatus}/${stopStatus}/${reportStatus}, HTTP ${streamed.status})`);
          // Check the SSR page — archived tours should return 404
          const detail=await fetch(`${config.frontendUrl}/projects/tours/${slug}/${ids.eventReport.slug}`);
          if(!stopVisible) assert(detail.status===404,`Stop page must be hidden for ${tourStatus}/${stopStatus}/${reportStatus}`);
        }
        const anonymous=await fetch(`${config.backendUrl}/assets/${ids.landscape.id}`);
        assert(!anonymous.ok,'Private-folder tour uploads must not bypass Frontend permissions through anonymous access');
        const detail=await fetch(`${config.frontendUrl}/projects/tours/${slug}/${ids.eventReport.slug}`);
        assert(detail.status===404,'An archived parent tour must hide its stop route');
        const alias=await fetch(`${config.frontendUrl}/events/${ids.eventReport.slug}`,{redirect:'manual'});
        assert(alias.status===404,'Legacy routes must not redirect visitors to hidden stops');
        const seriesAlias=await fetch(`${config.frontendUrl}/events/series/${slug}`,{redirect:'manual'});
        assert(seriesAlias.status===404,'Legacy series routes must not redirect visitors to an unpublished tour');
      } finally {
        await admin.updateItem('success_project_tours',ids.series.id,{status:'published'});
        await admin.updateItem('success_project_tour_stops',ids.eventReport.id,{status:'published',report_status:'published'});
        await context.close();
      }
    });
    await runner.step('Tour series: uploaded video playback and title-first detail', async () => {
      assert(ids.eventReport && ids.file, 'Report fixtures must exist');
      const clip = await readFile(new URL('../fixtures/tour-video.webm', import.meta.url));
      ids.video = await admin.uploadFile<RecordId>(`${slug}.webm`, 'video/webm', clip, 'Tour video fixture');
      const unrelatedVideo = await fetch(`${config.frontendUrl}/api/tour-media/${ids.video.id}`);
      assert(unrelatedVideo.status === 404, 'Unrelated uploaded assets must not be served by the report endpoint');
      ids.media.push(await admin.createItem<RecordId>('success_project_tour_media', { stop: ids.eventReport.id, file: ids.video.id, sort: 3, alt: 'Uploaded tour video', caption: 'Video at this stop', credit: 'Video fixture credit' }));
      const streamed = await fetch(`${config.frontendUrl}/api/tour-media/${ids.video.id}`, { headers: { Range: 'bytes=0-63' } });
      assert(streamed.status === 206 && streamed.headers.get('content-type')?.startsWith('video/'), `Uploaded video should stream a video range, received ${streamed.status} ${streamed.headers.get('content-type')}`);
      const context = await newContext(browser);
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}/${ids.events[0].slug}`, { waitUntil: 'networkidle' });
        assert(await page.locator('h1').evaluate(el => el.getBoundingClientRect().top < window.innerHeight), 'Detail title should be visible immediately');
        await page.waitForFunction(() => { const cover = document.querySelector('.event-detail__cover img') as HTMLImageElement | null; return cover && cover.complete && cover.naturalWidth > 0; });
        assert(await page.locator('.event-detail__related').evaluate(el => getComputedStyle(el).borderTopWidth === '0px'), 'Related navigation should not render a decorative horizontal rule');
        await page.getByRole('button', { name: /Uploaded tour video/ }).click();
        const videoFrame = await page.locator('dialog[open]').boundingBox();
        const video = page.locator('dialog[open] video');
        await video.evaluate(async (el: HTMLVideoElement) => { await el.play(); });
        assert(await video.evaluate((el: HTMLVideoElement) => !el.paused), 'Uploaded video should play with native controls');
        await page.getByRole('button', { name: 'Vorherige Station' }).click();
        assert(await page.locator('dialog[open] video').count() === 0, 'Changing slides should remove the playing video');
        const imageFrame = await page.locator('dialog[open]').boundingBox();
        assert(videoFrame && imageFrame && Math.abs(videoFrame.height - imageFrame.height) < 1 && Math.abs(videoFrame.width - imageFrame.width) < 1, 'The media viewer should keep its size when switching from video to image');
        await page.keyboard.press('Escape');
        assert(await page.evaluate(() => document.body.style.overflow !== 'hidden'), 'Closing restores document scrolling');
      } finally { await context.close(); }
    });
    await runner.step('Tour series: tour and stop editing and private editor previews', async () => {
      assert(ids.series && ids.eventReport && ids.landscape && ids.file,'Editor fixtures must exist');
      const roles=await admin.request<{id:string}[]>('GET','/roles',{query:{filter:JSON.stringify({name:{_eq:'ErfolgsprojekteRedaktion'}}),fields:'id',limit:1}});
      assert(roles[0],'Tour editorial role must exist');
      const email=`automated-tour-editor-${config.runId}@example.org`;
      const password=`TourEditor-${config.runId}-A1!`;
      const user=await admin.createUser<{id:string}>({email,password,role:roles[0].id,status:'active',verified:true,first_name:'Tour',last_name:'Editor'});
      const editor=new DirectusClient(config.backendUrl);
      const context=await newContext(browser);
      const legacyId=randomUUID();
      try {
        await fixture.acceptCurrentAgreements([user.id]);
        const token=await editor.login(email,password);
        const overviewScope = { entity_type: 'success_project_tours', entity_uuid: ids.series.id, field_name: 'content' };
        const overviewState = await editor.request<{blocks:unknown[];revision:string}>('GET', '/blokkli-persistence/state', { query: overviewScope });
        assert(overviewState.blocks.length === 1, 'Authorized tour editors should load draft overview blocks');
        await editor.request('POST', '/blokkli-persistence/publish', { body: { ...overviewScope, blocks: overviewState.blocks, baseRevision: overviewState.revision } });
        const overviewBlock = await admin.readItem<{tour:string;tour_stop:string|null;status:string}>('blocks', ids.tourBlocks[0].id);
        assert(overviewBlock.tour === ids.series.id && overviewBlock.tour_stop === null && overviewBlock.status === 'published', 'Overview publication should set explicit tour ownership');
        await admin.updateItem('success_project_tour_stops',ids.eventReport.id,{report_status:'draft',image:ids.landscape.id,legacy_report_id:legacyId});
        const scope={entity_type:'success_project_tour_stops',entity_uuid:ids.eventReport.id,field_name:'content'};
        const state=await editor.request<{blocks:unknown[];revision:string}>('GET','/blokkli-persistence/state',{query:scope});
        await editor.request('POST','/blokkli-persistence/publish',{body:{...scope,blocks:state.blocks,baseRevision:state.revision}});
        let ordinaryRejected=false;
        try {await editor.request('POST','/blokkli-persistence/publish',{body:{entity_type:'news_items',entity_uuid:ids.report!.id,field_name:'content',blocks:[],baseRevision:''}});}catch(error){ordinaryRejected=String(error).includes('403');}
        assert(ordinaryRejected,'The scoped tour editor policy must not grant unrelated Blokkli publishing');
        await context.addCookies([{name:'slk_locale',value:'de-DE',url:config.frontendUrl}]);
        await context.addInitScript(({token,user,legacyId,revision})=>{
          localStorage.setItem('slk_auth',JSON.stringify({accessToken:token,refreshToken:null,user}));
          localStorage.setItem(`slk:blokkli-draft:event_reports:${legacyId}`,JSON.stringify({blocks:[],mutations:[],currentIndex:-1,baseRevision:revision,updatedAt:new Date().toISOString(),ownerId:user.id}));
        },{token,user,legacyId,revision:state.revision});
        const page=await context.newPage();
        const overviewUrl = `${config.frontendUrl}/projects/tours/${slug}`;
        await page.goto(`${overviewUrl}?blokkliEditing=${ids.series.id}`, { waitUntil: 'networkidle' });
        await page.addStyleTag({ content: 'vite-devtools-dock-embedded { display: none !important; }' });
        const editableHeading = page.locator('.tour-overview-content [data-blokkli-editable-field="text"]');
        await editableHeading.dblclick();
        await page.locator('.bk-editable-field [contenteditable]').fill('Edited tour overview from Blökkli');
        await page.locator('.bk-editable-field button[type="submit"]').click();
        await page.locator('.bk-toolbar-menu-button').click();
        await page.locator('#bk-menu-list-button-publish').click();
        await page.waitForURL(overviewUrl);
        assertIncludes(await pageHtml(overviewUrl), 'Edited tour overview from Blökkli', 'Overview block edits should survive publication and a public reload');
        let overviewConflict = false;
        try { await editor.request('POST', '/blokkli-persistence/publish', { body: { ...overviewScope, blocks: overviewState.blocks, baseRevision: overviewState.revision } }); }
        catch (error) { overviewConflict = String(error).includes('409'); }
        assert(overviewConflict, 'Stale overview revisions must not overwrite published edits');
        // Use the editor's token to check block visibility — the browser token was removed.
        // The editor token has the same Frontend role permissions for reading published blocks.
        for (const status of ['draft', 'archived', 'published']) {
          await admin.updateItem('success_project_tours', ids.series.id, { status });
          // Check via the Nuxt page — unpublished tours return 404
          const pageResponse = await fetch(overviewUrl);
          if (status !== 'published') {
            assert(pageResponse.status === 404, `Unpublished tour (${status}) should hide its overview content`);
          } else {
            assert(pageResponse.ok, 'Published tour overview should be accessible');
          }
        }
        await page.goto(`${config.frontendUrl}/projects/tours/${slug}/${ids.eventReport.slug}`,{waitUntil:'networkidle'});
        await page.locator('.blokkli-block-image img').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {const image=document.querySelector('.blokkli-block-image img') as HTMLImageElement|null;return image?.complete && image.naturalWidth>0;});
        await page.getByRole('button',{name:'Berichtsdaten bearbeiten'}).waitFor();
        await page.locator('.event-detail__cover img').scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>{const cover=document.querySelector('.event-detail__cover img') as HTMLImageElement|null;return cover?.complete&&cover.naturalWidth>0});
        assert(await page.evaluate(({stop,legacyId})=>Boolean(localStorage.getItem(`slk:blokkli-draft:success_project_tour_stops:${stop}`))&&!localStorage.getItem(`slk:blokkli-draft:event_reports:${legacyId}`),{stop:ids.eventReport.id,legacyId}),'Legacy local drafts should move to the immutable stop scope');
        const publicDraft=await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${ids.eventReport.slug}`);
        assertNotIncludes(publicDraft,reportTitle,'Draft report title must remain private while an editor previews it');
        await page.getByRole('button',{name:/Uploaded tour video/}).click();
        await page.locator('dialog[open] video').evaluate(async (el:HTMLVideoElement)=>{await el.play()});
        assert(await page.locator('dialog[open] video').evaluate((el:HTMLVideoElement)=>!el.paused),'Editors should play unpublished uploaded videos');
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Berichtsdaten bearbeiten'}).click();
        const form=page.locator('main form');
        await form.locator('textarea').fill('Edited draft teaser on the same stop record.');
        const saved=page.waitForResponse(response=>response.request().method()==='PATCH'&&response.url().includes(`/items/success_project_tour_stops/${ids.eventReport!.id}`));
        await form.locator('button[type=submit]').click();
        assert((await saved).ok(),'Report metadata should save on the stop record');
        const edited=await admin.readItem<{teaser:string;report_status:string}>('success_project_tour_stops',ids.eventReport.id);
        assert(edited.teaser==='Edited draft teaser on the same stop record.'&&edited.report_status==='draft','Saving draft metadata should preserve report status');
        const published=page.waitForResponse(response=>response.request().method()==='PATCH'&&response.url().includes(`/items/success_project_tour_stops/${ids.eventReport!.id}`));
        await page.getByRole('button',{name:'Besuchsbericht veröffentlichen'}).click();
        assert((await published).ok(),'An authorized editor should publish the report on the same stop');
        assertIncludes(await pageHtml(`${config.frontendUrl}/projects/tours/${slug}/${ids.eventReport.slug}`),'Edited draft teaser on the same stop record.','Published report changes should become visible');
      } finally {
        await context.close();
        await admin.updateItem('success_project_tours', ids.series.id, { status: 'published' });
        await admin.updateItem('success_project_tour_stops',ids.eventReport.id,{report_status:'published',image:ids.file.id});
        await admin.deleteUser(user.id);
      }
    });

  } finally {
    const ignore = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { process.stderr.write(`Tour fixture cleanup: ${String(error)}\n`); } };
    for (const media of ids.media.reverse()) await ignore(() => admin.deleteItem('success_project_tour_media', media.id));
    for (const block of ids.blocks.reverse()) await ignore(() => admin.deleteItem('blocks', block.id));
    for (const block of ids.tourBlocks.reverse()) await ignore(() => admin.deleteItem('blocks', block.id));
    if (ids.series) {
      const states = await admin.readItems<{id:number}>('edit_states', {filter:{entity_type:{_eq:'success_project_tours'},entity_uuid:{_eq:ids.series.id}},fields:['id'],limit:-1});
      for (const state of states) await ignore(() => admin.deleteItem('edit_states', state.id));
    }
    if (ids.video) await ignore(() => admin.request('DELETE', `/files/${ids.video!.id}`));
    for (const photo of ids.photos.reverse()) await ignore(() => admin.deleteItem('news_journey_photos', photo.id));
    if (ids.report) await ignore(() => admin.deleteItem('news_items', ids.report!.id));
    for (const link of ids.links.reverse()) await ignore(() => admin.deleteItem('success_project_tour_stops_articles', link.id));
    for (const event of ids.events.reverse()) await ignore(() => admin.deleteItem('success_project_tour_stops', event.id));
    for (const article of ids.articles.reverse()) await ignore(() => admin.deleteItem('articles', article.id));
    if (ids.series) await ignore(() => admin.deleteItem('success_project_tours', ids.series!.id));
    if (ids.emptySeries) await ignore(() => admin.deleteItem('success_project_tours', ids.emptySeries!.id));
    if (ids.file) await ignore(() => admin.request('DELETE', `/files/${ids.file!.id}`));
    if (ids.landscape) await ignore(() => admin.request('DELETE', `/files/${ids.landscape!.id}`));
  }
}
