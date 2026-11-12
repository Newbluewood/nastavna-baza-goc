jest.mock('../../services/knowledgeIngestNotify', () => ({
  notifyKnowledgeIngest: jest.fn(),
}));

const { notifyKnowledgeIngest } = require('../../services/knowledgeIngestNotify');
const { refreshAgentKnowledge } = require('../../controllers/admin/systemController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('refreshAgentKnowledge', () => {
  beforeEach(() => {
    notifyKnowledgeIngest.mockReset();
  });

  test('returns 202 when the chat agent accepts the refresh', async () => {
    notifyKnowledgeIngest.mockResolvedValue({ ok: true, status: 202 });
    const res = mockRes();

    await refreshAgentKnowledge({}, res);

    expect(notifyKnowledgeIngest).toHaveBeenCalledWith('cms-button');
    expect(res.statusCode).toBe(202);
    expect(res.body.ok).toBe(true);
  });

  test('returns 503 when the webhook is not configured', async () => {
    notifyKnowledgeIngest.mockResolvedValue({ skipped: true });
    const res = mockRes();

    await refreshAgentKnowledge({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/није подешено/);
  });

  test('returns 502 when the chat agent rejects the refresh', async () => {
    notifyKnowledgeIngest.mockResolvedValue({ ok: false, status: 401 });
    const res = mockRes();

    await refreshAgentKnowledge({}, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/INGEST_WEBHOOK_SECRET/);
  });
});
