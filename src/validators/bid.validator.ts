import Joi from 'joi';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createBidSchema = Joi.object({
    task_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'any.required': 'L\'ID de la tâche est requis',
            'string.pattern.base': 'ID de tâche invalide',
        }),
    amount: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            'any.required': 'Le montant est requis',
            'number.min': 'Le montant doit être au moins 1 DH',
            'number.integer': 'Le montant doit être un nombre entier',
        }),
    message: Joi.string()
        .max(500)
        .optional()
        .allow('', null)
        .messages({
            'string.max': 'Le message ne peut pas dépasser 500 caractères',
        }),
    estimated_hours: Joi.number()
        .min(0.5)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'La durée estimée doit être d\'au moins 0.5 heure',
            'number.max': 'La durée estimée ne peut pas dépasser 100 heures',
        }),
});

export const listBidsSchema = Joi.object({
    sort: Joi.string()
        .valid('price_asc', 'price_desc', 'rating_desc', 'newest')
        .default('newest')
        .optional()
        .messages({
            'any.only': 'Le tri doit être price_asc, price_desc, rating_desc ou newest',
        }),
});
