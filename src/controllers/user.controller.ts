import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getMe = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            res.status(404).json({ error: 'Utilisateur non trouvé' });
            return;
        }

        let taskerProfile = null;
        if (user.user_type === 'tasker') {
            const { data: profile } = await supabaseAdmin
                .from('tasker_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            taskerProfile = profile;
        }

        res.status(200).json({ user, tasker_profile: taskerProfile });
    } catch (err) {
        logger.error(`getMe error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const updateMe = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const { full_name, city, neighborhood, language_pref, avatar_url } = req.body;

    try {
        const updateData: Record<string, unknown> = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (city !== undefined) updateData.city = city || null;
        if (neighborhood !== undefined) updateData.neighborhood = neighborhood || null;
        if (language_pref !== undefined) updateData.language_pref = language_pref;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url || null;

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            logger.warn(`updateMe failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la mise à jour' });
            return;
        }

        res.status(200).json({ message: 'Profil mis à jour', user });
    } catch (err) {
        logger.error(`updateMe error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getPublicProfile = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const profileId = req.params.id;

    try {
        // Get basic user info (no sensitive data)
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, full_name, avatar_url, user_type, city, created_at')
            .eq('id', profileId)
            .single();

        if (error || !user) {
            res.status(404).json({ error: 'Utilisateur non trouvé' });
            return;
        }

        let taskerProfile = null;
        let portfolio: unknown[] = [];

        if (user.user_type === 'tasker') {
            // Get tasker profile (public fields only)
            const { data: profile } = await supabaseAdmin
                .from('tasker_profiles')
                .select(`
          bio, categories, min_rate, max_rate,
          avg_rating, total_ratings, total_completed,
          kyc_status, has_diploma, diploma_type, diploma_verified,
          is_premium, member_since
        `)
                .eq('user_id', profileId)
                .single();

            taskerProfile = profile;

            // Get portfolio items
            const { data: portfolioItems } = await supabaseAdmin
                .from('portfolio_items')
                .select('id, photo_url, caption, category_id, display_order, created_at')
                .eq('tasker_id', profileId)
                .order('display_order', { ascending: true });

            portfolio = portfolioItems || [];
        }

        res.status(200).json({
            user,
            tasker_profile: taskerProfile,
            portfolio,
        });
    } catch (err) {
        logger.error(`getPublicProfile error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const updateTaskerProfile = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        // Verify user is a tasker
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('user_type')
            .eq('id', userId)
            .single();

        if (!user || user.user_type !== 'tasker') {
            res.status(403).json({ error: 'Réservé aux taskers' });
            return;
        }

        const {
            bio, categories, subcategories, city,
            neighborhoods, min_rate, max_rate, whatsapp_number,
        } = req.body;

        const updateData: Record<string, unknown> = {};
        if (bio !== undefined) updateData.bio = bio || null;
        if (categories !== undefined) updateData.categories = categories;
        if (subcategories !== undefined) updateData.subcategories = subcategories;
        if (city !== undefined) updateData.city = city;
        if (neighborhoods !== undefined) updateData.neighborhoods = neighborhoods;
        if (min_rate !== undefined) updateData.min_rate = min_rate;
        if (max_rate !== undefined) updateData.max_rate = max_rate;
        if (whatsapp_number !== undefined) updateData.whatsapp_number = whatsapp_number;

        const { data: profile, error } = await supabaseAdmin
            .from('tasker_profiles')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            logger.warn(`updateTaskerProfile failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la mise à jour du profil' });
            return;
        }

        res.status(200).json({ message: 'Profil tasker mis à jour', profile });
    } catch (err) {
        logger.error(`updateTaskerProfile error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const submitKyc = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        // Verify user is a tasker
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('user_type')
            .eq('id', userId)
            .single();

        if (!user || user.user_type !== 'tasker') {
            res.status(403).json({ error: 'Réservé aux taskers' });
            return;
        }

        const { cin_number, cin_front_url, cin_back_url, selfie_url } = req.body;

        const { error } = await supabaseAdmin
            .from('tasker_profiles')
            .update({
                cin_number,
                cin_front_url,
                cin_back_url,
                selfie_url,
                kyc_status: 'submitted',
                kyc_submitted_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        if (error) {
            logger.warn(`submitKyc failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la soumission KYC' });
            return;
        }

        logger.info(`KYC submitted by tasker ${userId}`);
        res.status(200).json({ message: 'Documents KYC soumis, en attente de vérification' });
    } catch (err) {
        logger.error(`submitKyc error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const submitDiploma = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        // Verify user is a tasker
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('user_type')
            .eq('id', userId)
            .single();

        if (!user || user.user_type !== 'tasker') {
            res.status(403).json({ error: 'Réservé aux taskers' });
            return;
        }

        const { diploma_type, diploma_url } = req.body;

        const { error } = await supabaseAdmin
            .from('tasker_profiles')
            .update({
                diploma_type,
                diploma_url,
                has_diploma: true,
                diploma_verified: false,
            })
            .eq('user_id', userId);

        if (error) {
            logger.warn(`submitDiploma failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la soumission du diplôme' });
            return;
        }

        logger.info(`Diploma submitted by tasker ${userId}`);
        res.status(200).json({ message: 'Diplôme soumis, en attente de vérification' });
    } catch (err) {
        logger.error(`submitDiploma error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
