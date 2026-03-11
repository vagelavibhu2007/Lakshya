const Joi = require('joi');

// Strong password: 8+ chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
const strongPassword = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-~`|{}\[\]:;"'<>,.\/\\])/, 'strong password')
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.name': 'Password must contain at least one uppercase, one lowercase, one number, and one special character',
  });

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: strongPassword.required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: strongPassword.required(),
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).pattern(/^[^\d]+$/, 'no numbers').required()
    .messages({ 'string.pattern.name': 'Name must not contain numbers' }),
  email: Joi.string().email().required(),
  password: strongPassword.required(),
  role: Joi.string().valid('admin', 'teamleader', 'faculty', 'member', 'campus_ambassador').required(),
  teamId: Joi.string().hex().length(24).allow(null, '').optional(),
  secondaryTeamIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  phone: Joi.string().pattern(/^\d{10}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'Phone must be exactly 10 digits' }),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).pattern(/^[^\d]+$/, 'no numbers').optional()
    .messages({ 'string.pattern.name': 'Name must not contain numbers' }),
  role: Joi.string().valid('admin', 'teamleader', 'faculty', 'member', 'campus_ambassador').optional(),
  teamId: Joi.string().hex().length(24).allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
  secondaryTeamIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  phone: Joi.string().pattern(/^\d{10}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'Phone must be exactly 10 digits' }),
});

const taskSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(2000).allow('').optional(),
  teamId: Joi.string().allow('', null).optional(),
  assignees: Joi.array().items(Joi.string().hex().length(24)).optional(),
  deadline: Joi.date().iso().allow(null).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  basePoints: Joi.number().min(0).max(10000).optional(),
  status: Joi.string().valid('open', 'submitted', 'verified', 'rejected', 'closed').optional(),
});

const submissionSchema = Joi.object({
  proofType: Joi.string().valid('file', 'link', 'text').required(),
  proofValue: Joi.string().required(),
  note: Joi.string().max(1000).allow('').optional(),
});

const verifySubmissionSchema = Joi.object({
  awardedPoints: Joi.number().min(0).required(),
  status: Joi.string().valid('verified', 'rejected').required(),
  rejectionReason: Joi.string().allow('').optional(),
});

const announcementSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  body: Joi.string().min(1).required(),
  scope: Joi.string().valid('global', 'team', 'role').optional(),
  teamId: Joi.string().allow('', null).optional(),
  targetRoles: Joi.array().items(Joi.string()).optional(),
  pinned: Joi.boolean().optional(),
  sendEmail: Joi.boolean().optional(),
  expiresAt: Joi.date().iso().allow('', null).optional(),
});

const resourceSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(1000).allow('').optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  type: Joi.string().valid('file', 'link', 'text').required(),
  value: Joi.string().required(),
  scope: Joi.string().valid('global', 'team', 'role').optional(),
  teamId: Joi.string().allow('', null).optional(),
  targetRoles: Joi.array().items(Joi.string()).optional(),
  isCAResource: Joi.boolean().optional(),
  category: Joi.string().allow('').optional(),
  accessCode: Joi.string().max(100).allow(null, '').optional(),
});

const eventSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('competition', 'workshop', 'talk', 'cultural', 'fun', 'other').optional(),
  description: Joi.string().max(2000).allow('').optional(),
  date: Joi.date().iso().required(),
  venue: Joi.string().max(300).allow('').optional(),
  capacity: Joi.number().min(1).allow(null).optional(),
  maxParticipants: Joi.number().min(1).allow(null).optional(),
  status: Joi.string().valid('upcoming', 'ongoing', 'completed', 'cancelled').optional(),
  teamId: Joi.string().hex().length(24).allow(null, '').optional(),
  isFlagship: Joi.boolean().optional(),
  documents: Joi.array().items(Joi.object({
    title: Joi.string().required(),
    url: Joi.string().required()
  })).optional(),
});

const teamSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('').optional(),
  teamLeads: Joi.array().items(Joi.string().hex().length(24)).optional(),
  color: Joi.string().max(20).optional(),
}).options({ stripUnknown: true });

const pointsOverrideSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  points: Joi.number().required(),
  reason: Joi.string().min(5).max(500).required(),
  taskId: Joi.string().hex().length(24).allow(null, '').optional(),
});

const todoSchema = Joi.object({
  text: Joi.string().min(1).max(500).required(),
  completed: Joi.boolean().optional(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((d) => d.message).join('; '),
    });
  }
  next();
};

module.exports = {
  validate,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  taskSchema,
  submissionSchema,
  verifySubmissionSchema,
  announcementSchema,
  resourceSchema,
  eventSchema,
  teamSchema,
  pointsOverrideSchema,
  todoSchema,
};