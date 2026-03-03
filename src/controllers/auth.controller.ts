import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
    const { phone } = req.body;

    try {
        const { error } = await supabaseAdmin.auth.signInWithOtp({ phone });

        if (error) {
            logger.warn(`OTP send failed for ${phone}: ${error.message}`);
            res.status(400).json({ error: "Erreur d'envoi du code" });
            return;
        }

        logger.info(`OTP sent to ${phone}`);
        res.status(200).json({ message: 'Code envoyé' });
    } catch (err) {
        logger.error(`sendOtp error: ${err}`);
        res.status(400).json({ error: "Erreur d'envoi du code" });
    }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const { phone, token } = req.body;

    try {
        const { data, error } = await supabaseAdmin.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });

        if (error) {
            logger.warn(`OTP verify failed for ${phone}: ${error.message}`);
            res.status(400).json({ error: 'Code invalide ou expiré' });
            return;
        }

        logger.info(`OTP verified for ${phone}`);
        res.status(200).json({
            message: 'Vérifié',
            session: data.session,
            user: data.user,
        });
    } catch (err) {
        logger.error(`verifyOtp error: ${err}`);
        res.status(400).json({ error: 'Code invalide ou expiré' });
    }
};

export const register = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const { full_name, user_type, city, neighborhood, language_pref } = req.body;
    const userId = req.user!.id;
    const phone = req.user!.phone!;

    try {
        // Insert into users table
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                phone,
                full_name,
                user_type,
                city: city || null,
                neighborhood: neighborhood || null,
                language_pref: language_pref || 'fr',
            })
            .select()
            .single();

        if (userError) {
            logger.warn(`Registration failed for ${phone}: ${userError.message}`);
            res.status(400).json({ error: "Erreur d'inscription" });
            return;
        }

        // If tasker, also create a tasker_profiles row
        if (user_type === 'tasker') {
            const { error: profileError } = await supabaseAdmin
                .from('tasker_profiles')
                .insert({
                    user_id: userId,
                    city: city || '',
                    whatsapp_number: phone,
                    categories: [],
                });

            if (profileError) {
                logger.warn(`Tasker profile creation failed: ${profileError.message}`);
                // User was created but profile failed — log but don't fail the request
            }
        }

        logger.info(`User registered: ${userId} (${user_type})`);
        res.status(201).json({
            message: 'Inscription réussie',
            user,
        });
    } catch (err) {
        logger.error(`register error: ${err}`);
        res.status(400).json({ error: "Erreur d'inscription" });
    }
};
