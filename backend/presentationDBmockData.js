require('dotenv').config();
const {
  EXECUTE_FLAG,
  hasExecuteFlag,
  createConnection,
  executeOrPrint,
  resetApplicationTables,
  seedAdmin,
  seedBasePages
} = require('./dbLifecycleShared');

const placeholder = '/placeholder.jpg';

async function seedFacilitiesAndRooms(connection, shouldExecute) {
  const facilities = [
    ['smestaj', 'Хотел Пирамида', 'Репрезентативан хотелски објекат за индивидуалне и групне посете.', '24 лежаја', 43.559095, 20.75393, placeholder, '["Централни објекат","Ресторан"]'],
    ['smestaj', 'Нови Студенац', 'Највећи објекат за рекреативну наставу и презентације.', '56 лежајева', 43.559095, 20.75393, placeholder, '["Конференцијска сала","Брз интернет"]'],
    ['smestaj', 'Вила Власта', 'Мирнији смештај за мање групе и породични боравак.', '16 лежајева', 43.558636, 20.750094, placeholder, '["Мирна локација","Башта"]']
  ];

  // Presentation seed intentionally excludes non-accommodation objects (e.g. sawmill).
  if (facilities.some((facility) => facility[0] !== 'smestaj')) {
    throw new Error('presentationDBmockData must contain only smestaj facilities');
  }

  const rooms = [
    [1, 'Двокреветна соба', 'Комфорна соба са два лежаја.', '2 особе', placeholder, '["wifi","tv","parking"]'],
    [1, 'Трокреветна соба', 'Пространа соба за мању групу.', '3 особе', placeholder, '["wifi","parking"]'],
    [2, 'Конференцијска соба', 'Соба погодна за наставнике и гостујуће предаваче.', '2 особе', placeholder, '["wifi","radni sto"]'],
    [2, 'Студентска соба', 'Основни, уредан смештај за студенте.', '4 особе', placeholder, '["wifi"]'],
    [3, 'Породична соба', 'Тиха соба са додатним простором.', '4 особе', placeholder, '["wifi","kuhinja"]']
  ];

  for (const facility of facilities) {
    await executeOrPrint(
      connection,
      'INSERT INTO facilities (type, name, description, capacity, latitude, longitude, cover_image, location_badges) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      facility,
      `seed facility ${facility[1]}`,
      shouldExecute
    );
  }

  for (const room of rooms) {
    await executeOrPrint(
      connection,
      'INSERT INTO rooms (facility_id, name, description, capacity, cover_image, amenities) VALUES (?, ?, ?, ?, ?, ?)',
      room,
      `seed room ${room[1]}`,
      shouldExecute
    );
  }
}

async function seedNews(connection, shouldExecute) {
  const newsItems = [
    ['Нова презентација базе', 'Освежен први утисак за клијентску демонстрацију.', 'Ово је демонстрациони садржај вести за први пролаз кроз систем.', placeholder, 'nova-prezentacija-baze'],
    ['Смештајни капацитети спремни', 'Демо објекти и собе су попуњени placeholder садржајем.', 'Садржај служи искључиво за презентацију UI и основних токова.', placeholder, 'smestajni-kapaciteti-spremni'],
    ['Радни ток резервација', 'Клијенту може да се покаже од почетног упита до административне обраде.', 'Текст је пример и треба га заменити стварним садржајем пре производне употребе.', placeholder, 'radni-tok-rezervacija']
  ];

  for (const item of newsItems) {
    await executeOrPrint(
      connection,
      'INSERT INTO news (title, excerpt, content, cover_image, slug, created_at, likes) VALUES (?, ?, ?, ?, ?, NOW(), 0)',
      item,
      `seed news ${item[4]}`,
      shouldExecute
    );
  }
}

async function seedSlides(connection, shouldExecute) {
  const slides = [
    ['pocetna', 'Наставна база Гоч', 'Први утисак за клијентску презентацију', placeholder, '/smestaj', 1],
    ['pocetna', 'Смештај и инфраструктура', 'Преглед објеката, соба и садржаја', placeholder, '/smestaj', 2],
    ['smestaj', 'Презентациони смештај', 'Демо објекти са placeholder фотографијама', placeholder, '/smestaj', 1]
  ];

  for (const slide of slides) {
    await executeOrPrint(
      connection,
      'INSERT INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      slide,
      `seed hero slide ${slide[1]}`,
      shouldExecute
    );
  }
}

async function seedTranslations(connection, shouldExecute) {
  const facilityTranslations = [
    [1, 'en', 'Hotel Pyramid', 'Representative hotel facility for individual and group visits.'],
    [2, 'en', 'New Studenac', 'The largest facility for recreational classes and presentations.'],
    [3, 'en', 'Villa Vlasta', 'Quieter accommodation for smaller groups and family stays.']
  ];

  for (const ft of facilityTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO facility_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
      ft, `seed facility_translation en #${ft[0]}`, shouldExecute
    );
  }

  const roomTranslations = [
    [1, 'en', 'Double Room', 'Comfortable room with two beds.'],
    [2, 'en', 'Triple Room', 'Spacious room for a small group.'],
    [3, 'en', 'Conference Room', 'Room suitable for teachers and guest lecturers.'],
    [4, 'en', 'Student Room', 'Basic, tidy accommodation for students.'],
    [5, 'en', 'Family Room', 'Quiet room with extra space.']
  ];

  for (const rt of roomTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO room_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
      rt, `seed room_translation en #${rt[0]}`, shouldExecute
    );
  }

  const newsTranslations = [
    [1, 'en', 'New Base Presentation', 'Refreshed first impression for client demonstration.', 'This is demonstration news content for the first walkthrough of the system.'],
    [2, 'en', 'Accommodation Capacities Ready', 'Demo facilities and rooms populated with placeholder content.', 'Content is exclusively for UI presentation and basic flow demonstration.'],
    [3, 'en', 'Reservation Workflow', 'Client can see the flow from initial inquiry to admin processing.', 'This text is an example and should be replaced with real content before production use.']
  ];

  for (const nt of newsTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO news_translations (entity_id, lang, title, excerpt, content) VALUES (?, ?, ?, ?, ?)',
      nt, `seed news_translation en #${nt[0]}`, shouldExecute
    );
  }

  const slideTranslations = [
    [1, 'en', 'Teaching Base Goč', 'First impression for client presentation'],
    [2, 'en', 'Accommodation & Infrastructure', 'Overview of facilities, rooms and amenities'],
    [3, 'en', 'Presentation Accommodation', 'Demo facilities with placeholder photos']
  ];

  for (const st of slideTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO hero_slides_translations (entity_id, lang, title, subtitle) VALUES (?, ?, ?, ?)',
      st, `seed hero_slides_translation en #${st[0]}`, shouldExecute
    );
  }

  const pageTranslations = [
    [1, 'en', 'Teaching Base Goč', 'Home presentation page.'],
    [2, 'en', 'Accommodation', 'Basic information about accommodation.']
  ];

  for (const pt of pageTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO page_translations (entity_id, lang, title, content) VALUES (?, ?, ?, ?)',
      pt, `seed page_translation en #${pt[0]}`, shouldExecute
    );
  }
}

async function seedGallery(connection, shouldExecute) {
  const galleryItems = [
    ['facility', 1, placeholder, 'Хотел Пирамида', 1],
    ['facility', 2, placeholder, 'Нови Студенац', 1],
    ['facility', 3, placeholder, 'Вила Власта', 1],
    ['room', 1, placeholder, 'Двокреветна соба', 1],
    ['room', 2, placeholder, 'Трокреветна соба', 1],
    ['news', 1, placeholder, 'Нова презентација базе', 1],
    ['news', 2, placeholder, 'Смештајни капацитети спремни', 1],
    ['news', 3, placeholder, 'Радни ток резервација', 1]
  ];

  for (const item of galleryItems) {
    await executeOrPrint(
      connection,
      'INSERT INTO media_gallery (entity_type, entity_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)',
      item,
      `seed gallery ${item[0]}:${item[1]}`,
      shouldExecute
    );
  }
}

async function run() {
  const shouldExecute = hasExecuteFlag();
  const connection = await createConnection();

  try {
    console.log('Connected to database for presentationDBmockData.');
    console.log(shouldExecute ? 'MODE: execute' : `MODE: dry-run (add ${EXECUTE_FLAG} to apply)`);

    await resetApplicationTables(connection, shouldExecute);
    const admin = await seedAdmin(connection, shouldExecute);
    await seedBasePages(connection, shouldExecute);
    await seedFacilitiesAndRooms(connection, shouldExecute);
    await seedNews(connection, shouldExecute);
    await seedSlides(connection, shouldExecute);
    await seedTranslations(connection, shouldExecute);
    await seedGallery(connection, shouldExecute);

    console.log('presentationDBmockData finished.');
    console.log(`Admin credentials for presentation: ${admin.username} / ${admin.password}`);
    console.log('Database state: demo content populated for client presentation (smestaj only).');
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error('presentationDBmockData failed:', err.message);
  process.exitCode = 1;
});