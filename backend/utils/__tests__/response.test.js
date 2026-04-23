// response.test.js
const { sendSuccess, sendError } = require('../response');

describe('response utils', () => {
  let res;
  beforeEach(() => {
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  test('sendSuccess returns data', () => {
    const data = { foo: 'bar' };
    sendSuccess(res, data);
    expect(res.json).toHaveBeenCalledWith(data);
  });

  test('sendError returns error with status', () => {
    sendError(res, 404, 'Not found');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});
