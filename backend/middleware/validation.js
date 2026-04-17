const validateRequest = (schema) => (req, res, next) => {
  // Simple validation for now - will upgrade to Joi later
  const { body } = req;
  const errors = [];

  // Basic validation
  Object.keys(schema).forEach(key => {
    if (schema[key].required && !body[key]) {
      errors.push(`${key} is required`);
    }
    if (schema[key].type === 'email' && body[key] && !/\S+@\S+\.\S+/.test(body[key])) {
      errors.push(`${key} must be a valid email`);
    }
    if (schema[key].min && body[key] && body[key].length < schema[key].min) {
      errors.push(`${key} must be at least ${schema[key].min} characters`);
    }
    if (schema[key].max && body[key] && body[key].length > schema[key].max) {
      errors.push(`${key} must be at most ${schema[key].max} characters`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  req.validated = body;
  next();
};

// Schemas (enhanced simple validation)
const schemas = {
  login: {
    username: { required: true, min: 3, max: 50 },
    password: { required: true, min: 6 }
  },
  guestLogin: {
    email: { required: true, type: 'email' },
    password: { required: true, min: 6 }
  },
  inquiry: {
    sender_name: { required: true, min: 2, max: 100 },
    email: { required: true, type: 'email' },
    phone: { max: 50 },
    message: { max: 1000 },
    target_room_id: { required: true },
    check_in: { required: true },
    check_out: { required: true }
  },
  news: {
    title: { required: true, min: 5, max: 200 },
    excerpt: { max: 500 },
    content: { required: true, min: 20 },
    cover_image: { max: 255 }
  },
  facility: {
    name_sr: { required: true, min: 3, max: 100 },
    name_en: { required: true, min: 3, max: 100 },
    description_sr: { required: true, min: 10 },
    description_en: { required: true, min: 10 },
    capacity: { required: true, min: 1, max: 100 },
    price_per_night: { required: true, min: 0 }
  },
  reservation: {
    inquiry_id: { required: true },
    status: { required: true }
  },
  inquiryStatus: {
    status: { required: true }
  },
  passwordReset: {
    email: { required: true, type: 'email' }
  },
  passwordChange: {
    current_password: { required: true },
    new_password: { required: true, min: 8 }
  }
};

module.exports = {
  validateRequest,
  schemas
};