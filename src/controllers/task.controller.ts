import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const createTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const {
        category_id, subcategory_id, title, description,
        city, neighborhood, address, preferred_date,
        preferred_time, budget_min, budget_max, urgency,
    } = req.body;

    try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 72);

        const { data: task, error } = await supabaseAdmin
            .from('tasks')
            .insert({
                client_id: userId,
                category_id,
                subcategory_id: subcategory_id || null,
                title,
                description,
                city,
                neighborhood: neighborhood || null,
                address: address || null,
                preferred_date: preferred_date || null,
                preferred_time: preferred_time || null,
                budget_min: budget_min || null,
                budget_max: budget_max || null,
                urgency: urgency || 'normal',
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single();

        if (error) {
            logger.warn(`Task creation failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la création de la tâche' });
            return;
        }

        logger.info(`Task created: ${task.id} by user ${userId}`);
        res.status(201).json({ message: 'Tâche créée', task });
    } catch (err) {
        logger.error(`createTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getMyTasks = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Get total count
        const { count } = await supabaseAdmin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', userId);

        // Get paginated tasks with category info
        const { data: tasks, error } = await supabaseAdmin
            .from('tasks')
            .select(`
        *,
        categories (
          name_fr,
          icon
        )
      `)
            .eq('client_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.warn(`getMyTasks failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des tâches' });
            return;
        }

        res.status(200).json({
            tasks: tasks || [],
            total: count || 0,
            page,
            limit,
        });
    } catch (err) {
        logger.error(`getMyTasks error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getOpenTasks = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const { city, category_id, urgency } = req.query;

    try {
        // Build query for count
        let countQuery = supabaseAdmin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .in('status', ['open', 'bidding']);

        if (city) countQuery = countQuery.eq('city', city as string);
        if (category_id) countQuery = countQuery.eq('category_id', category_id as string);
        if (urgency) countQuery = countQuery.eq('urgency', urgency as string);

        const { count } = await countQuery;

        // Build query for data
        let dataQuery = supabaseAdmin
            .from('tasks')
            .select(`
        id, title, description, city, neighborhood,
        preferred_date, preferred_time,
        budget_min, budget_max, urgency, status,
        bid_count, created_at, expires_at,
        categories (
          name_fr,
          icon
        ),
        task_photos (
          photo_url
        )
      `)
            .in('status', ['open', 'bidding'])
            .order('urgency', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (city) dataQuery = dataQuery.eq('city', city as string);
        if (category_id) dataQuery = dataQuery.eq('category_id', category_id as string);
        if (urgency) dataQuery = dataQuery.eq('urgency', urgency as string);

        const { data: tasks, error } = await dataQuery;

        if (error) {
            logger.warn(`getOpenTasks failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des tâches' });
            return;
        }

        // Include only the first photo for each task
        const tasksWithPhoto = (tasks || []).map((task: any) => ({
            ...task,
            first_photo: task.task_photos?.[0]?.photo_url || null,
            task_photos: undefined,
        }));

        res.status(200).json({
            tasks: tasksWithPhoto,
            total: count || 0,
            page,
            limit,
        });
    } catch (err) {
        logger.error(`getOpenTasks error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getTaskById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const taskId = req.params.id;

    try {
        const { data: task, error } = await supabaseAdmin
            .from('tasks')
            .select(`
        *,
        categories (
          id, slug, name_fr, icon
        ),
        subcategories (
          id, slug, name_fr
        ),
        task_photos (
          id, photo_url, display_order
        )
      `)
            .eq('id', taskId)
            .single();

        if (error || !task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        // If the user is not the task owner (client), hide the address
        if (task.client_id !== userId) {
            task.address = undefined;
        }

        res.status(200).json({ task });
    } catch (err) {
        logger.error(`getTaskById error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const cancelTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const taskId = req.params.id;
    const { reason } = req.body;

    try {
        // Fetch the task
        const { data: task, error: fetchError } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, status')
            .eq('id', taskId)
            .single();

        if (fetchError || !task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        // Verify ownership
        if (task.client_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Verify status allows cancellation
        if (!['open', 'bidding'].includes(task.status)) {
            res.status(400).json({
                error: 'Cette tâche ne peut pas être annulée dans son état actuel',
            });
            return;
        }

        // Cancel the task
        const { error: updateError } = await supabaseAdmin
            .from('tasks')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancel_reason: reason || null,
            })
            .eq('id', taskId);

        if (updateError) {
            logger.warn(`Task cancel failed: ${updateError.message}`);
            res.status(400).json({ error: "Erreur lors de l'annulation" });
            return;
        }

        // Expire all pending bids
        await supabaseAdmin
            .from('bids')
            .update({ status: 'expired' })
            .eq('task_id', taskId)
            .eq('status', 'pending');

        logger.info(`Task cancelled: ${taskId} by user ${userId}`);
        res.status(200).json({ message: 'Tâche annulée' });
    } catch (err) {
        logger.error(`cancelTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
