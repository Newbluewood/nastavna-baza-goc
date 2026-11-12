const emailService = require('../../services/emailService');

describe('emailService.listTemplatePreviews', () => {
  test('returns seven transactional templates with html', () => {
    const list = emailService.listTemplatePreviews();
    expect(list).toHaveLength(7);
    expect(list.map((t) => t.id)).toEqual([
      'confirmation',
      'guestCreated',
      'guestExists',
      'approved',
      'rejected',
      'cancelConfirmed',
      'reset_password',
    ]);
    for (const item of list) {
      expect(item.title).toBeTruthy();
      expect(item.when).toBeTruthy();
      expect(item.subject).toBeTruthy();
      expect(item.html).toContain('Марко Марковић');
      expect(item.html).toContain('logo-email.png');
    }
  });
});
