const emailService = require('../../services/emailService');

async function listEmailTemplates(req, res) {
  res.json({
    templates: emailService.listTemplatePreviews(),
  });
}

module.exports = { listEmailTemplates };
