/**
 * Asks the chat-agent to refresh Qdrant.
 * Called from the CMS button "Osveži znanje".
 * No-op when INGEST_WEBHOOK_URL or INGEST_WEBHOOK_SECRET is empty.
 * Never throws — the admin response maps skipped/failed results.
 */
function notifyKnowledgeIngest(reason) {
  const url = (process.env.INGEST_WEBHOOK_URL || '').trim();
  const secret = (process.env.INGEST_WEBHOOK_SECRET || '').trim();
  if (!url || !secret) {
    return Promise.resolve({ skipped: true });
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: reason || 'cms' }),
    signal: AbortSignal.timeout(8000),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[ingest-webhook] ${res.status} ${text.slice(0, 200)}`);
      return { ok: false, status: res.status };
    }
    console.log(`[ingest-webhook] accepted (${res.status})`);
    return { ok: true, status: res.status };
  }).catch((err) => {
    console.error('[ingest-webhook]', err.message);
    return { ok: false, error: err.message };
  });
}

module.exports = { notifyKnowledgeIngest };
