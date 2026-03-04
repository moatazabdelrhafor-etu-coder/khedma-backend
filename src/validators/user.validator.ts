import Joi from 'joi';

const phoneRegex = /^\+212\d{9}$/;

export const updateUserSchema = Joi.object({
    full_name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Le nom doit contenir au moins 2 caractères',
        'string.max': 'Le nom doit contenir au maximum 100 caractères',
    }),
    city: Joi.string().optional().allow('', null),
    neighborhood: Joi.string().optional().allow('', null),
    language_pref: Joi.string().valid('fr', 'ar').optional().messages({
        'any.only': 'La langue doit être "fr" ou "ar"',
    }),
    avatar_url: Joi.string().optional().allow('', null),
}).min(1).messages({
    'object.min': 'Au moins un champ à modifier est requis',
});

export const updateTaskerProfileSchema = Joi.object({
    bio: Joi.string().max(1000).optional().allow('', null).messages({
        'string.max': 'La bio ne peut pas dépasser 1000 caractères',
    }),
    categories: Joi.array().items(Joi.string()).min(1).optional().messages({
        'array.min': 'Au moins une catégorie est requise',
    }),
    subcategories: Joi.array().items(Joi.string()).optional(),
    city: Joi.string().optional(),
    neighborhoods: Joi.array().items(Joi.string()).optional(),
    min_rate: Joi.number().integer().min(0).optional().allow(null).messages({
        'number.min': 'Le tarif minimum doit être positif',
    }),
    max_rate: Joi.number()
        .integer()
        .min(0)
        .optional()
        .allow(null)
        .when('min_rate', {
            is: Joi.exist(),
            then: Joi.number().min(Joi.ref('min_rate')).messages({
                'number.min': 'Le tarif maximum doit être supérieur ou égal au tarif minimum',
            }),
        })
        .messages({
            'number.min': 'Le tarif maximum doit être positif',
        }),
    whatsapp_number: Joi.string().pattern(phoneRegex).optional().messages({
        'string.pattern.base': 'Le numéro WhatsApp doit être au format marocain (+212XXXXXXXXX)',
    }),
}).min(1).messages({
    'object.min': 'Au moins un champ à modifier est requis',
});

export const submitKycSchema = Joi.object({
    cin_number: Joi.string().min(4).max(20).required().messages({
        'any.required': 'Le numéro CIN est requis',
        'string.min': 'Le numéro CIN doit contenir au moins 4 caractères',
        'string.max': 'Le numéro CIN doit contenir au maximum 20 caractères',
    }),
    cin_front_url: Joi.string().uri().required().messages({
        'any.required': 'La photo recto du CIN est requise',
        'string.uri': 'URL de la photo recto invalide',
    }),
    cin_back_url: Joi.string().uri().required().messages({
        'any.required': 'La photo verso du CIN est requise',
        'string.uri': 'URL de la photo verso invalide',
    }),
    selfie_url: Joi.string().uri().required().messages({
        'any.required': 'Le selfie est requis',
        'string.uri': 'URL du selfie invalide',
    }),
});

export const submitDiplomaSchema = Joi.object({
    diploma_type: Joi.string().max(100).required().messages({
        'any.required': 'Le type de diplôme est requis',
        'string.max': 'Le type de diplôme ne peut pas dépasser 100 caractères',
    }),
    diploma_url: Joi.string().uri().required().messages({
        'any.required': 'Le document du diplôme est requis',
        'string.uri': 'URL du diplôme invalide',
    }),
});
