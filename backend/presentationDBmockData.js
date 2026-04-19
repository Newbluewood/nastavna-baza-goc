require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function mapAttractionCategoryToType(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('sport') || value.includes('ski')) return 'ski';
  if (value.includes('vidikovac')) return 'viewpoint';
  if (value.includes('eduk')) return 'education';
  if (value.includes('rekre')) return 'trail';
  if (value.includes('priroda')) return 'trail';
  return 'activity';
}

function inferDistanceByType(type) {
  if (type === 'trail') return { km: 1.2, minutes: 2 };
  if (type === 'ski') return { km: 2.6, minutes: 6 };
  if (type === 'viewpoint') return { km: 1.0, minutes: 3 };
  if (type === 'education') return { km: 0.7, minutes: 2 };
  return { km: 1.5, minutes: 4 };
}

function inferWeatherTags(type) {
  if (type === 'ski') return ['snow', 'cold', 'clear'];
  if (type === 'education') return ['sunny', 'cloudy', 'rainy'];
  if (type === 'viewpoint') return ['sunny', 'cloudy'];
  return ['sunny', 'cloudy'];
}

function inferSeasonTags(type) {
  if (type === 'ski') return ['winter'];
  return ['spring', 'summer', 'autumn'];
}

async function seedFacilitiesAndRooms(connection, shouldExecute) {
  const facilities = [
    ['smestaj', 'Хотел Пирамида', 'Репрезентативан хотелски објекат за индивидуалне и групне посете.', '24 лежаја', 12, 24, 43.559095, 20.75393, placeholder, '["Централни објекат","Ресторан"]', '["group","restaurant","central"]'],
    ['smestaj', 'Нови Студенац', 'Највећи објекат за рекреативну наставу и презентације.', '56 лежајева', 20, 56, 43.559095, 20.75393, placeholder, '["Конференцијска сала","Брз интернет"]', '["group","conference","ski"]'],
    ['smestaj', 'Вила Власта', 'Мирнији смештај за мање групе и породични боравак.', '16 лежајева', 4, 16, 43.558636, 20.750094, placeholder, '["Мирна локација","Башта"]', '["family","quiet","garden"]'],
    ['smestaj', 'Вила Борика', 'Уютан објекат окружен борима, погодан за мање групе.', '12 лежајева', 4, 12, 43.558200, 20.749800, placeholder, '["Борова шума","Тераса"]', '["family","quiet","nature"]'],
    ['smestaj', 'Кућа Гвоздац', 'Планинска кућа за самосталан боравак мањих група.', '8 лежајева', 2, 8, 43.557900, 20.751200, placeholder, '["Самосталан","Камин"]', '["family","independent","fireplace"]']
  ];

  // Presentation seed intentionally excludes non-accommodation objects (e.g. sawmill).
  if (facilities.some((facility) => facility[0] !== 'smestaj')) {
    throw new Error('presentationDBmockData must contain only smestaj facilities');
  }

  const rooms = [
    // Хотел Пирамида (facility_id=1) — 10 soba
    [1, 'Једнокреветна соба 101', 'Компактна соба за појединачног госта.', '1 особа', 1, 1, placeholder, '["wifi","tv","parking"]', '["solo","quiet"]'],
    [1, 'Једнокреветна соба 102', 'Компактна соба за појединачног госта.', '1 особа', 1, 1, placeholder, '["wifi","tv","parking"]', '["solo","quiet"]'],
    [1, 'Двокреветна соба 201', 'Комфорна соба са два лежаја.', '2 особе', 2, 2, placeholder, '["wifi","tv","parking"]', '["couple","quiet"]'],
    [1, 'Двокреветна соба 202', 'Комфорна соба са два лежаја.', '2 особе', 2, 2, placeholder, '["wifi","tv","parking"]', '["couple","quiet"]'],
    [1, 'Двокреветна соба 203', 'Комфорна соба са два лежаја и балконом.', '2 особе', 2, 2, placeholder, '["wifi","tv","parking","balkon"]', '["couple","quiet"]'],
    [1, 'Трокреветна соба 301', 'Пространа соба за мању групу или породицу.', '3 особе', 2, 3, placeholder, '["wifi","tv","parking"]', '["family","small-group"]'],
    [1, 'Трокреветна соба 302', 'Пространа соба за мању групу или породицу.', '3 особе', 2, 3, placeholder, '["wifi","tv","parking"]', '["family","small-group"]'],
    [1, 'Четворокреветна соба 401', 'Велика соба за породицу или групу.', '4 особе', 3, 4, placeholder, '["wifi","tv","parking"]', '["family","group"]'],
    [1, 'Четворокреветна соба 402', 'Велика соба за породицу или групу.', '4 особе', 3, 4, placeholder, '["wifi","tv","parking"]', '["family","group"]'],
    [1, 'Апартман Гоч', 'Премијум соба са дневним боравком и мини кухињом.', '4 особе', 2, 4, placeholder, '["wifi","tv","parking","kuhinja","dnevni boravak"]', '["family","premium"]'],

    // Нови Студенац (facility_id=2) — 10 soba
    [2, 'Конференцијска соба 101', 'Соба за предаваче и гостујуће стручњаке.', '2 особе', 1, 2, placeholder, '["wifi","radni sto"]', '["business","quiet"]'],
    [2, 'Конференцијска соба 102', 'Соба за предаваче и гостујуће стручњаке.', '2 особе', 1, 2, placeholder, '["wifi","radni sto"]', '["business","quiet"]'],
    [2, 'Студентска соба А1', 'Уредан смештај за студенте, три лежаја.', '3 особе', 2, 3, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Студентска соба А2', 'Уредан смештај за студенте, три лежаја.', '3 особе', 2, 3, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Студентска соба А3', 'Уредан смештај за студенте, три лежаја.', '3 особе', 2, 3, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Студентска соба Б1', 'Смештај за четири студента.', '4 особе', 3, 4, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Студентска соба Б2', 'Смештај за четири студента.', '4 особе', 3, 4, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Студентска соба Б3', 'Смештај за четири студента.', '4 особе', 3, 4, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Шесторокреветна соба С1', 'Велика соба за веће групе.', '6 особа', 4, 6, placeholder, '["wifi"]', '["group","budget"]'],
    [2, 'Шесторокреветна соба С2', 'Велика соба за веће групе.', '6 особа', 4, 6, placeholder, '["wifi"]', '["group","budget"]'],

    // Вила Власта (facility_id=3) — 4 sobe
    [3, 'Породична соба В1', 'Тиха соба са додатним простором за породицу.', '4 особе', 2, 4, placeholder, '["wifi","kuhinja"]', '["family","quiet","garden"]'],
    [3, 'Породична соба В2', 'Тиха соба са додатним простором за породицу.', '4 особе', 2, 4, placeholder, '["wifi","kuhinja"]', '["family","quiet","garden"]'],
    [3, 'Двокреветна соба В3', 'Мирна соба за двоје, поглед на башту.', '2 особе', 1, 2, placeholder, '["wifi","kuhinja"]', '["couple","quiet","garden"]'],
    [3, 'Трокреветна соба В4', 'Соба за мању групу или породицу са дететом.', '3 особе', 2, 3, placeholder, '["wifi","kuhinja"]', '["family","quiet"]'],

    // Вила Борика (facility_id=4) — 4 sobe
    [4, 'Двокреветна Борика 1', 'Пријатна соба у боровој шуми.', '2 особе', 1, 2, placeholder, '["wifi","terasa"]', '["couple","nature"]'],
    [4, 'Двокреветна Борика 2', 'Пријатна соба у боровој шуми.', '2 особе', 1, 2, placeholder, '["wifi","terasa"]', '["couple","nature"]'],
    [4, 'Трокреветна Борика 3', 'Просторнија соба са погледом на шуму.', '3 особе', 2, 3, placeholder, '["wifi","terasa"]', '["family","nature"]'],
    [4, 'Четворокреветна Борика 4', 'Велика соба за породицу, поглед на борове.', '4 особе', 3, 4, placeholder, '["wifi","terasa","kamin"]', '["family","nature","fireplace"]'],

    // Кућа Гвоздац (facility_id=5) — 3 sobe
    [5, 'Соба Гвоздац 1', 'Двокреветна соба у планинској кући.', '2 особе', 1, 2, placeholder, '["wifi","kamin"]', '["couple","independent"]'],
    [5, 'Соба Гвоздац 2', 'Трокреветна соба са погледом на шуму.', '3 особе', 2, 3, placeholder, '["wifi","kamin"]', '["family","independent"]'],
    [5, 'Соба Гвоздац 3', 'Четворокреветна соба за мању групу.', '4 особе', 3, 4, placeholder, '["wifi","kamin"]', '["group","independent","fireplace"]']
  ];

  for (const facility of facilities) {
    await executeOrPrint(
      connection,
      'INSERT INTO facilities (type, name, description, capacity, capacity_min, capacity_max, latitude, longitude, cover_image, location_badges, stay_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      facility,
      `seed facility ${facility[1]}`,
      shouldExecute
    );
  }

  for (const room of rooms) {
    await executeOrPrint(
      connection,
      'INSERT INTO rooms (facility_id, name, description, capacity, capacity_min, capacity_max, cover_image, amenities, stay_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      room,
      `seed room ${room[1]}`,
      shouldExecute
    );
  }
}

async function seedAttractionsAndMenus(connection, shouldExecute) {
  const docsDir = path.join(__dirname, '..', 'docs');
  const attractionsDoc = readJsonFile(path.join(docsDir, 'goc-gvozdac-okolina.json'), { atrakcije: [] });
  const menuDoc = readJsonFile(path.join(docsDir, 'piramida-meni.json'), { meni: {} });

  // Restaurant is seeded first so menu items can reliably reference attraction_id = 1 after TRUNCATE reset.
  const attractions = [
    ['restaurant', 'Павиљон Печењара', 'Restoranska ponuda za ručak i porodična okupljanja.', 0.4, 1, true, JSON.stringify(['sunny', 'cloudy', 'rainy', 'cold']), JSON.stringify(['all']), JSON.stringify(['family', 'food']), JSON.stringify(['Ресторан', 'Домаћа кухиња']), placeholder]
  ];

  const docAttractions = Array.isArray(attractionsDoc.atrakcije) ? attractionsDoc.atrakcije : [];
  for (const item of docAttractions) {
    const type = mapAttractionCategoryToType(item.kategorija);
    const distance = inferDistanceByType(type);
    attractions.push([
      type,
      String(item.ime || 'Atrakcija').trim(),
      String(item.opis || '').trim(),
      distance.km,
      distance.minutes,
      true,
      JSON.stringify(inferWeatherTags(type)),
      JSON.stringify(inferSeasonTags(type)),
      JSON.stringify(['family', 'walk']),
      JSON.stringify([String(item.kategorija || 'Sadržaj')]),
      placeholder
    ]);
  }

  if (attractions.length === 1) {
    attractions.push(
      ['trail', 'Шумска стаза 10 км', 'Обележена пешачка стаза погодна за породични полудневни излет.', 1.2, 2, true, JSON.stringify(['sunny', 'cloudy']), JSON.stringify(['spring', 'summer', 'autumn']), JSON.stringify(['family', 'walk']), JSON.stringify(['Природа', 'Лагана тура']), placeholder],
      ['ski', 'Жичара и ски стаза', 'Главни зимски садржај за активни боравак на Гочу.', 2.8, 6, true, JSON.stringify(['snow', 'cold', 'clear']), JSON.stringify(['winter']), JSON.stringify(['family', 'active']), JSON.stringify(['Ски', 'Активности']), placeholder]
    );
  }

  for (const attraction of attractions) {
    await executeOrPrint(
      connection,
      'INSERT INTO attractions (type, name, description, distance_km, distance_minutes, family_friendly, weather_tags, season_tags, suitable_for, location_badges, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      attraction,
      `seed attraction ${attraction[1]}`,
      shouldExecute
    );
  }

  const attractionTranslations = [
    [1, 'en', 'Pavilion Grill Restaurant', 'Restaurant offer for lunch and family gatherings.'],
    [2, 'en', 'Goč–Gvozdac Nature Reserve', 'Research center with over 650 plant species, including endemic and rare species.'],
    [3, 'en', 'Goč Ski Slopes', 'Slopes suitable for beginners and experienced skiers, including night skiing.'],
    [4, 'en', 'Hiking Trails', 'Marked trails of varying length and difficulty through lakes, meadows and river valleys.'],
    [5, 'en', 'Krst Viewpoint', 'Panoramic view of Kopaonik, Rtanj, Gledić Mountains and Rudnik.'],
    [6, 'en', 'Grand Meadow', 'Spacious area for rest and picnics, accessible via hiking trails.'],
    [7, 'en', 'Gvozdac Teaching Base', 'Education center for Forestry Faculty students, research and practical training in nature.']
  ];

  for (const translation of attractionTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO attraction_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
      translation,
      `seed attraction_translation en #${translation[0]}`,
      shouldExecute
    );
  }

  const menuCategoryMap = {
    predjela: 'predjelo',
    supe_i_corbe: 'supa/corba',
    glavna_jela: 'glavno jelo',
    prilozi: 'prilog',
    salate: 'salata',
    poslastice: 'poslastica',
    pica: 'piće',
    kafe: 'kafa',
    sokovi: 'sok'
  };

  const menuItems = [];
  const menuRoot = menuDoc && menuDoc.meni && typeof menuDoc.meni === 'object' ? menuDoc.meni : {};

  for (const [rawCategory, dishes] of Object.entries(menuRoot)) {
    if (!Array.isArray(dishes)) continue;
    const categoryLabel = menuCategoryMap[rawCategory] || rawCategory;

    dishes.forEach((dish, index) => {
      const ingredients = Array.isArray(dish.namernice) ? dish.namernice.join(', ') : '';
      menuItems.push([
        1,
        'sr',
        categoryLabel,
        String(dish.ime || 'Jelo').trim(),
        ingredients ? `Sastav: ${ingredients}.` : '',
        Number(dish.cena) || null,
        index + 1
      ]);
    });
  }

  if (!menuItems.length) {
    menuItems.push(
      [1, 'sr', 'glavno jelo', 'Домаћа телетина испод сача', 'Tradicionalno glavno jelo za deljenje.', 1890, 1],
      [1, 'sr', 'dečiji meni', 'Пилећи штапићи са помфритом', 'Jednostavan izbor za mlađe goste.', 790, 2],
      [1, 'sr', 'dezert', 'Пита од боровнице', 'Lokalni desert uz kafu ili čaj.', 420, 3]
    );
  }

  for (const item of menuItems) {
    await executeOrPrint(
      connection,
      'INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      item,
      `seed restaurant menu ${item[3]}`,
      shouldExecute
    );
  }
}

async function seedNews(connection, shouldExecute) {
  const newsItems = [
    ['Посета студената из иностранства', 'Група од 25 студената шумарства из Аустрије и Немачке провела је недељу дана на Гочу.', 'У оквиру програма међународне размене, студенти су учествовали у теренској настави, обишли истраживачке парцеле и упознали се са биодиверзитетом Гоча. Посета је организована у сарадњи са BOKU универзитетом из Беча и укључивала је радионице о одрживом управљању шумама.', placeholder, 'poseta-studenata-iz-inostranstva'],
    ['Пећењара поново ради', 'Обновљен павиљон пећењаре — спреман за нову сезону.', 'Након темељне реконструкције, павиљон пећењара је поново отворен за госте и посетиоце. Нови ростиљ и проширен простор за седење омогућавају пријем већих група. Домаћа телетина испод сача остаје наша специјалност.', placeholder, 'pecenjara-ponovo-radi'],
    ['Пројекат изградње надстрешница', 'Завршена прва фаза изградње надстрешница на стазама око базе.', 'Нове дрвене надстрешнице постављене су на три кључне тачке планинарских стаза — код видиковца Крст, на Великој пољани и код улаза у резерват. Пројекат финансира Шумарски факултет у сарадњи са општином Врњачка Бања.', placeholder, 'projekat-nadstresnica'],
    ['Покренут нови веб-сајт базе', 'Наставна база Гоч–Гвоздац добила је нови веб-сајт са системом за резервације.', 'Нови сајт омогућава преглед смештајних капацитета, онлајн упите за резервацију, праћење статуса и AI асистента за помоћ гостима. Сајт је развијен у сарадњи са Шумарским факултетом.', placeholder, 'pokrenut-novi-sajt'],
    ['Зимска сезона скијања отворена', 'Ски стазе на Гочу спремне — почиње сезона 2025/26.', 'Две ски стазе дужине 1200 метара и 800 метара су уређене и спремне за скијаше свих нивоа. Ноћно скијање доступно петком и суботом. Ски опрема се може изнајмити на лицу места.', placeholder, 'zimska-sezona-skijanja'],
    ['Едукативни камп за децу', 'Једнонедељни камп за децу узраста 10–14 година одржан на Гочу.', 'Деца су учила о шумским екосистемима, прављењу хербаријума и оријентацији у природи. Камп је организован у сарадњи са основним школама из Врњачке Бање и Краљева. Следећи камп планиран је за јул.', placeholder, 'edukativni-kamp-za-decu'],
    ['Смештајни капацитети спремни', 'Демо објекти и собе су попуњени placeholder садржајем.', 'Садржај служи искључиво за презентацију UI и основних токова.', placeholder, 'smestajni-kapaciteti-spremni']
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
    [3, 'en', 'Villa Vlasta', 'Quieter accommodation for smaller groups and family stays.'],
    [4, 'en', 'Villa Borika', 'Cozy facility surrounded by pines, suitable for smaller groups.'],
    [5, 'en', 'Gvozdac House', 'Mountain house for independent stays of smaller groups.']
  ];

  for (const ft of facilityTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO facility_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
      ft, `seed facility_translation en #${ft[0]}`, shouldExecute
    );
  }

  const roomTranslations = [
    // Piramida
    [1, 'en', 'Single Room 101', 'Compact room for a single guest.'],
    [2, 'en', 'Single Room 102', 'Compact room for a single guest.'],
    [3, 'en', 'Double Room 201', 'Comfortable room with two beds.'],
    [4, 'en', 'Double Room 202', 'Comfortable room with two beds.'],
    [5, 'en', 'Double Room 203', 'Comfortable room with two beds and balcony.'],
    [6, 'en', 'Triple Room 301', 'Spacious room for a small group or family.'],
    [7, 'en', 'Triple Room 302', 'Spacious room for a small group or family.'],
    [8, 'en', 'Quad Room 401', 'Large room for a family or group.'],
    [9, 'en', 'Quad Room 402', 'Large room for a family or group.'],
    [10, 'en', 'Goč Apartment', 'Premium room with living area and kitchenette.'],
    // Studenac
    [11, 'en', 'Conference Room 101', 'Room for lecturers and visiting experts.'],
    [12, 'en', 'Conference Room 102', 'Room for lecturers and visiting experts.'],
    [13, 'en', 'Student Room A1', 'Tidy accommodation for students, three beds.'],
    [14, 'en', 'Student Room A2', 'Tidy accommodation for students, three beds.'],
    [15, 'en', 'Student Room A3', 'Tidy accommodation for students, three beds.'],
    [16, 'en', 'Student Room B1', 'Accommodation for four students.'],
    [17, 'en', 'Student Room B2', 'Accommodation for four students.'],
    [18, 'en', 'Student Room B3', 'Accommodation for four students.'],
    [19, 'en', 'Six-Bed Room C1', 'Large room for bigger groups.'],
    [20, 'en', 'Six-Bed Room C2', 'Large room for bigger groups.'],
    // Vlasta
    [21, 'en', 'Family Room V1', 'Quiet room with extra space for families.'],
    [22, 'en', 'Family Room V2', 'Quiet room with extra space for families.'],
    [23, 'en', 'Double Room V3', 'Peaceful room for two, garden view.'],
    [24, 'en', 'Triple Room V4', 'Room for a small group or family with a child.'],
    // Borika
    [25, 'en', 'Double Borika 1', 'Pleasant room in the pine forest.'],
    [26, 'en', 'Double Borika 2', 'Pleasant room in the pine forest.'],
    [27, 'en', 'Triple Borika 3', 'Spacious room with forest view.'],
    [28, 'en', 'Quad Borika 4', 'Large family room with pine tree view.'],
    // Gvozdac
    [29, 'en', 'Gvozdac Room 1', 'Double room in the mountain house.'],
    [30, 'en', 'Gvozdac Room 2', 'Triple room with forest view.'],
    [31, 'en', 'Gvozdac Room 3', 'Quad room for a smaller group.']
  ];

  for (const rt of roomTranslations) {
    await executeOrPrint(
      connection,
      'INSERT INTO room_translations (entity_id, lang, name, description) VALUES (?, ?, ?, ?)',
      rt, `seed room_translation en #${rt[0]}`, shouldExecute
    );
  }

  const newsTranslations = [
    [1, 'en', 'International Student Visit', 'A group of 25 forestry students from Austria and Germany spent a week at Goč.', 'As part of an international exchange program, students participated in field teaching, visited research plots and explored the biodiversity of Goč. The visit was organized in cooperation with BOKU University in Vienna.'],
    [2, 'en', 'Grill Pavilion Reopened', 'The renovated grill pavilion is ready for the new season.', 'After thorough reconstruction, the grill pavilion has reopened for guests and visitors. A new grill and expanded seating area allow for larger groups. Home-style veal under the bell remains our specialty.'],
    [3, 'en', 'Trail Shelter Construction Project', 'First phase of trail shelter construction around the base completed.', 'New wooden shelters have been placed at three key points along the hiking trails — at the Krst viewpoint, Grand Meadow, and the reserve entrance. The project is funded by the Faculty of Forestry in cooperation with the municipality of Vrnjačka Banja.'],
    [4, 'en', 'New Website Launched', 'Teaching Base Goč–Gvozdac gets a new website with a reservation system.', 'The new site enables browsing accommodation, online reservation inquiries, status tracking, and an AI assistant for guest support. Developed in cooperation with the Faculty of Forestry.'],
    [5, 'en', 'Winter Ski Season Open', 'Ski slopes at Goč are ready — the 2025/26 season begins.', 'Two ski slopes of 1200m and 800m are prepared for skiers of all levels. Night skiing available on Fridays and Saturdays. Ski equipment can be rented on site.'],
    [6, 'en', 'Educational Camp for Children', 'A one-week camp for children ages 10–14 held at Goč.', 'Children learned about forest ecosystems, herbarium creation, and nature orientation. The camp was organized in cooperation with elementary schools from Vrnjačka Banja and Kraljevo. Next camp planned for July.'],
    [7, 'en', 'Accommodation Capacities Ready', 'Demo facilities and rooms populated with placeholder content.', 'Content is exclusively for UI presentation and basic flow demonstration.']
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
    ['facility', 4, placeholder, 'Вила Борика', 1],
    ['facility', 5, placeholder, 'Кућа Гвоздац', 1],
    ['room', 1, placeholder, 'Једнокреветна соба 101', 1],
    ['room', 3, placeholder, 'Двокреветна соба 201', 1],
    ['room', 6, placeholder, 'Трокреветна соба 301', 1],
    ['room', 10, placeholder, 'Апартман Гоч', 1],
    ['room', 13, placeholder, 'Студентска соба А1', 1],
    ['room', 16, placeholder, 'Студентска соба Б1', 1],
    ['room', 21, placeholder, 'Породична соба В1', 1],
    ['room', 25, placeholder, 'Двокреветна Борика 1', 1],
    ['room', 29, placeholder, 'Соба Гвоздац 1', 1],
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

async function seedProjectsAndStaff(connection, shouldExecute) {
  await executeOrPrint(connection, 'DELETE FROM projects', [], 'clear projects', shouldExecute);
  await executeOrPrint(connection, 'DELETE FROM staff', [], 'clear staff', shouldExecute);

  const projects = [
    ['Рекреативна настава 2026', 'Организација пролећног и јесењег циклуса рекреативне наставе за студенте Универзитета у Београду.', 'активан', '2026-03-01'],
    ['Обнова ски стаза', 'Реконструкција и проширење ски стаза за сезону 2026/2027.', 'планиран', '2026-06-01'],
    ['Едукативни камп за децу', 'Летњи камп за ученике основних школа са фокусом на екологију и шумарство.', 'активан', '2026-07-01'],
    ['Дигитализација базе', 'Увођење онлајн резервација, асистента за смештај и CRM система.', 'активан', '2025-09-01']
  ];

  for (const p of projects) {
    await executeOrPrint(
      connection,
      'INSERT INTO projects (title, description, status, start_date) VALUES (?, ?, ?, ?)',
      p, `seed project ${p[0]}`, shouldExecute
    );
  }

  const staff = [
    ['Проф. др Милан Петровић', 'Управник базе', 'uprava@goc.rs', placeholder],
    ['Јелена Јовановић', 'Рецепција и резервације', 'recepcija@goc.rs', placeholder],
    ['Марко Николић', 'Одржавање и логистика', 'tehnicka@goc.rs', placeholder],
    ['Ана Стојановић', 'Ресторан и угоститељство', 'restoran@goc.rs', placeholder],
    ['Драган Ђорђевић', 'Ски сервис и активности', 'aktivnosti@goc.rs', placeholder]
  ];

  for (const s of staff) {
    await executeOrPrint(
      connection,
      'INSERT INTO staff (full_name, role, contact_email, photo_url) VALUES (?, ?, ?, ?)',
      s, `seed staff ${s[0]}`, shouldExecute
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
    await seedAttractionsAndMenus(connection, shouldExecute);
    await seedProjectsAndStaff(connection, shouldExecute);

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