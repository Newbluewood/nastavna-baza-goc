require('dotenv').config();
const db = require('./db');

async function scalar(sql, params = []) {
  const [rows] = await db.query(sql, params);
  const firstRow = rows[0] || {};
  const firstKey = Object.keys(firstRow)[0];
  return firstRow[firstKey] ?? 0;
}

async function run() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'report';

  const counts = {
    admins: await scalar('SELECT COUNT(*) AS c FROM admins'),
    pages: await scalar('SELECT COUNT(*) AS c FROM pages'),
    facilities: await scalar('SELECT COUNT(*) AS c FROM facilities'),
    nonSmestajFacilities: await scalar("SELECT COUNT(*) AS c FROM facilities WHERE type <> 'smestaj'"),
    rooms: await scalar('SELECT COUNT(*) AS c FROM rooms'),
    news: await scalar('SELECT COUNT(*) AS c FROM news'),
    heroSlides: await scalar('SELECT COUNT(*) AS c FROM hero_slides'),
    guests: await scalar('SELECT COUNT(*) AS c FROM guests'),
    inquiries: await scalar('SELECT COUNT(*) AS c FROM inquiries'),
    reservations: await scalar('SELECT COUNT(*) AS c FROM reservations')
  };

  console.log('DB sanity report:', counts);

  if (mode === 'initial') {
    if (counts.admins < 1) throw new Error('initial mode expects at least one admin');
    if (counts.pages < 2) throw new Error('initial mode expects at least two pages');
    if (counts.facilities !== 0) throw new Error('initial mode expects zero facilities');
    if (counts.rooms !== 0) throw new Error('initial mode expects zero rooms');
    if (counts.news !== 0) throw new Error('initial mode expects zero news');
    if (counts.heroSlides !== 0) throw new Error('initial mode expects zero hero slides');
    if (counts.guests !== 0) throw new Error('initial mode expects zero guests');
    if (counts.inquiries !== 0) throw new Error('initial mode expects zero inquiries');
    if (counts.reservations !== 0) throw new Error('initial mode expects zero reservations');
    console.log('DB sanity check passed for mode=initial');
  }

  if (mode === 'presentation') {
    if (counts.admins < 1) throw new Error('presentation mode expects at least one admin');
    if (counts.pages < 2) throw new Error('presentation mode expects at least two pages');
    if (counts.facilities < 1) throw new Error('presentation mode expects facilities');
    if (counts.nonSmestajFacilities !== 0) throw new Error('presentation mode expects smestaj-only facilities');
    if (counts.rooms < 1) throw new Error('presentation mode expects rooms');
    if (counts.news < 1) throw new Error('presentation mode expects news');
    if (counts.heroSlides < 1) throw new Error('presentation mode expects hero slides');
    console.log('DB sanity check passed for mode=presentation');
  }
}

run()
  .catch((err) => {
    console.error('DB sanity check failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
