import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            messages: {
                'any.required': '{{#label}} est requis',
                'string.empty': '{{#label}} ne peut pas être vide',
                'string.min': '{{#label}} doit contenir au moins {{#limit}} caractères',
                'string.max': '{{#label}} doit contenir au maximum {{#limit}} caractères',
                'number.min': '{{#label}} doit être au moins {{#limit}}',
                'number.max': '{{#label}} doit être au maximum {{#limit}}',
                'string.email': '{{#label}} doit être un email valide',
            },
        });

        if (error) {
            const message = error.details
                .map((detail) => detail.message)
                .join(', ');

            res.status(400).json({ error: message });
            return;
        }

        next();
    };
};
