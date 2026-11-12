const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { formatDate } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const templatesDir = path.join(__dirname, '../email-templates');
const DEFAULT_FRONTEND_URL = 'https://nastavnabazagoc.netlify.app';

const getFrontendUrl = () => process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;

const brandingVars = () => {
  const frontendUrl = getFrontendUrl().replace(/\/$/, '');
  return {
    frontendUrl,
    logoUrl: `${frontendUrl}/logo-email.png`,
  };
};

// Simple template replacement
const renderTemplate = (templateName, data = {}) => {
  const templatePath = path.join(templatesDir, `${templateName}.html`);
  let template = fs.readFileSync(templatePath, 'utf8');
  const merged = { ...brandingVars(), ...data };

  // Replace {{variable}} with data.variable
  Object.keys(merged).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, merged[key] ?? '');
  });

  return template;
};

const sendEmail = async (to, template) => {
  // Anti-spam / Fake email filter for tests
  const isFake = /example\.com|test|fake|invalid/i.test(to);
  if (isFake) {
    logger.info(`[EMAIL SKIP] Preskačem slanje na fiktivnu adresu: ${to}`);
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.BREVO_API_KEY;

  // Brevo REST API
  if (apiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: 'Nastavna baza Goč',
            email: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'atrijum.sfb@gmail.com'
          },
          to: [{ email: to }],
          replyTo: { email: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || 'atrijum.sfb@gmail.com' },
          subject: template.subject,
          htmlContent: template.html
        })
      });

      if (response.ok) {
        const data = await response.json();
        logger.info(`[EMAIL] Brevo API: Poslat na ${to}: ${data.messageId}`);
        return { ok: true, messageId: data.messageId };
      } else {
        const err = await response.json();
        logger.error(`[EMAIL] Brevo API greška:`, err);
        return { ok: false, error: JSON.stringify(err) };
      }
    } catch (err) {
      logger.error(`[EMAIL] Greška:`, err.message);
      return { ok: false, error: err.message };
    }
  }

  // SMTP fallback
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    logger.info(`[EMAIL DEV MODE] To: ${to} | Subject: ${template.subject}`);
    return { ok: true, dev: true };
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Nastavna baza Goč" <${process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html
    });
    logger.info(`[EMAIL] SMTP: Poslat na ${to}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`[EMAIL] SMTP greška:`, err);
    return { ok: false, error: err.message };
  }
};

const emailService = {
  sendInquiryReceived: async (to, { name }) => {
    const html = renderTemplate('confirmation', { name });
    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Потврда пријема упита',
      html
    });
  },

  sendApproved: async (to, { name, facility, room, checkIn, checkOut, cancelToken, guestCount }) => {
    const cancelDeadline = (() => {
      const d = checkIn instanceof Date
        ? new Date(checkIn)
        : (typeof checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(checkIn)
            ? new Date(`${checkIn}T12:00:00`)
            : new Date(checkIn));

      if (Number.isNaN(d.getTime())) {
        return '';
      }

      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - 7);
      return formatDate(d);
    })();
    const cancelUrl = `${getFrontendUrl()}/cancel/${cancelToken}`;

    const html = renderTemplate('approved', {
      name,
      facility,
      room,
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      cancelDeadline,
      cancelUrl,
      guestCount
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Ваша резервација је ПОТВРЂЕНА ✅',
      html
    });
  },

  sendRejected: async (to, { name, reason, facility, room, checkIn, checkOut }) => {
    const reasonText = reason || 'Za traženi period trenutno nema raspoloživih kapaciteta.';
    const html = renderTemplate('rejected', {
      name,
      reasonText,
      facility: facility || '—',
      room: room || '—',
      checkIn: checkIn ? formatDate(checkIn) : '—',
      checkOut: checkOut ? formatDate(checkOut) : '—'
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Одговор на Ваш упит',
      html
    });
  },

  sendCancelConfirmed: async (to, { name, facility, room, checkIn, checkOut }) => {
    const html = renderTemplate('cancelConfirmed', {
      name,
      facility,
      room,
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut)
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Резервација отказана',
      html
    });
  },

  sendGuestCreated: async (to, { name, email, password }) => {
    const html = renderTemplate('guestCreated', {
      name,
      email,
      password
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Kreiran Vam je nalog',
      html
    });
  },

  sendGuestExists: async (to, { name }) => {
    const html = renderTemplate('guestExists', {
      name
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Prijem Vašeg upita',
      html
    });
  },

  sendResetPassword: async (to, { name, resetUrl }) => {
    const html = renderTemplate('reset_password', { name, resetUrl });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Resetovanje lozinke',
      html
    });
  },

  /** Admin CMS preview — sample-filled templates (does not send mail). */
  listTemplatePreviews() {
    const frontendUrl = getFrontendUrl().replace(/\/$/, '');
    const catalog = [
      {
        id: 'confirmation',
        title: 'Потврда пријема упита',
        when: 'Одмах после слања упита за смештај',
        subject: 'Nastavna baza Goč — Потврда пријема упита',
        sample: { name: 'Марко Марковић' },
      },
      {
        id: 'guestCreated',
        title: 'Креиран налог',
        when: 'Нови гост — привремена лозинка + пријава',
        subject: 'Nastavna baza Goč — Kreiran Vam je nalog',
        sample: {
          name: 'Марко Марковић',
          email: 'marko.markovic@example.com',
          password: 'Privremena123',
        },
      },
      {
        id: 'guestExists',
        title: 'Упит (налог већ постоји)',
        when: 'Гост већ има налог — линк „Мој налог“',
        subject: 'Nastavna baza Goč — Prijem Vašeg upita',
        sample: { name: 'Марко Марковић' },
      },
      {
        id: 'approved',
        title: 'Резервација потврђена',
        when: 'Админ одобри — детаљи + отказивање',
        subject: 'Nastavna baza Goč — Ваша резервација је ПОТВРЂЕНА ✅',
        sample: {
          name: 'Марко Марковић',
          facility: 'Хотел Пирамида',
          room: 'Једнокреветна соба 101',
          checkIn: '13.11.2026.',
          checkOut: '15.11.2026.',
          cancelDeadline: '06.11.2026.',
          cancelUrl: `${frontendUrl}/cancel/demo-token`,
          guestCount: '2',
        },
      },
      {
        id: 'rejected',
        title: 'Одговор / није потврђено',
        when: 'Админ не потврди период — разлог + смештај',
        subject: 'Nastavna baza Goč — Одговор на Ваш упит',
        sample: {
          name: 'Марко Марковић',
          reasonText: 'Za traženi period trenutno nema raspoloživih kapaciteta.',
          facility: 'Хотел Пирамида',
          room: 'Једнокреветна соба 101',
          checkIn: '13.11.2026.',
          checkOut: '15.11.2026.',
        },
      },
      {
        id: 'cancelConfirmed',
        title: 'Резервација отказана',
        when: 'Успешно отказивање преко линка',
        subject: 'Nastavna baza Goč — Резервација отказана',
        sample: {
          name: 'Марко Марковић',
          facility: 'Хотел Пирамида',
          room: 'Једнокреветна соба 101',
          checkIn: '13.11.2026.',
          checkOut: '15.11.2026.',
        },
      },
      {
        id: 'reset_password',
        title: 'Ресет лозинке',
        when: 'Захтев за нову лозинку (линк ~1 сат)',
        subject: 'Nastavna baza Goč — Resetovanje lozinke',
        sample: {
          name: 'Марко Марковић',
          resetUrl: `${frontendUrl}/reset-lozinka/demo-token`,
        },
      },
    ];

    return catalog.map((item) => ({
      id: item.id,
      title: item.title,
      when: item.when,
      subject: item.subject,
      html: renderTemplate(item.id, item.sample),
    }));
  },
};

module.exports = emailService;