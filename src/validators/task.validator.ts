import Joi from 'joi';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createTaskSchema = Joi.object({
    category_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'any.required': 'La catégorie est requise',
            'string.pattern.base': 'ID de catégorie invalide',
        }),
    subcategory_id: Joi.string()
        .pattern(uuidPattern)
        .optional()
        .allow(null)
        .messages({
            'string.pattern.base': 'ID de sous-catégorie invalide',
        }),
    title: Joi.string()
        .min(5)
        .max(150)
        .required()
        .messages({
            'string.min': 'Le titre doit contenir au moins 5 caractères',
            'string.max': 'Le titre doit contenir au maximum 150 caractères',
            'any.required': 'Le titre est requis',
        }),
    description: Joi.string()
        .min(10)
        .max(2000)
        .required()
        .messages({
            'string.min': 'La description doit contenir au moins 10 caractères',
            'string.max': 'La description doit contenir au maximum 2000 caractères',
            'any.required': 'La description est requise',
        }),
    city: Joi.string()
        .required()
        .messages({
            'any.required': 'La ville est requise',
        }),
    neighborhood: Joi.string().optional().allow('', null),
    address: Joi.string().optional().allow('', null),
    preferred_date: Joi.string().isoDate().optional().allow(null).messages({
        'string.isoDate': 'La date doit être au format ISO (AAAA-MM-JJ)',
    }),
    preferred_time: Joi.string()
        .valid('morning', 'afternoon', 'evening', 'flexible')
        .optional()
        .allow(null)
        .messages({
            'any.only': 'L\'horaire doit être morning, afternoon, evening ou flexible',
        }),
    budget_min: Joi.number().integer().min(0).optional().allow(null).messages({
        'number.min': 'Le budget minimum doit être positif',
    }),
    budget_max: Joi.number()
        .integer()
        .min(0)
        .optional()
        .allow(null)
        .when('budget_min', {
            is: Joi.exist(),
            then: Joi.number().min(Joi.ref('budget_min')).messages({
                'number.min': 'Le budget maximum doit être supérieur ou égal au budget minimum',
            }),
        })
        .messages({
            'number.min': 'Le budget maximum doit être positif',
        }),
    urgency: Joi.string()
        .valid('normal', 'urgent')
        .default('normal')
        .optional()
        .messages({
            'any.only': 'L\'urgence doit être "normal" ou "urgent"',
        }),
});

export const updateTaskSchema = Joi.object({
    category_id: Joi.string().pattern(uuidPattern).optional(),
    subcategory_id: Joi.string().pattern(uuidPattern).optional().allow(null),
    title: Joi.string().min(5).max(150).optional(),
    description: Joi.string().min(10).max(2000).optional(),
    city: Joi.string().optional(),
    neighborhood: Joi.string().optional().allow('', null),
    address: Joi.string().optional().allow('', null),
    preferred_date: Joi.string().isoDate().optional().allow(null),
    preferred_time: Joi.string()
        .valid('morning', 'afternoon', 'evening', 'flexible')
        .optional()
        .allow(null),
    budget_min: Joi.number().integer().min(0).optional().allow(null),
    budget_max: Joi.number().integer().min(0).optional().allow(null),
    urgency: Joi.string().valid('normal', 'urgent').optional(),
}).min(1).messages({
    'object.min': 'Au moins un champ à modifier est requis',
});

export const listTasksSchema = Joi.object({
    city: Joi.string().optional(),
    category_id: Joi.string().pattern(uuidPattern).optional(),
    status: Joi.string().optional(),
    urgency: Joi.string().valid('normal', 'urgent').optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(50).default(20).optional(),
});
