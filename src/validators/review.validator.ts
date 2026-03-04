import Joi from 'joi';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ratingField = (label: string) =>
    Joi.number().integer().min(1).max(5).optional().allow(null).messages({
        'number.min': `${label} doit être entre 1 et 5`,
        'number.max': `${label} doit être entre 1 et 5`,
    });

export const createReviewSchema = Joi.object({
    task_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'any.required': 'L\'ID de la tâche est requis',
            'string.pattern.base': 'ID de tâche invalide',
        }),
    overall_rating: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'any.required': 'La note globale est requise',
            'number.min': 'La note doit être entre 1 et 5',
            'number.max': 'La note doit être entre 1 et 5',
        }),
    quality_rating: ratingField('La note qualité'),
    punctuality_rating: ratingField('La note ponctualité'),
    communication_rating: ratingField('La note communication'),
    value_rating: ratingField('La note rapport qualité/prix'),
    comment: Joi.string().max(1000).optional().allow('', null).messages({
        'string.max': 'Le commentaire ne peut pas dépasser 1000 caractères',
    }),
});
