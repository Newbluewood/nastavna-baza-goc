'use strict';

/**
 * Read-only PostHog stats for CMS dashboard.
 * Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID.
 * API host is usually https://eu.posthog.com (not eu.i.posthog.com).
 */

const DAY_LABELS_SR = ['Нед', 'Пон', 'Уто', 'Сре', 'Чет', 'Пет', 'Суб'];

function config() {
  const apiKey = String(process.env.POSTHOG_PERSONAL_API_KEY || '').trim();
  const projectId = String(process.env.POSTHOG_PROJECT_ID || '').trim();
  const host = String(process.env.POSTHOG_HOST || 'https://eu.posthog.com')
    .trim()
    .replace(/\/$/, '');
  return { apiKey, projectId, host, configured: Boolean(apiKey && projectId) };
}

function parseDays(raw, fallback = 30) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 90);
}

async function runHogQl(sql, name = 'cms-site-stats') {
  const { apiKey, projectId, host, configured } = config();
  if (!configured) {
    const err = new Error('PostHog personal API is not configured');
    err.code = 'POSTHOG_NOT_CONFIGURED';
    throw err;
  }

  const url = `${host}/api/projects/${encodeURIComponent(projectId)}/query/`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query: { kind: 'HogQLQuery', query: sql },
      name
    })
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const message =
      body?.detail ||
      body?.error ||
      body?.message ||
      `PostHog query failed (${response.status})`;
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    err.code = 'POSTHOG_QUERY_FAILED';
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return Array.isArray(body?.results) ? body.results : [];
}

function adminExcludeSql() {
  return `
    coalesce(properties.$pathname, '') NOT LIKE '/admin%'
    AND coalesce(properties.$current_url, '') NOT LIKE '%/admin%'
  `;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(toNumber(seconds)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}м ${String(r).padStart(2, '0')}с`;
}

function countryFlag(name) {
  const map = {
    Serbia: '🇷🇸',
    'Bosnia and Herzegovina': '🇧🇦',
    Germany: '🇩🇪',
    Austria: '🇦🇹',
    Croatia: '🇭🇷',
    Montenegro: '🇲🇪',
    Slovenia: '🇸🇮',
    Hungary: '🇭🇺',
    Switzerland: '🇨🇭',
    France: '🇫🇷',
    Italy: '🇮🇹',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸'
  };
  return map[name] || '🌍';
}

async function fetchOverview(days) {
  const d = parseDays(days);
  const rows = await runHogQl(
    `
      SELECT
        count() AS pageviews,
        count(DISTINCT distinct_id) AS visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${d} DAY
        AND ${adminExcludeSql()}
    `,
    'cms-overview'
  );
  const row = rows[0] || [];

  let avgDwellSeconds = null;
  try {
    const dwellRows = await runHogQl(
      `
        SELECT avg(session_duration) AS avg_dwell_seconds
        FROM (
          SELECT distinct_id, dateDiff('second', min(timestamp), max(timestamp)) AS session_duration
          FROM events
          WHERE timestamp >= now() - INTERVAL ${d} DAY
            AND ${adminExcludeSql()}
          GROUP BY distinct_id, properties.$session_id
          HAVING session_duration > 0 AND session_duration < 3600
        )
      `,
      'cms-dwell'
    );
    if (dwellRows[0] && dwellRows[0][0] != null) {
      avgDwellSeconds = toNumber(dwellRows[0][0]);
    }
  } catch {
    avgDwellSeconds = null;
  }

  return {
    pageviews: toNumber(row[0]),
    visitors: toNumber(row[1]),
    avgDwellSeconds,
    avgDwellLabel: avgDwellSeconds == null ? '—' : formatDuration(avgDwellSeconds)
  };
}

async function fetchTrafficByDay(days = 7) {
  const d = Math.min(parseDays(days, 7), 14);
  const rows = await runHogQl(
    `
      SELECT
        toDate(timestamp) AS day,
        count() AS visits
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${d} DAY
        AND ${adminExcludeSql()}
      GROUP BY day
      ORDER BY day
    `,
    'cms-traffic-by-day'
  );

  return rows.map((r) => {
    const dayRaw = String(r[0] || '');
    const date = new Date(`${dayRaw}T00:00:00Z`);
    const label = Number.isNaN(date.getTime())
      ? dayRaw.slice(5)
      : DAY_LABELS_SR[date.getUTCDay()];
    return {
      day: label,
      date: dayRaw,
      visits: toNumber(r[1])
    };
  });
}

async function fetchGeo(days, limit = 6) {
  const d = parseDays(days);
  const rows = await runHogQl(
    `
      SELECT
        coalesce(properties.$geoip_country_name, 'Unknown') AS country,
        count() AS views
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${d} DAY
        AND ${adminExcludeSql()}
      GROUP BY country
      ORDER BY views DESC
      LIMIT ${Math.min(limit, 20)}
    `,
    'cms-geo'
  );

  const total = rows.reduce((sum, r) => sum + toNumber(r[1]), 0) || 1;
  return rows.map((r) => {
    const country = String(r[0] || 'Unknown');
    const views = toNumber(r[1]);
    return {
      country,
      views,
      pct: Math.round((views / total) * 100),
      flag: countryFlag(country)
    };
  });
}

async function fetchTopPages(days, limit = 8) {
  const d = parseDays(days);
  const rows = await runHogQl(
    `
      SELECT
        coalesce(nullIf(properties.$pathname, ''), properties.$current_url) AS path,
        count() AS views
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${d} DAY
        AND ${adminExcludeSql()}
      GROUP BY path
      ORDER BY views DESC
      LIMIT ${Math.min(limit, 30)}
    `,
    'cms-top-pages'
  );

  return rows
    .map((r) => ({
      path: String(r[0] || '/'),
      views: toNumber(r[1])
    }))
    .filter((r) => r.path && !r.path.startsWith('/admin'));
}

async function fetchTopRoomsFromPageviews(days, limit = 6) {
  const d = parseDays(days);
  const rows = await runHogQl(
    `
      SELECT
        properties.$pathname AS path,
        count() AS views
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${d} DAY
        AND properties.$pathname LIKE '/smestaj/%'
        AND properties.$pathname NOT LIKE '/smestaj'
      GROUP BY path
      ORDER BY views DESC
      LIMIT ${Math.min(limit, 20)}
    `,
    'cms-top-rooms'
  );

  return rows.map((r) => {
    const path = String(r[0] || '');
    const slug = path.replace(/^\/smestaj\//, '').replace(/\/$/, '') || path;
    return {
      name: slug,
      path,
      clicks: toNumber(r[1]),
      inquiries: null
    };
  });
}

/**
 * Aggregate site stats for CMS. Never throws for empty data.
 */
async function getSiteStats({ days = 30 } = {}) {
  const d = parseDays(days);
  const { configured, host, projectId } = config();

  if (!configured) {
    return {
      live: false,
      source: 'unconfigured',
      days: d,
      error: 'POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID nisu podešeni'
    };
  }

  try {
    const [overview, trafficByDay, geo, topPages, topRooms] = await Promise.all([
      fetchOverview(d),
      fetchTrafficByDay(7),
      fetchGeo(d, 6),
      fetchTopPages(d, 8),
      fetchTopRoomsFromPageviews(d, 6)
    ]);

    return {
      live: true,
      source: 'posthog',
      days: d,
      host,
      projectId,
      overview,
      trafficByDay,
      geo,
      topPages,
      topRooms,
      kpis: [
        {
          key: 'visits',
          label: 'Јединствени посетиоци',
          value: overview.visitors,
          delta: `${d}д`
        },
        {
          key: 'views',
          label: 'Прегледи страница',
          value: overview.pageviews,
          delta: `${d}д`
        },
        {
          key: 'dwell',
          label: 'Просечно задржавање',
          value: overview.avgDwellLabel,
          delta: `${d}д`
        },
        {
          key: 'topRoom',
          label: 'Најгледанији смештај',
          value: topRooms[0]?.name || '—',
          delta: topRooms[0] ? `${topRooms[0].clicks} прегледа` : '—'
        }
      ]
    };
  } catch (err) {
    return {
      live: false,
      source: 'posthog_error',
      days: d,
      error: err.message,
      code: err.code || null,
      status: err.status || null
    };
  }
}

module.exports = {
  config,
  parseDays,
  getSiteStats,
  runHogQl
};
