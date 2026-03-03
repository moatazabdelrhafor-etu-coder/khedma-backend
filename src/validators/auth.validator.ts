import Joi from 'joi';

// Moroccan phone format: +212 followed by 9 digits
const phoneRegex = /^\+212\d{9}$/;

export const sendOtpSchema = Joi.object({
    phone: Joi.string()
        .pattern(phoneRegex)
        .required()
        .messages({
            'string.pattern.base': 'Le numéro doit être au format marocain (+212XXXXXXXXX)',
            'any.required': 'Le numéro de téléphone est requis',
        }),
});

export const verifyOtpSchema = Joi.object({
    phone: Joi.string()
        .pattern(phoneRegex)
        .required()
        .messages({
            'string.pattern.base': 'Le numéro doit être au format marocain (+212XXXXXXXXX)',
            'any.required': 'Le numéro de téléphone est requis',
        }),
    token: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.pattern.base': 'Le code doit contenir 6 chiffres',
            'any.required': 'Le code de vérification est requis',
        }),
});

export const registerSchema = Joi.object({
    full_name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Le nom doit contenir au moins 2 caractères',
            'string.max': 'Le nom doit contenir au maximum 100 caractères',
            'any.required': 'Le nom complet est requis',
        }),
    user_type: Joi.string()
        .valid('client', 'tasker')
        .required()
        .messages({
            'any.only': 'Le type doit être "client" ou "tasker"',
            'any.required': 'Le type d\'utilisateur est requis',
        }),
    city: Joi.string().optional().allow(''),
    neighborhood: Joi.string().optional().allow(''),
    language_pref: Joi.string()
        .valid('fr', 'ar')
        .default('fr')
        .optional()
        .messages({
            'any.only': 'La langue doit être "fr" ou "ar"',
        }),
});
