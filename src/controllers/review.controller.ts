import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const createReview = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const {
        task_id, overall_rating, quality_rating,
        punctuality_rating, communication_rating,
        value_rating, comment,
    } = req.body;

    try {
        // Get the task
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, accepted_tasker_id, status')
            .eq('id', task_id)
            .single();

        if (!task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        // Task must be completed
        if (task.status !== 'completed') {
            res.status(400).json({ error: 'La tâche doit être terminée pour laisser un avis' });
            return;
        }

        // Determine review direction
        let review_type: string;
        let reviewee_id: string;

        if (userId === task.client_id) {
            review_type = 'client_to_tasker';
            reviewee_id = task.accepted_tasker_id;
        } else if (userId === task.accepted_tasker_id) {
            review_type = 'tasker_to_client';
            reviewee_id = task.client_id;
        } else {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Insert review
        const { data: review, error } = await supabaseAdmin
            .from('reviews')
            .insert({
                task_id,
                reviewer_id: userId,
                reviewee_id,
                review_type,
                overall_rating,
                quality_rating: quality_rating || null,
                punctuality_rating: punctuality_rating || null,
                communication_rating: communication_rating || null,
                value_rating: value_rating || null,
                comment: comment || null,
            })
            .select()
            .single();

        if (error) {
            // Unique constraint violation (task_id + reviewer_id)
            if (error.code === '23505') {
                res.status(400).json({ error: 'Vous avez déjà laissé un avis pour cette tâche' });
                return;
            }
            logger.warn(`Review creation failed: ${error.message}`);
            res.status(400).json({ error: "Erreur lors de la soumission de l'avis" });
            return;
        }

        logger.info(`Review created: ${review.id} (${review_type}) by ${userId}`);
        res.status(201).json({ message: 'Avis soumis', review });
    } catch (err) {
        logger.error(`createReview error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getReviewsForUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const profileUserId = req.params.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Get total count
        const { count } = await supabaseAdmin
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('reviewee_id', profileUserId);

        // Get paginated reviews with joins
        const { data: reviews, error } = await supabaseAdmin
            .from('reviews')
            .select(`
        *,
        users!reviews_reviewer_id_fkey (
          full_name,
          avatar_url
        ),
        tasks (
          title,
          category_id,
          categories (
            name_fr,
            icon
          )
        )
      `)
            .eq('reviewee_id', profileUserId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.warn(`getReviewsForUser failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des avis' });
            return;
        }

        res.status(200).json({
            reviews: reviews || [],
            total: count || 0,
            page,
            limit,
        });
    } catch (err) {
        logger.error(`getReviewsForUser error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getReviewForTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const taskId = req.params.taskId;

    try {
        const { data: reviews, error } = await supabaseAdmin
            .from('reviews')
            .select('*')
            .eq('task_id', taskId);

        if (error) {
            logger.warn(`getReviewForTask failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des avis' });
            return;
        }

        res.status(200).json({ reviews: reviews || [] });
    } catch (err) {
        logger.error(`getReviewForTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
