const { notifyKnowledgeIngest } = require('../services/knowledgeIngestNotify');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Paths the production ingest script actually reads into Qdrant.
const CONTENT_WRITE = /^\/(?:api\/admin\/)?(?:news|pages|themes|facilities|rooms|restaurants|menu-items)(?:\/|$)/;

function isKnowledgeContentWrite(req) {
  if (!MUTATING.has(req.method)) return false;
  const path = req.path || '';
  const full = `${req.baseUrl || ''}${path}`;
  return CONTENT_WRITE.test(path) || CONTENT_WRITE.test(full);
}

function scheduleKnowledgeIngest(req, res, next) {
  if (isKnowledgeContentWrite(req)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        notifyKnowledgeIngest(req.path);
      }
    });
  }
  next();
}

module.exports = scheduleKnowledgeIngest;
module.exports.isKnowledgeContentWrite = isKnowledgeContentWrite;
