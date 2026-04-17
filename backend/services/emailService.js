const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { formatDate } = require('../utils/dateUtils');

const templatesDir = path.join(__dirname, '../email-templates');

// Simple template replacement
const renderTemplate = (templateName, data) => {
  const templatePath = path.join(templatesDir, `${templateName}.html`);
  let template = fs.readFileSync(templatePath, 'utf8');

  // Replace {{variable}} with data.variable
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, data[key] || '');
  });

  return template;
};

const sendEmail = async (to, template) => {
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
        console.log(`[EMAIL] Brevo API: Poslat na ${to}: ${data.messageId}`);
        return { ok: true, messageId: data.messageId };
      } else {
        const err = await response.json();
        console.error(`[EMAIL] Brevo API greška:`, err);
        return { ok: false, error: JSON.stringify(err) };
      }
    } catch (err) {
      console.error(`[EMAIL] Greška:`, err.message);
      return { ok: false, error: err.message };
    }
  }

  // SMTP fallback
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log(`[EMAIL DEV MODE] To: ${to} | Subject: ${template.subject}`);
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
    console.log(`[EMAIL] SMTP: Poslat na ${to}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] SMTP greška:`, err);
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
    const cancelUrl = `${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/cancel/${cancelToken}`;

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
      checkOut: checkOut ? formatDate(checkOut) : '—',
      frontendUrl: process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'
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
      checkOut: formatDate(checkOut),
      frontendUrl: process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'
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
      password,
      frontendUrl: process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'
    });

    return sendEmail(to, {
      subject: 'Nastavna baza Goč — Kreiran Vam je nalog',
      html
    });
  },

  sendGuestExists: async (to, { name }) => {
    const html = renderTemplate('guestExists', {
      name,
      frontendUrl: process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'
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
  }
};

module.exports = emailService;