import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createNotification } from '../services/notification.service';

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
        const { count } = await supabaseAdmin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', userId);

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
        let countQuery = supabaseAdmin
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .in('status', ['open', 'bidding']);

        if (city) countQuery = countQuery.eq('city', city as string);
        if (category_id) countQuery = countQuery.eq('category_id', category_id as string);
        if (urgency) countQuery = countQuery.eq('urgency', urgency as string);

        const { count } = await countQuery;

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
        const { data: task, error: fetchError } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, status')
            .eq('id', taskId)
            .single();

        if (fetchError || !task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        if (task.client_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        if (!['open', 'bidding'].includes(task.status)) {
            res.status(400).json({
                error: 'Cette tâche ne peut pas être annulée dans son état actuel',
            });
            return;
        }

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

export const startTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const taskId = req.params.id;

    try {
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, accepted_tasker_id, status')
            .eq('id', taskId)
            .single();

        if (!task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        if (task.status !== 'assigned') {
            res.status(400).json({ error: 'La tâche doit être assignée pour être commencée' });
            return;
        }

        if (task.accepted_tasker_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        const { error } = await supabaseAdmin
            .from('tasks')
            .update({ status: 'in_progress' })
            .eq('id', taskId);

        if (error) {
            logger.warn(`Start task failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors du démarrage' });
            return;
        }

        // Notify client
        await createNotification(
            task.client_id,
            'task_started',
            'Tâche commencée',
            'Le tasker a commencé votre tâche',
            { task_id: taskId }
        );

        logger.info(`Task started: ${taskId} by tasker ${userId}`);
        res.status(200).json({ message: 'Tâche commencée' });
    } catch (err) {
        logger.error(`startTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const completeTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const taskId = req.params.id;
    const { final_amount, payment_method } = req.body;

    try {
        // Get the task
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, accepted_tasker_id, accepted_bid_id, status')
            .eq('id', taskId)
            .single();

        if (!task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        if (!['assigned', 'in_progress'].includes(task.status)) {
            res.status(400).json({ error: 'Cette tâche ne peut pas être complétée dans son état actuel' });
            return;
        }

        // Determine who is confirming
        let confirmField: string;
        if (userId === task.client_id) {
            confirmField = 'client_confirmed';
        } else if (userId === task.accepted_tasker_id) {
            confirmField = 'tasker_confirmed';
        } else {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Get the accepted bid amount
        const { data: bid } = await supabaseAdmin
            .from('bids')
            .select('amount')
            .eq('id', task.accepted_bid_id)
            .single();

        // Check existing transaction
        const { data: existingTx } = await supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('task_id', taskId)
            .single();

        let transaction;

        if (existingTx) {
            // Update existing transaction
            const updateData: Record<string, unknown> = {
                [confirmField]: true,
            };
            if (final_amount !== undefined) updateData.final_amount = final_amount;
            if (payment_method) updateData.payment_method = payment_method;

            const { data: updatedTx, error } = await supabaseAdmin
                .from('transactions')
                .update(updateData)
                .eq('id', existingTx.id)
                .select()
                .single();

            if (error) {
                logger.warn(`Transaction update failed: ${error.message}`);
                res.status(400).json({ error: 'Erreur lors de la confirmation' });
                return;
            }
            transaction = updatedTx;
        } else {
            // Create new transaction
            const { data: newTx, error } = await supabaseAdmin
                .from('transactions')
                .insert({
                    task_id: taskId,
                    bid_id: task.accepted_bid_id,
                    tasker_id: task.accepted_tasker_id,
                    client_id: task.client_id,
                    agreed_amount: bid?.amount || 0,
                    final_amount: final_amount || null,
                    payment_method: payment_method || null,
                    [confirmField]: true,
                })
                .select()
                .single();

            if (error) {
                logger.warn(`Transaction creation failed: ${error.message}`);
                res.status(400).json({ error: 'Erreur lors de la confirmation' });
                return;
            }
            transaction = newTx;
        }

        // Check if both parties have confirmed
        const bothConfirmed = transaction.client_confirmed && transaction.tasker_confirmed;

        if (bothConfirmed) {
            // Mark task as completed
            await supabaseAdmin
                .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', taskId);

            // Increment tasker's total_completed
            const { data: profile } = await supabaseAdmin
                .from('tasker_profiles')
                .select('total_completed')
                .eq('user_id', task.accepted_tasker_id)
                .single();

            if (profile) {
                await supabaseAdmin
                    .from('tasker_profiles')
                    .update({ total_completed: (profile.total_completed || 0) + 1 })
                    .eq('user_id', task.accepted_tasker_id);
            }

            // Notify both parties
            await createNotification(
                task.client_id,
                'task_completed',
                'Tâche terminée',
                'La tâche a été confirmée comme terminée par les deux parties',
                { task_id: taskId }
            );

            await createNotification(
                task.accepted_tasker_id,
                'task_completed',
                'Tâche terminée',
                'La tâche a été confirmée comme terminée par les deux parties',
                { task_id: taskId }
            );

            logger.info(`Task completed: ${taskId} (both confirmed)`);
        }

        res.status(200).json({
            message: 'Confirmation enregistrée',
            completed: bothConfirmed,
        });
    } catch (err) {
        logger.error(`completeTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
