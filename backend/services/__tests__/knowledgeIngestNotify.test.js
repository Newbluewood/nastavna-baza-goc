describe('notifyKnowledgeIngest', () => {
  const originalUrl = process.env.INGEST_WEBHOOK_URL;
  const originalSecret = process.env.INGEST_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.INGEST_WEBHOOK_URL = originalUrl;
    process.env.INGEST_WEBHOOK_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  test('skips when the webhook is not configured', async () => {
    delete process.env.INGEST_WEBHOOK_URL;
    delete process.env.INGEST_WEBHOOK_SECRET;
    jest.resetModules();
    const fetchMock = jest.spyOn(global, 'fetch');
    const { notifyKnowledgeIngest } = require('../knowledgeIngestNotify');

    await expect(notifyKnowledgeIngest('/themes')).resolves.toEqual({ skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('posts the bearer secret and does not throw when the agent is down', async () => {
    process.env.INGEST_WEBHOOK_URL = 'https://agent.example/api/ingest';
    process.env.INGEST_WEBHOOK_SECRET = 'tajna';
    jest.resetModules();
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    const { notifyKnowledgeIngest } = require('../knowledgeIngestNotify');

    await expect(notifyKnowledgeIngest('/news')).resolves.toEqual({ ok: false, error: 'offline' });
    expect(fetchMock).toHaveBeenCalledWith('https://agent.example/api/ingest', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer tajna' }),
    }));
  });
});