import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrateSuccessProjectTours, readLegacyTourBackup, readLegacyTours, TOUR_MEDIA_FOLDER } from './migrateSuccessProjectTours.js';

/** Isolated database schema exercises actual transfers/rollback, never site records. */
test('Native tour migration preserves content, media, drafts and reruns; collisions roll back', async () => {
  const db = new pg.Client({host:process.env.DB_HOST||'db',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE});
  await db.connect();
  const schema='tour_migration_test_'+randomUUID().replaceAll('-','');
  const q=(sql:string,args:unknown[]=[])=>db.query(sql,args);
  try {
    await q(`CREATE SCHEMA "${schema}"`);
    await q(`SET search_path TO "${schema}", public`);
    for(const table of ['success_project_tours','success_project_tour_stops','success_project_tour_media','success_project_tour_stops_articles','events','events_articles','news_items','news_journey_photos','blocks','edit_states','directus_files','directus_folders','event_series'])await q(`CREATE TABLE "${table}" (LIKE public."${table}" INCLUDING DEFAULTS)`);
    for(const table of ['success_project_tour_media','success_project_tour_stops_articles','blocks','edit_states','news_journey_photos','events_articles']) {await q(`CREATE SEQUENCE ${table}_test_seq OWNED BY ${table}.id`);await q(`ALTER TABLE ${table} ADD PRIMARY KEY(id), ALTER COLUMN id SET DEFAULT nextval('${table}_test_seq')`);}
    await q('ALTER TABLE events ADD COLUMN IF NOT EXISTS state text, ADD COLUMN IF NOT EXISTS geolocation geometry(Point,4326)');
    await q('ALTER TABLE blocks ADD COLUMN IF NOT EXISTS event_report uuid');
    await q('CREATE TABLE event_reports (id uuid,event uuid,source_news_item uuid,status text,title text,teaser text,author text,date_published timestamptz,date_created timestamptz,image uuid,image_credits text)');
    await q('CREATE TABLE event_report_media (id integer,report uuid,file uuid,poster uuid,sort integer,alt text,caption text,credit text)');
    await q('ALTER TABLE directus_folders ADD PRIMARY KEY(id)');
    const tour=randomUUID(),stop=randomUUID(),report=randomUUID(),news=randomUUID(),file=randomUUID(),uuid=randomUUID(),nested=randomUUID();
    await q("INSERT INTO event_series(id,slug,title,format,status,featured_on_projects) VALUES($1,'test-tour','Tour','tour','published',true)",[tour]);
    await q("INSERT INTO events(id,slug,title,status,start_date,date_only,series,series_order,description) VALUES($1,'test-stop','Visit','published',now(),true,$2,1,'Visit details')",[stop,tour]);
    await q("INSERT INTO news_items(id,slug,title,status,report_event) VALUES($1,'test-news','Report','published',$2)",[news,stop]);
    await q("INSERT INTO event_reports(id,event,source_news_item,status,title,image) VALUES($1,$2,$3,'draft','Report',$4)",[report,stop,news,file]);
    await q("INSERT INTO directus_files(id,storage,filename_disk,filename_download,type) VALUES($1,'local','fixture.png','fixture.png','image/png')",[file]);
    await q("INSERT INTO event_report_media(id,report,file,sort,alt,caption,credit) VALUES(1,$1,$2,2,'Alt','Caption','Credit')",[report,file]);
    await q("INSERT INTO blocks(uuid,entity_type,entity_uuid,field_name,bundle,status,sort_order,props,options,event_report) VALUES($1,'event_reports',$2,'content','container','draft',0,$3,'{}',$4)",[uuid,report,JSON.stringify({blocks:[{uuid:nested,bundle:'text',props:{content:'Nested report'},options:{}}]}),report]);
    await q("INSERT INTO edit_states(entity_type,entity_bundle,entity_uuid,draft_blocks,base_revision) VALUES('event_reports','event_report',$1,$2,'preserved-revision')",[report,JSON.stringify([{uuid:nested,bundle:'text',props:{content:'Unsaved changes'},options:{}}])]);
    assert.equal(await migrateSuccessProjectTours(db),1);
    const migrated=(await q('SELECT * FROM success_project_tour_stops WHERE id=$1',[stop])).rows[0];
    assert.equal(migrated.tour,tour);assert.equal(migrated.status,'published');assert.equal(migrated.report_status,'draft');assert.equal(migrated.report_title,'Report');assert.equal(migrated.legacy_report_id,report);
    const block=(await q('SELECT * FROM blocks WHERE uuid=$1',[uuid])).rows[0];assert.equal(block.entity_uuid,stop);assert.equal(block.tour_stop,stop);assert.equal(block.props.blocks[0].uuid,nested);assert.equal(block.event_report,null);
    const state=(await q('SELECT * FROM edit_states')).rows[0];assert.equal(state.entity_uuid,stop);assert.equal(state.base_revision,'preserved-revision');assert.equal(state.draft_blocks[0].props.content,'Unsaved changes');
    const media=(await q('SELECT * FROM success_project_tour_media')).rows[0];assert.equal(media.id,1);assert.equal(media.stop,stop);assert.equal(media.sort,2);assert.equal(media.caption,'Caption');assert.equal(media.credit,'Credit');
    const recovery=(await q('SELECT * FROM news_items WHERE id=$1',[news])).rows[0];assert.equal(recovery.is_tour_redirect,true);assert.equal(recovery.tour_stop,stop);assert.equal(recovery.report_event,null);
    assert.equal((await q('SELECT count(*)::int n FROM events')).rows[0].n,0);assert.equal(await migrateSuccessProjectTours(db),0);
    // Unmigrated news transfers directly into a native stop; ordinary events/series survive.
    const secondTour=randomUUID(),secondStop=randomUUID(),secondNews=randomUUID(),secondBlock=randomUUID(),ordinary=randomUUID(),standard=randomUUID();
    await q("INSERT INTO event_series(id,slug,title,format,status) VALUES($1,'news-source-tour','News tour','tour','published'),($2,'ordinary-series','Ordinary series','standard','published')",[secondTour,standard]);
    await q("INSERT INTO events(id,slug,title,status,start_date,series,series_order) VALUES($1,'news-source-stop','News visit','published',now(),$2,1),($3,'ordinary-event','Ordinary event','published',now(),$4,1)",[secondStop,secondTour,ordinary,standard]);
    await q("INSERT INTO news_items(id,slug,title,status,report_event) VALUES($1,'unmigrated-news','Original news report','published',$2)",[secondNews,secondStop]);
    await q("INSERT INTO news_journey_photos(news_items_id,file,sort,alt,caption,credit) VALUES($1,$2,1,'News alt','News caption','News credit')",[secondNews,file]);
    await q("INSERT INTO blocks(uuid,entity_type,entity_uuid,field_name,bundle,status,sort_order,props,options) VALUES($1,'news_items',$2,'content','text','draft',0,$3,'{}')",[secondBlock,secondNews,JSON.stringify({content:'Original news body'})]);
    assert.equal(await migrateSuccessProjectTours(db),1);
    assert.equal((await q('SELECT report_title FROM success_project_tour_stops WHERE id=$1',[secondStop])).rows[0].report_title,'Original news report');
    const newsBlock=(await q('SELECT * FROM blocks WHERE uuid=$1',[secondBlock])).rows[0];assert.equal(newsBlock.entity_uuid,secondStop);assert.equal(newsBlock.status,'published');
    assert.equal((await q('SELECT caption FROM success_project_tour_media WHERE stop=$1',[secondStop])).rows[0].caption,'News caption');
    assert.equal((await q('SELECT title FROM events WHERE id=$1',[ordinary])).rows[0].title,'Ordinary event');
    assert.equal((await q('SELECT title FROM event_series WHERE id=$1',[standard])).rows[0].title,'Ordinary series');
    assert.equal(await migrateSuccessProjectTours(db),0);
    // Staging still has ten published itinerary visits and draft project links,
    // without reports. Preserve its IDs, Berlin date-only instants and map geometry.
    const itineraryTour=randomUUID(),cover=randomUUID();
    const itineraryStops=Array.from({length:10},()=>randomUUID());
    await q("INSERT INTO directus_files(id,storage,filename_disk,filename_download,type) VALUES($1,'local','tour-cover.png','tour-cover.png','image/png')",[cover]);
    await q("INSERT INTO event_series(id,slug,title,format,status,featured_on_projects,introduction,cover_image) VALUES($1,'itinerary-only-tour','Itinerary tour','tour','published',false,'Original introduction',$2)",[itineraryTour,cover]);
    const firstVisit=Date.parse('2026-10-04T22:00:00Z');
    for(const [index,id] of itineraryStops.entries()){
      await q("INSERT INTO events(id,slug,title,status,start_date,date_only,series,series_order,state,geolocation,description) VALUES($1,$2,$3,'published',$4,true,$5,$6,'Sachsen',ST_SetSRID(ST_MakePoint(12.49,50.72),4326),'Original visit details')",[id,`itinerary-stop-${index+1}`,`Visit ${index+1}`,new Date(firstVisit+index*86400000),itineraryTour,index+1]);
      await q('INSERT INTO events_articles(events_id,articles_id) VALUES($1,$2)',[id,1000+index]);
    }
    const newsCount=(await q('SELECT count(*)::int n FROM news_items')).rows[0].n;
    assert.equal(await migrateSuccessProjectTours(db),10);
    const itinerary=(await q('SELECT * FROM success_project_tours WHERE id=$1',[itineraryTour])).rows[0];
    assert.equal(itinerary.featured_on_projects,false);assert.equal(itinerary.cover_image,cover);assert.equal(itinerary.introduction,'Original introduction');
    const visits=(await q('SELECT *,ST_X(geolocation) AS longitude,ST_Y(geolocation) AS latitude FROM success_project_tour_stops WHERE tour=$1 ORDER BY sort',[itineraryTour])).rows;
    assert.equal(visits.length,10);
    for(const [index,visit] of visits.entries()){
      assert.equal(visit.id,itineraryStops[index]);assert.equal(visit.status,'published');assert.equal(visit.report_status,'draft');assert.equal(visit.report_title,null);
      assert.equal(visit.start_date.getTime(),firstVisit+index*86400000);assert.equal(visit.date_only,true);assert.equal(visit.state,'Sachsen');assert.equal(visit.visit_details,'Original visit details');
      assert.equal(visit.longitude,12.49);assert.equal(visit.latitude,50.72);
      const link=(await q('SELECT articles_id FROM success_project_tour_stops_articles WHERE stop=$1',[visit.id])).rows[0];assert.equal(link.articles_id,1000+index);
    }
    assert.equal((await q('SELECT count(*)::int n FROM news_items')).rows[0].n,newsCount);
    assert.equal((await q('SELECT count(*)::int n FROM success_project_tour_media WHERE stop=ANY($1::uuid[])',[itineraryStops])).rows[0].n,0);
    assert.equal((await q('SELECT count(*)::int n FROM events WHERE id=ANY($1::uuid[])',[itineraryStops])).rows[0].n,0);
    assert.equal((await q('SELECT title FROM events WHERE id=$1',[ordinary])).rows[0].title,'Ordinary event');
    assert.equal(await migrateSuccessProjectTours(db),0);
    // Production has five published raw-news reports, three curated photos and
    // one published report block. Some report covers differ from itinerary photos.
    await q('ALTER TABLE directus_files ADD PRIMARY KEY(id)');
    for(const [table,column] of [['success_project_tour_stops','itinerary_image'],['success_project_tour_stops','image'],['news_items','image'],['news_journey_photos','file'],['events','image']]){
      await q(`ALTER TABLE ${table} ADD FOREIGN KEY(${column}) REFERENCES directus_files(id)`);
    }
    const productionTour=randomUUID(),publicFolder=randomUUID();
    const productionStops=Array.from({length:10},()=>randomUUID());
    const productionNews=Array.from({length:5},()=>randomUUID());
    const itineraryImages=Array.from({length:5},()=>randomUUID());
    const reportImages=itineraryImages.map((id,index)=>index<2?id:randomUUID());
    const productionBlock=randomUUID();
    await q("INSERT INTO directus_folders(id,name) VALUES($1,'public')",[publicFolder]);
    for(const id of new Set([...itineraryImages,...reportImages]))await q("INSERT INTO directus_files(id,storage,filename_disk,filename_download,type,folder) VALUES($1,'local',$2,$2,'image/jpeg',$3)",[id,`${id}.jpg`,publicFolder]);
    await q("INSERT INTO event_series(id,slug,title,format,status,featured_on_projects,introduction,cover_image) VALUES($1,'production-shaped-tour','Production tour','tour','published',true,'Edited introduction',$2)",[productionTour,cover]);
    for(const [index,id] of productionStops.entries()){
      await q("INSERT INTO events(id,slug,title,status,start_date,date_only,series,series_order,image,image_credits) VALUES($1,$2,$3,'published',$4,true,$5,$6,$7,$8)",[id,`production-stop-${index+1}`,`Visit ${index+1}`,new Date(firstVisit+index*86400000),productionTour,index+1,itineraryImages[index]||null,`Itinerary credit ${index+1}`]);
      await q('INSERT INTO events_articles(events_id,articles_id) VALUES($1,$2)',[id,2000+index]);
      if(index<5){
        await q("INSERT INTO news_items(id,slug,title,status,report_event,image,image_credits,teaser,author,date_published) VALUES($1,$2,$3,'published',$4,$5,$6,$7,'Report author',$8)",[productionNews[index],`production-report-${index+1}`,`Report ${index+1}`,id,reportImages[index],`Report credit ${index+1}`,`Report teaser ${index+1}`,`2026-10-${String(5+index).padStart(2,'0')} 12:00:00`]);
        if(index<3)await q('INSERT INTO news_journey_photos(news_items_id,file,sort,alt,caption,credit) VALUES($1,$2,$3,$4,$5,$6)',[productionNews[index],itineraryImages[index],index+1,`Alt ${index+1}`,`Caption ${index+1}`,`Gallery credit ${index+1}`]);
      }
    }
    // A cover reused by a genuine event must remain publicly accessible.
    await q('UPDATE events SET image=$1 WHERE id=$2',[reportImages[4],ordinary]);
    await q("INSERT INTO blocks(uuid,entity_type,entity_uuid,field_name,bundle,status,sort_order,props,options) VALUES($1,'news_items',$2,'content','text','published',0,$3,'{}')",[productionBlock,productionNews[0],JSON.stringify({content:'Published visit body'})]);
    const productionBackup=await readLegacyTourBackup(db,await readLegacyTours(db));
    assert.equal(productionBackup.news.length,5);assert.equal(productionBackup.journeyPhotos.length,3);assert.equal(productionBackup.blocks.length,1);assert.equal(productionBackup.projectLinks.length,10);
    assert.equal(productionBackup.journeyPhotos[2].credit,'Gallery credit 3');
    assert.equal(await migrateSuccessProjectTours(db),10);
    const productionVisits=(await q('SELECT * FROM success_project_tour_stops WHERE tour=$1 ORDER BY sort',[productionTour])).rows;
    for(const [index,visit] of productionVisits.entries()){
      assert.equal(visit.id,productionStops[index]);assert.equal(visit.report_status,index<5?'published':'draft');assert.equal(visit.itinerary_image,itineraryImages[index]||null);
      if(index<5){
        assert.equal(visit.image,reportImages[index]);assert.equal(visit.image_credits,`Report credit ${index+1}`);assert.equal(visit.itinerary_image_credits,`Itinerary credit ${index+1}`);
        assert.equal(visit.report_title,`Report ${index+1}`);assert.equal(visit.teaser,`Report teaser ${index+1}`);assert.equal(visit.author,'Report author');
        const original=(await q('SELECT * FROM news_items WHERE id=$1',[productionNews[index]])).rows[0];
        // pg interprets timestamp-without-time-zone in the host timezone. Compare
        // the actual source and destination values so preservation is checked in every TZ.
        assert.equal(visit.date_published.getTime(),original.date_published.getTime());
        assert.equal(original.status,'published');assert.equal(original.is_tour_redirect,true);assert.equal(original.tour_stop,visit.id);assert.equal(original.report_event,null);
      }
      const gallery=(await q('SELECT * FROM success_project_tour_media WHERE stop=$1',[visit.id])).rows;
      assert.equal(gallery.length,index<3?1:0);
      if(index<3){assert.equal(gallery[0].file,itineraryImages[index]);assert.equal(gallery[0].sort,index+1);assert.equal(gallery[0].credit,`Gallery credit ${index+1}`);assert.equal(gallery[0].caption,`Caption ${index+1}`);assert.equal(gallery[0].alt,`Alt ${index+1}`);}
    }
    const publishedBody=(await q('SELECT * FROM blocks WHERE uuid=$1',[productionBlock])).rows[0];
    assert.equal(publishedBody.entity_type,'success_project_tour_stops');assert.equal(publishedBody.entity_uuid,productionStops[0]);assert.equal(publishedBody.tour_stop,productionStops[0]);
    assert.equal(publishedBody.status,'published');assert.equal(publishedBody.props.content,'Published visit body');
    for(const id of [reportImages[0],reportImages[1],reportImages[4]])assert.equal((await q('SELECT folder FROM directus_files WHERE id=$1',[id])).rows[0].folder,publicFolder);
    for(const id of [reportImages[2],reportImages[3]])assert.equal((await q('SELECT folder FROM directus_files WHERE id=$1',[id])).rows[0].folder,TOUR_MEDIA_FOLDER);
    assert.equal((await q('SELECT image FROM events WHERE id=$1',[ordinary])).rows[0].image,reportImages[4]);
    assert.equal((await q('SELECT featured_on_projects FROM success_project_tours WHERE id=$1',[productionTour])).rows[0].featured_on_projects,true);
    assert.equal(await migrateSuccessProjectTours(db),0);
    // A conflicting existing destination must leave all legacy sources untouched.
    await q("INSERT INTO event_series(id,slug,title,format,status) VALUES($1,'test-tour','Changed source','tour','published')",[tour]);
    await assert.rejects(()=>migrateSuccessProjectTours(db),/refusing to overwrite/);
    assert.equal((await q('SELECT title FROM event_series WHERE id=$1',[tour])).rows[0].title,'Changed source');
    assert.equal((await q('SELECT title FROM success_project_tours WHERE id=$1',[tour])).rows[0].title,'Tour');
  } finally {await q('SET search_path TO public');await q(`DROP SCHEMA "${schema}" CASCADE`);await db.end();}
});
