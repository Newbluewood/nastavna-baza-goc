function normalizeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCapacityRange(label, minValue, maxValue) {
  const fallbackText = String(label || '');
  const numbers = fallbackText.match(/\d+/g)?.map(Number) || [];

  const min = Number.isFinite(Number(minValue))
    ? Number(minValue)
    : (numbers.length > 1 ? numbers[0] : numbers[0] || null);
  const max = Number.isFinite(Number(maxValue))
    ? Number(maxValue)
    : (numbers.length > 1 ? numbers[numbers.length - 1] : numbers[0] || null);

  return {
    min: min || max || null,
    max: max || min || null
  };
}

function parseGuestBreakdown(message, context) {
  const adults = Number(context.adults || 0);
  const children = Number(context.children || 0);
  if (adults || children) {
    return { adults, children };
  }

  const source = String(message || '').toLowerCase();
  const adultsMatch = source.match(/(\d+)\s*(odrasl[a-z]*|adult[a-z]*)/i);
  const childrenMatch = source.match(/(\d+)\s*(dece|deca|deteta|dete|child[a-z]*)/i);

  return {
    adults: adultsMatch ? Number(adultsMatch[1]) : 0,
    children: childrenMatch ? Number(childrenMatch[1]) : 0
  };
}

function parseStayLength(message, context) {
  if (Number(context.stay_length_days) > 0) {
    return Number(context.stay_length_days);
  }
  if (Number(context.nights) > 0) {
    return Number(context.nights);
  }

  const source = String(message || '').toLowerCase();
  const match = source.match(/(\d+)\s*(no[cć]i?|dana|dan)/i);
  return match ? Number(match[1]) : null;
}

function parseArrivalHints(message, context) {
  const explicitDate = String(context.check_in || '').trim();
  const source = String(message || '').toLowerCase();
  const dateInMessage = source.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return {
      check_in: explicitDate,
      arrival_hint: null
    };
  }

  if (dateInMessage) {
    return {
      check_in: dateInMessage[1],
      arrival_hint: null
    };
  }

  if (source.includes('sledece nedelje') || source.includes('sljedece nedelje') || source.includes('next week')) {
    return {
      check_in: null,
      arrival_hint: 'next_week'
    };
  }

  if (source.includes('vikend') || source.includes('weekend')) {
    return {
      check_in: null,
      arrival_hint: 'weekend'
    };
  }

  return {
    check_in: null,
    arrival_hint: null
  };
}

function extractPreferences(message, context) {
  const source = `${String(message || '')} ${Array.isArray(context.preferences) ? context.preferences.join(' ') : ''}`.toLowerCase();
  return {
    family: source.includes('porodic') || source.includes('family'),
    quiet: source.includes('mir') || source.includes('quiet'),
    nearRestaurant: source.includes('restoran') || source.includes('hrana') || source.includes('restaurant'),
    ski: source.includes('ski') || source.includes('staza') || source.includes('zicara') || source.includes('žičara'),
    garden: source.includes('basta') || source.includes('bašta') || source.includes('garden')
  };
}

function buildFollowUpQuestion(criteria) {
  if (!criteria.adults && !criteria.children) {
    return 'Koliko dolazi odraslih i koliko dece?';
  }
  if (!criteria.check_in) {
    if (criteria.arrival_hint === 'next_week') {
      return 'Koji vam tačno datum dolaska sledeće nedelje odgovara? Pošaljite datum u formatu YYYY-MM-DD.';
    }
    return 'Koji vam je tačan datum dolaska? Pošaljite datum u formatu YYYY-MM-DD.';
  }
  if (!criteria.stay_length_days) {
    return 'Koliko dana želite da ostanete?';
  }
  return 'Recite mi još samo broj gostiju i termin pa mogu da predložim konkretan smeštaj.';
}

function deriveCheckOut(checkIn, stayLengthDays) {
  const date = new Date(`${checkIn}T12:00:00`);
  date.setDate(date.getDate() + Number(stayLengthDays));
  return date.toISOString().slice(0, 10);
}

function roomFitsGuestCount(room, totalGuests) {
  const capacity = parseCapacityRange(room.room_capacity, room.room_capacity_min, room.room_capacity_max);
  if (!capacity.max) {
    return true;
  }
  return capacity.max >= totalGuests;
}

function buildRationale(item, criteria) {
  const reasons = [];
  if (criteria.preferences.family && item.familyFriendly) {
    reasons.push('pogodno za porodični boravak');
  }
  if (criteria.preferences.quiet && item.quietFriendly) {
    reasons.push('mirnija lokacija');
  }
  if (criteria.preferences.nearRestaurant && item.restaurantNearby) {
    reasons.push('blizina restoranske ponude');
  }
  if (criteria.preferences.ski && item.skiNearby) {
    reasons.push('pristup ski sadržajima');
  }
  if (!reasons.length) {
    reasons.push('kapacitet odgovara traženom sastavu gostiju');
  }
  return reasons;
}

function scoreOption(item, criteria, totalGuests) {
  let score = 0;
  const capacity = parseCapacityRange(item.room_capacity, item.room_capacity_min, item.room_capacity_max);

  if (item.available) score += 60;
  if (capacity.max && capacity.max === totalGuests) score += 18;
  if (capacity.max && capacity.max > totalGuests) score += 10;
  if (criteria.preferences.family && item.familyFriendly) score += 22;
  if (criteria.preferences.quiet && item.quietFriendly) score += 12;
  if (criteria.preferences.nearRestaurant && item.restaurantNearby) score += 10;
  if (criteria.preferences.ski && item.skiNearby) score += 8;
  if (criteria.preferences.garden && item.gardenFriendly) score += 8;

  return score;
}

async function loadRoomMatrix(db) {
  const [rows] = await db.query(`
    SELECT
      f.id AS facility_id,
      f.name AS facility_name,
      f.description AS facility_description,
      f.capacity AS facility_capacity,
      f.capacity_min AS facility_capacity_min,
      f.capacity_max AS facility_capacity_max,
      f.cover_image AS facility_cover_image,
      f.location_badges,
      f.stay_tags AS facility_stay_tags,
      r.id AS room_id,
      r.name AS room_name,
      r.description AS room_description,
      r.capacity AS room_capacity,
      r.capacity_min AS room_capacity_min,
      r.capacity_max AS room_capacity_max,
      r.cover_image AS room_cover_image,
      r.stay_tags AS room_stay_tags
    FROM facilities f
    INNER JOIN rooms r ON r.facility_id = f.id
    WHERE f.type = 'smestaj'
    ORDER BY f.id ASC, r.id ASC
  `);

  return rows.map((row) => {
    const facilityTags = normalizeJsonArray(row.facility_stay_tags).map((item) => String(item).toLowerCase());
    const roomTags = normalizeJsonArray(row.room_stay_tags).map((item) => String(item).toLowerCase());
    const badges = normalizeJsonArray(row.location_badges).map((item) => String(item).toLowerCase());
    const combined = [...facilityTags, ...roomTags, ...badges];

    return {
      ...row,
      available: true,
      tags: combined,
      familyFriendly: combined.some((item) => item.includes('family') || item.includes('porod') || item.includes('garden')) || row.room_name.toLowerCase().includes('porod'),
      quietFriendly: combined.some((item) => item.includes('mirna') || item.includes('quiet')),
      restaurantNearby: combined.some((item) => item.includes('restoran') || item.includes('restaurant')),
      skiNearby: combined.some((item) => item.includes('ski') || item.includes('staza')),
      gardenFriendly: combined.some((item) => item.includes('bašta') || item.includes('basta') || item.includes('garden'))
    };
  });
}

async function markUnavailableRooms(db, rows, checkIn, checkOut) {
  const [reservations] = await db.query(
    `
    SELECT room_id
    FROM reservations
    WHERE status IN ('pending', 'confirmed')
      AND (
        (start_date < ? AND end_date > ?) OR
        (start_date < ? AND end_date > ?) OR
        (start_date >= ? AND end_date <= ?)
      )
    `,
    [checkOut, checkIn, checkOut, checkIn, checkIn, checkOut]
  );

  const blockedRoomIds = new Set(reservations.map((item) => Number(item.room_id)));
  return rows.map((row) => ({
    ...row,
    available: !blockedRoomIds.has(Number(row.room_id))
  }));
}

async function planStay(db, payload) {
  const message = String(payload.message || '');
  const context = payload.context || {};
  const guestBreakdown = parseGuestBreakdown(message, context);
  const arrival = parseArrivalHints(message, context);
  const stayLengthDays = parseStayLength(message, context);
  const preferences = extractPreferences(message, context);

  const criteria = {
    adults: guestBreakdown.adults,
    children: guestBreakdown.children,
    total_guests: guestBreakdown.adults + guestBreakdown.children,
    check_in: arrival.check_in,
    arrival_hint: arrival.arrival_hint,
    stay_length_days: stayLengthDays,
    preferences
  };

  if (!criteria.total_guests || !criteria.check_in || !criteria.stay_length_days) {
    return {
      status: 'needs_input',
      criteria,
      missing: {
        guest_breakdown: !criteria.total_guests,
        check_in: !criteria.check_in,
        stay_length_days: !criteria.stay_length_days
      },
      follow_up_question: buildFollowUpQuestion(criteria)
    };
  }

  const checkOut = deriveCheckOut(criteria.check_in, criteria.stay_length_days);
  const roomMatrix = await loadRoomMatrix(db);
  const availabilityRows = await markUnavailableRooms(db, roomMatrix, criteria.check_in, checkOut);

  const fits = availabilityRows
    .filter((item) => roomFitsGuestCount(item, criteria.total_guests))
    .map((item) => ({
      ...item,
      score: scoreOption(item, criteria, criteria.total_guests),
      rationale: buildRationale(item, criteria)
    }))
    .sort((a, b) => b.score - a.score);

  const preferred = fits.filter((item) => item.available).slice(0, 3);
  const fallback = fits.filter((item) => !item.available).slice(0, 3);

  return {
    status: preferred.length ? 'suggestions_ready' : 'alternatives_only',
    criteria: {
      ...criteria,
      check_out: checkOut
    },
    suggestions: preferred.map((item) => ({
      facility_id: item.facility_id,
      facility_name: item.facility_name,
      room_id: item.room_id,
      room_name: item.room_name,
      available: item.available,
      score: item.score,
      rationale: item.rationale,
      cover_image: item.room_cover_image || item.facility_cover_image,
      reservation_payload: {
        target_room_id: item.room_id,
        check_in: criteria.check_in,
        check_out: checkOut
      }
    })),
    alternatives: fallback.map((item) => ({
      facility_id: item.facility_id,
      facility_name: item.facility_name,
      room_id: item.room_id,
      room_name: item.room_name,
      score: item.score,
      rationale: item.rationale
    })),
    next_actions: [
      'Zelite li da vam posle pregleda smestaja dam i predloge obilaska prema vremenu?',
      'Ako vam neki od predloga odgovara, mogu da pokrenem rezervaciju za tu sobu.'
    ]
  };
}

async function suggestVisit(db, payload) {
  const facilityId = Number(payload.facility_id);
  const weatherMode = String(payload.weather_mode || 'any').toLowerCase();
  const isFamily = Boolean(payload.family || payload.children || payload.with_family);
  const lang = String(payload.lang || 'sr').toLowerCase();

  const [rows] = await db.query(
    `
    SELECT
      a.id,
      a.type,
      COALESCE(at.name, a.name) AS name,
      COALESCE(at.description, a.description) AS description,
      a.distance_km,
      a.distance_minutes,
      a.family_friendly,
      a.weather_tags,
      a.season_tags,
      a.suitable_for,
      a.location_badges,
      a.cover_image
    FROM attractions a
    LEFT JOIN attraction_translations at ON at.entity_id = a.id AND at.lang = ?
    WHERE a.is_active = TRUE
    ORDER BY a.type ASC, a.distance_minutes ASC, a.id ASC
    `,
    [lang === 'sr' ? '__none__' : lang]
  );

  const filtered = rows
    .map((row) => ({
      ...row,
      weather_tags: normalizeJsonArray(row.weather_tags).map((item) => String(item).toLowerCase()),
      suitable_for: normalizeJsonArray(row.suitable_for).map((item) => String(item).toLowerCase())
    }))
    .filter((row) => weatherMode === 'any' || row.weather_tags.length === 0 || row.weather_tags.includes(weatherMode))
    .filter((row) => !isFamily || row.family_friendly || row.suitable_for.includes('family'))
    .slice(0, 6);

  const restaurants = filtered.filter((row) => row.type === 'restaurant');
  const restaurantIds = restaurants.map((row) => row.id);
  const menuItems = restaurantIds.length
    ? (await db.query(
        `
        SELECT attraction_id, category, name, description, price, lang
        FROM restaurant_menu_items
        WHERE attraction_id IN (${restaurantIds.map(() => '?').join(', ')})
          AND is_available = TRUE
        ORDER BY attraction_id ASC, sort_order ASC, id ASC
        `,
        restaurantIds
      ))[0]
    : [];

  return {
    status: 'ok',
    facility_id: Number.isFinite(facilityId) ? facilityId : null,
    weather_mode: weatherMode,
    suggestions: filtered.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      distance_km: row.distance_km,
      distance_minutes: row.distance_minutes,
      family_friendly: Boolean(row.family_friendly),
      menu_items: menuItems.filter((item) => Number(item.attraction_id) === Number(row.id))
    }))
  };
}

module.exports = {
  planStay,
  suggestVisit
};