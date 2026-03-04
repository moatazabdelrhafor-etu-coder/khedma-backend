import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { processAndUpload, deleteFile } from '../services/upload.service';
import { logger } from '../utils/logger';

export const uploadTaskPhoto = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    if (!req.file) {
        res.status(400).json({ error: 'Aucune photo fournie' });
        return;
    }

    try {
        const result = await processAndUpload(
            req.file.buffer,
            req.file.originalname,
            'task-photos',
            userId
        );

        res.status(200).json({
            message: 'Photo uploadée',
            url: result.url,
            path: result.path,
        });
    } catch (err) {
        logger.error(`uploadTaskPhoto error: ${err}`);
        res.status(500).json({ error: "Erreur lors de l'upload" });
    }
};

export const uploadPortfolioPhoto = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    if (!req.file) {
        res.status(400).json({ error: 'Aucune photo fournie' });
        return;
    }

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

        const result = await processAndUpload(
            req.file.buffer,
            req.file.originalname,
            'portfolio-photos',
            userId
        );

        // Insert into portfolio_items
        const { data: portfolioItem, error } = await supabaseAdmin
            .from('portfolio_items')
            .insert({
                tasker_id: userId,
                photo_url: result.url,
                caption: req.body.caption || null,
                category_id: req.body.category_id || null,
            })
            .select()
            .single();

        if (error) {
            logger.warn(`Portfolio item insert failed: ${error.message}`);
            res.status(400).json({ error: "Erreur lors de l'ajout au portfolio" });
            return;
        }

        res.status(201).json({
            message: 'Photo portfolio ajoutée',
            portfolio_item: portfolioItem,
        });
    } catch (err) {
        logger.error(`uploadPortfolioPhoto error: ${err}`);
        res.status(500).json({ error: "Erreur lors de l'upload" });
    }
};

export const uploadAvatar = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    if (!req.file) {
        res.status(400).json({ error: 'Aucune photo fournie' });
        return;
    }

    try {
        const result = await processAndUpload(
            req.file.buffer,
            req.file.originalname,
            'avatars',
            userId,
            { maxWidth: 400, maxHeight: 400, quality: 85 }
        );

        // Update user's avatar_url
        await supabaseAdmin
            .from('users')
            .update({ avatar_url: result.url })
            .eq('id', userId);

        res.status(200).json({
            message: 'Photo de profil mise à jour',
            url: result.url,
        });
    } catch (err) {
        logger.error(`uploadAvatar error: ${err}`);
        res.status(500).json({ error: "Erreur lors de l'upload" });
    }
};

export const uploadKycDocument = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    if (!req.file) {
        res.status(400).json({ error: 'Aucun document fourni' });
        return;
    }

    const documentType = req.body.document_type;
    if (!['cin_front', 'cin_back', 'selfie'].includes(documentType)) {
        res.status(400).json({
            error: 'Type de document invalide. Doit être cin_front, cin_back ou selfie',
        });
        return;
    }

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

        const result = await processAndUpload(
            req.file.buffer,
            req.file.originalname,
            'kyc-documents',
            userId,
            { quality: 90 }
        );

        // Map document_type to column name
        const columnMap: Record<string, string> = {
            cin_front: 'cin_front_url',
            cin_back: 'cin_back_url',
            selfie: 'selfie_url',
        };

        await supabaseAdmin
            .from('tasker_profiles')
            .update({ [columnMap[documentType]]: result.url })
            .eq('user_id', userId);

        res.status(200).json({
            message: 'Document uploadé',
            url: result.url,
        });
    } catch (err) {
        logger.error(`uploadKycDocument error: ${err}`);
        res.status(500).json({ error: "Erreur lors de l'upload" });
    }
};

export const uploadDiploma = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    if (!req.file) {
        res.status(400).json({ error: 'Aucun document fourni' });
        return;
    }

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

        const result = await processAndUpload(
            req.file.buffer,
            req.file.originalname,
            'diplomas',
            userId,
            { quality: 90 }
        );

        await supabaseAdmin
            .from('tasker_profiles')
            .update({ diploma_url: result.url })
            .eq('user_id', userId);

        res.status(200).json({
            message: 'Diplôme uploadé',
            url: result.url,
        });
    } catch (err) {
        logger.error(`uploadDiploma error: ${err}`);
        res.status(500).json({ error: "Erreur lors de l'upload" });
    }
};

export const deletePortfolioPhoto = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const itemId = req.params.id;

    try {
        // Get the portfolio item
        const { data: item } = await supabaseAdmin
            .from('portfolio_items')
            .select('id, tasker_id, photo_url')
            .eq('id', itemId)
            .single();

        if (!item) {
            res.status(404).json({ error: 'Photo non trouvée' });
            return;
        }

        // Verify ownership
        if (item.tasker_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Extract file path from URL and delete from storage
        const url = new URL(item.photo_url);
        const pathParts = url.pathname.split('/storage/v1/object/public/portfolio-photos/');
        if (pathParts.length > 1) {
            await deleteFile('portfolio-photos', decodeURIComponent(pathParts[1]));
        }

        // Delete from database
        const { error } = await supabaseAdmin
            .from('portfolio_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            logger.warn(`Delete portfolio item failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la suppression' });
            return;
        }

        res.status(200).json({ message: 'Photo supprimée' });
    } catch (err) {
        logger.error(`deletePortfolioPhoto error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
