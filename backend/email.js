const nodemailer = require('nodemailer');

// ===== SEND HELPER =====
// Koristi Brevo REST API ako postoji BREVO_API_KEY, inace SMTP fallback
const sendEmail = async (to, template) => {
  const apiKey = process.env.BREVO_API_KEY;

  // --- Brevo REST API (preporuceno, bez DKIM problema) ---
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

  // --- SMTP fallback (za lokalni razvoj bez Brevo) ---
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log(`[EMAIL DEV MODE] To: ${to} | Subject: ${template.subject}`);
    return { ok: true, dev: true };
  }

  const transporter = nodemailer.createTransport(
    process.env.EMAIL_HOST ? {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
    } : {
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
    }
  );

  try {
    const info = await transporter.sendMail({
      from: `"Nastavna baza Goč" <${process.env.EMAIL_USER}>`,
      to, subject: template.subject, html: template.html
    });
    console.log(`[EMAIL] SMTP: Poslat na ${to}: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] SMTP Greška:`, err.message);
    return { ok: false, error: err.message };
  }
};


// Helper: format datuma za email
const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

// ===== EMAIL TEMPLATES =====

const templates = {

  // 1. Potvrda prijema upita
  inquiryReceived: ({ name }) => ({
    subject: 'Nastavna baza Goč — Потврда пријема упита',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #332317;">Поштовани/а ${name},</h2>
          <p style="line-height: 1.7;">Потврђујемо приjем Вашег упита за сmeштај у Наставној бази Гоч.</p>
          <p style="line-height: 1.7;">Наш тим ће прегледати Ваш захтев и <strong>одговорити у року од 24 сата</strong>.</p>
          <p style="line-height: 1.7;">Хвала на интересовању!</p>
          <hr style="border: none; border-top: 1px solid #e8e0d8; margin: 25px 0;">
          <p style="color: #888; font-size: 0.85rem;">
            Dear ${name},<br>
            We have received your accommodation inquiry at the Goč Teaching Base.<br>
            Our team will review your request and <strong>respond within 24 hours</strong>. Thank you!
          </p>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  }),

  // 2. Rezervacija odobrena
  approved: ({ name, facility, room, checkIn, checkOut, cancelToken, guestCount }) => {
    const cancelDeadline = (() => {
      const d = new Date(checkIn + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      return fmt(d.toISOString().split('T')[0]);
    })();
    const cancelUrl = `${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/cancel/${cancelToken}`;

    return {
      subject: 'Nastavna baza Goč — Ваша резервација је ПОТВРЂЕНА ✅',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
          <div style="background: #332317; padding: 20px 30px;">
            <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
          </div>
          <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
            <h2 style="color: #27ae60;">✅ Резервација потврђена!</h2>
            <p>Поштовани/а <strong>${name}</strong>,</p>
            <p>Са задовољством Вас обавештавамо да је Ваша резервација <strong>одобрена</strong>.</p>

            <div style="background: #f5f3f0; border-left: 4px solid #cdac91; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>📍 Објекат:</strong> ${facility}</p>
              <p style="margin: 0 0 8px 0;"><strong>🛏 Смештај:</strong> ${room}</p>
              <p style="margin: 0 0 8px 0;"><strong>📅 Долазак:</strong> ${fmt(checkIn)}</p>
              <p style="margin: 0 0 8px 0;"><strong>📅 Одлазак:</strong> ${fmt(checkOut)}</p>
              ${guestCount ? `<p style="margin: 0;"><strong>👥 Број особа:</strong> ${guestCount}</p>` : ''}
            </div>

            <div style="background: #fff3e0; border: 1px solid #ffcc80; padding: 15px; margin: 20px 0; border-radius: 0;">
              <p style="margin: 0 0 8px 0; font-weight: bold;">ℹ️ Отказивање резервације</p>
              <p style="margin: 0 0 8px 0; font-size: 0.9rem;">Резервацију можете отказати <strong>без накнаде</strong> до <strong>${cancelDeadline}</strong> (7 дана пре доласка).</p>
              <a href="${cancelUrl}" style="display: inline-block; background: #e74c3c; color: #fff; padding: 10px 20px; text-decoration: none; font-weight: bold; margin-top: 5px;">
                Откажи резервацију
              </a>
            </div>

            <p style="color: #888; font-size: 0.85rem; margin-top: 25px;">
              Dear ${name}, your reservation has been <strong>confirmed</strong>.<br>
              Facility: ${facility} | Room: ${room} | ${fmt(checkIn)} → ${fmt(checkOut)}<br>
              Free cancellation until: ${cancelDeadline} &nbsp;|&nbsp; <a href="${cancelUrl}">Cancel reservation</a>
            </p>
          </div>
          <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
            Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
          </div>
        </div>
      `
    };
  },

  // 3. Rezervacija odbijena
  rejected: ({ name }) => ({
    subject: 'Nastavna baza Goč — Одговор на Ваш упит',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #332317;">Поштовани/а ${name},</h2>
          <p style="line-height: 1.7;">Жао нам је, али за тражени период <strong>не можемо потврдити</strong> Вашу резервацију.</p>
          <p style="line-height: 1.7;">Позивамо Вас да проверите доступност у другом периоду или нас контактирате за додатне информације.</p>
          <a href="${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/smestaj" 
             style="display: inline-block; background: #332317; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; margin-top: 10px;">
            Погледај слободне смештаје
          </a>
          <hr style="border: none; border-top: 1px solid #e8e0d8; margin: 25px 0;">
          <p style="color: #888; font-size: 0.85rem;">
            Dear ${name}, unfortunately we are unable to confirm your reservation for the requested period.
            Please check availability for other dates. Thank you for your interest.
          </p>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  }),

  // 4. Otkazivanje potvrdjeno
  cancelConfirmed: ({ name, facility, room, checkIn, checkOut }) => ({
    subject: 'Nastavna baza Goč — Резервација отказана',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #607d8b;">Резервација отказана</h2>
          <p>Поштовани/а <strong>${name}</strong>,</p>
          <p>Потврђујемо да је Ваша резервација успешно отказана.</p>
          <div style="background: #f5f3f0; border-left: 4px solid #aaa; padding: 15px; margin: 15px 0;">
            <p style="margin: 0 0 5px 0;"><strong>Отказано:</strong> ${facility} — ${room}</p>
            <p style="margin: 0;"><strong>Период:</strong> ${fmt(checkIn)} → ${fmt(checkOut)}</p>
          </div>
          <p>Датуми су ослобођени и доступни за нове резервације.</p>
          <a href="${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/smestaj"
             style="display: inline-block; background: #332317; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; margin-top: 10px;">
            Нова резервација
          </a>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  }),

  // 5. Nalog kreiran - nova lozinka
  guestCreated: ({ name, email, password }) => ({
    subject: 'Nastavna baza Goč — Kreiran Vam je nalog',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #332317;">Добродошли, ${name}!</h2>
          <p>Аутоматски смо Вам креирали налог на основу Вашег упита.</p>
          <div style="background: #f5f3f0; border-left: 4px solid #cdac91; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>📧 Е-пошта:</strong> ${email}</p>
            <p style="margin: 0;"><strong>🔑 Привремена лозинка:</strong> <span style="font-size: 1.3rem; font-family: monospace; color: #332317;">${password}</span></p>
          </div>
          <p style="color: #e74c3c; font-size: 0.9rem;">Препоручујемо да промените лозинку при првом пријављивању.</p>
          <a href="${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/prijava"
             style="display: inline-block; background: #332317; color: #cdac91; padding: 13px 28px; text-decoration: none; font-weight: bold; margin-top: 10px; letter-spacing: 1px;">
            ПРИЈАВИТЕ СЕ →
          </a>
          <hr style="border: none; border-top: 1px solid #e8e0d8; margin: 25px 0;">
          <p style="color: #888; font-size: 0.85rem;">Dear ${name}, we have created an account for you.<br>Email: ${email} | Temporary password: <strong>${password}</strong><br>
          <a href="${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/prijava">Log in here</a></p>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  }),

  // 6. Nalog vec postoji
  guestExists: ({ name }) => ({
    subject: 'Nastavna baza Goč — Prijem Vašeg upita',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #332317;">Поштовани/а ${name},</h2>
          <p>Примили смо Ваш нови упит. Пратите статус путем Вашег налога.</p>
          <a href="${process.env.FRONTEND_URL || 'https://nastavnabazagoc.netlify.app'}/moj-nalog"
             style="display: inline-block; background: #332317; color: #cdac91; padding: 13px 28px; text-decoration: none; font-weight: bold; margin-top: 10px; letter-spacing: 1px;">
            МОЈ НАЛОГ →
          </a>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  }),

  // 7. Reset lozinke
  resetPassword: ({ name, resetUrl }) => ({
    subject: 'Nastavna baza Goč — Resetovanje lozinke',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #332317;">
        <div style="background: #332317; padding: 20px 30px;">
          <h1 style="color: #cdac91; margin: 0; font-size: 1.2rem; letter-spacing: 2px;">НАСТАВНА БАЗА ГОЧ</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e8e0d8;">
          <h2 style="color: #332317;">Поштовани/а ${name},</h2>
          <p>Примили смо захтев за ресетовање лозинке.</p>
          <p>Кликните на дугме испод да поставите нову лозинку. Линк важи <strong>1 сат</strong>.</p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #332317; color: #cdac91; padding: 13px 28px; text-decoration: none; font-weight: bold; margin-top: 10px; letter-spacing: 1px;">
            РЕСЕТУЈ ЛОЗИНКУ →
          </a>
          <p style="margin-top: 20px; color: #888; font-size: 0.85rem;">Ако нисте захтевали ресет, игноришите овај мејл.</p>
        </div>
        <div style="background: #f5f3f0; padding: 15px 30px; text-align: center; font-size: 0.8rem; color: #888;">
          Шумарски факултет Универзитета у Београду • nastavnabazagoc.netlify.app
        </div>
      </div>
    `
  })

};

module.exports = { sendEmail, templates };
