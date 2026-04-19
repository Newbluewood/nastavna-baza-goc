function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function classifyWeatherMode(weatherCode, precipitationProbability) {
  const code = Number(weatherCode);
  const precip = Number(precipitationProbability || 0);

  const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
  const rainyCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
  const cloudyCodes = new Set([1, 2, 3, 45, 48]);

  if (snowCodes.has(code)) return 'snow';
  if (rainyCodes.has(code) || precip >= 60) return 'rainy';
  if (cloudyCodes.has(code)) return 'cloudy';
  return 'sunny';
}

function srLabelForMode(mode) {
  if (mode === 'snow') return 'sneg';
  if (mode === 'rainy') return 'kiša';
  if (mode === 'cloudy') return 'oblačno';
  if (mode === 'sunny') return 'sunčano';
  return 'promenljivo';
}

function buildSummary(mode, dayData) {
  const max = Number(dayData?.temperature_2m_max);
  const min = Number(dayData?.temperature_2m_min);
  const precip = Number(dayData?.precipitation_probability_max || 0);

  const temperatureText = Number.isFinite(min) && Number.isFinite(max)
    ? `${Math.round(min)}-${Math.round(max)}°C`
    : 'bez temperature';

  return `Prognoza za izabrani datum: ${srLabelForMode(mode)} (${temperatureText}, padavine ${Math.round(precip)}%).`;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildUpcomingSummary(days, daily = {}) {
  const maxList = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max.map(Number).filter(Number.isFinite) : [];
  const minList = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min.map(Number).filter(Number.isFinite) : [];
  const precipList = Array.isArray(daily.precipitation_probability_max)
    ? daily.precipitation_probability_max.map(Number).filter(Number.isFinite)
    : [];

  const overallMax = maxList.length ? Math.round(Math.max(...maxList)) : null;
  const overallMin = minList.length ? Math.round(Math.min(...minList)) : null;
  const avgPrecip = precipList.length
    ? Math.round(precipList.reduce((sum, item) => sum + item, 0) / precipList.length)
    : null;
  const rainyDays = precipList.filter((value) => value >= 60).length;

  const tempPart = (overallMin != null && overallMax != null)
    ? `Danju oko ${overallMax}°C, nocu oko ${overallMin}°C`
    : 'Temperatura je promenljiva';
  const precipPart = avgPrecip != null
    ? `Prosecna sansa za padavine je oko ${avgPrecip}%`
    : 'Padavine su promenljive';
  const rainDaysPart = rainyDays > 0
    ? `moguce su padavine u oko ${rainyDays}/${days} dana.`
    : 'nije najavljena znacajna kisa.';

  return `U narednih ${days} dana na Gocu: ${tempPart}. ${precipPart}, ${rainDaysPart}`;
}

async function getForecastForDate(checkIn, options = {}) {
  if (!isIsoDate(checkIn)) {
    return {
      available: false,
      mode: 'any',
      reason: 'missing_or_invalid_date'
    };
  }

  const latitude = toNumber(options.latitude, toNumber(process.env.WEATHER_LAT, 43.559095));
  const longitude = toNumber(options.longitude, toNumber(process.env.WEATHER_LON, 20.75393));
  const timezone = process.env.WEATHER_TIMEZONE || 'Europe/Belgrade';

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    start_date: checkIn,
    end_date: checkIn
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.reason || `HTTP ${response.status}`);
    }

    const dayData = {
      weathercode: data?.daily?.weathercode?.[0],
      temperature_2m_max: data?.daily?.temperature_2m_max?.[0],
      temperature_2m_min: data?.daily?.temperature_2m_min?.[0],
      precipitation_probability_max: data?.daily?.precipitation_probability_max?.[0]
    };

    const mode = classifyWeatherMode(dayData.weathercode, dayData.precipitation_probability_max);
    return {
      available: true,
      source: 'open-meteo',
      mode,
      check_in: checkIn,
      location: { latitude, longitude },
      data: dayData,
      summary: buildSummary(mode, dayData)
    };
  } catch (error) {
    return {
      available: false,
      mode: 'any',
      reason: 'provider_unavailable',
      error: error.message
    };
  }
}

async function getForecastForUpcomingDays(days = 7, options = {}) {
  const safeDays = Math.max(1, Math.min(14, Number(days) || 7));

  const latitude = toNumber(options.latitude, toNumber(process.env.WEATHER_LAT, 43.559095));
  const longitude = toNumber(options.longitude, toNumber(process.env.WEATHER_LON, 20.75393));
  const timezone = process.env.WEATHER_TIMEZONE || 'Europe/Belgrade';

  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + safeDays - 1);

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    start_date: formatIsoDate(start),
    end_date: formatIsoDate(end)
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.reason || `HTTP ${response.status}`);
    }

    return {
      available: true,
      source: 'open-meteo',
      days: safeDays,
      start_date: formatIsoDate(start),
      end_date: formatIsoDate(end),
      location: { latitude, longitude },
      summary: buildUpcomingSummary(safeDays, data?.daily || {}),
      data: data?.daily || {}
    };
  } catch (error) {
    return {
      available: false,
      days: safeDays,
      reason: 'provider_unavailable',
      error: error.message
    };
  }
}

module.exports = {
  getForecastForDate,
  getForecastForUpcomingDays
};