import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const createBid = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const { task_id, amount, message, estimated_hours } = req.body;

    try {
        // Verify user is a tasker
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('user_type')
            .eq('id', userId)
            .single();

        if (!user || user.user_type !== 'tasker') {
            res.status(403).json({ error: 'Seuls les taskers peuvent enchérir' });
            return;
        }

        // Verify task exists and accepts bids
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, status')
            .eq('id', task_id)
            .single();

        if (!task || !['open', 'bidding'].includes(task.status)) {
            res.status(400).json({ error: "Cette tâche n'accepte plus d'enchères" });
            return;
        }

        // Can't bid on own task
        if (task.client_id === userId) {
            res.status(400).json({ error: 'Vous ne pouvez pas enchérir sur votre propre tâche' });
            return;
        }

        // Insert bid
        const { data: bid, error } = await supabaseAdmin
            .from('bids')
            .insert({
                task_id,
                tasker_id: userId,
                amount,
                message: message || null,
                estimated_hours: estimated_hours || null,
            })
            .select()
            .single();

        if (error) {
            // Unique constraint violation (task_id + tasker_id)
            if (error.code === '23505') {
                res.status(400).json({ error: 'Vous avez déjà enchéri sur cette tâche' });
                return;
            }
            logger.warn(`Bid creation failed: ${error.message}`);
            res.status(400).json({ error: "Erreur lors de la soumission de l'enchère" });
            return;
        }

        logger.info(`Bid created: ${bid.id} by tasker ${userId} on task ${task_id}`);
        res.status(201).json({ message: 'Enchère soumise', bid });
    } catch (err) {
        logger.error(`createBid error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getBidsForTask = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const taskId = req.params.taskId;
    const sort = (req.query.sort as string) || 'newest';

    try {
        // Verify task exists
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id')
            .eq('id', taskId)
            .single();

        if (!task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        const isClient = task.client_id === userId;

        if (isClient) {
            // Client sees all bids with tasker profiles
            let query = supabaseAdmin
                .from('bids')
                .select(`
          *,
          users!bids_tasker_id_fkey (
            full_name,
            avatar_url
          ),
          tasker_profiles!inner (
            avg_rating,
            total_completed,
            kyc_status,
            has_diploma,
            diploma_type
          )
        `)
                .eq('task_id', taskId);

            // Apply sorting
            switch (sort) {
                case 'price_asc':
                    query = query.order('amount', { ascending: true });
                    break;
                case 'price_desc':
                    query = query.order('amount', { ascending: false });
                    break;
                case 'rating_desc':
                    query = query.order('tasker_profiles(avg_rating)', { ascending: false });
                    break;
                case 'newest':
                default:
                    query = query.order('created_at', { ascending: false });
                    break;
            }

            const { data: bids, error } = await query;

            if (error) {
                logger.warn(`getBidsForTask failed: ${error.message}`);
                res.status(400).json({ error: 'Erreur lors de la récupération des enchères' });
                return;
            }

            res.status(200).json({ bids: bids || [] });
        } else {
            // Tasker sees only their own bid
            const { data: bids, error } = await supabaseAdmin
                .from('bids')
                .select('*')
                .eq('task_id', taskId)
                .eq('tasker_id', userId);

            if (error) {
                logger.warn(`getBidsForTask (tasker) failed: ${error.message}`);
                res.status(400).json({ error: 'Erreur lors de la récupération des enchères' });
                return;
            }

            res.status(200).json({ bids: bids || [] });
        }
    } catch (err) {
        logger.error(`getBidsForTask error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const acceptBid = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const bidId = req.params.id;

    try {
        // Get the bid
        const { data: bid } = await supabaseAdmin
            .from('bids')
            .select('id, task_id, tasker_id, status')
            .eq('id', bidId)
            .single();

        if (!bid) {
            res.status(404).json({ error: 'Enchère non trouvée' });
            return;
        }

        // Get the task
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('id, client_id, status')
            .eq('id', bid.task_id)
            .single();

        if (!task) {
            res.status(404).json({ error: 'Tâche non trouvée' });
            return;
        }

        // Verify ownership
        if (task.client_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Verify task status
        if (!['open', 'bidding'].includes(task.status)) {
            res.status(400).json({ error: "Cette tâche n'accepte plus d'enchères" });
            return;
        }

        // Accept the bid
        const { data: updatedBid, error: bidError } = await supabaseAdmin
            .from('bids')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
            })
            .eq('id', bidId)
            .select()
            .single();

        if (bidError) {
            logger.warn(`Accept bid failed: ${bidError.message}`);
            res.status(400).json({ error: "Erreur lors de l'acceptation" });
            return;
        }

        // Reject all other pending bids for this task
        await supabaseAdmin
            .from('bids')
            .update({
                status: 'rejected',
                rejected_at: new Date().toISOString(),
            })
            .eq('task_id', bid.task_id)
            .eq('status', 'pending')
            .neq('id', bidId);

        // Update the task
        await supabaseAdmin
            .from('tasks')
            .update({
                status: 'assigned',
                accepted_bid_id: bidId,
                accepted_tasker_id: bid.tasker_id,
            })
            .eq('id', bid.task_id);

        logger.info(`Bid accepted: ${bidId} on task ${bid.task_id}`);
        res.status(200).json({ message: 'Enchère acceptée', bid: updatedBid });
    } catch (err) {
        logger.error(`acceptBid error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const rejectBid = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const bidId = req.params.id;

    try {
        // Get the bid and task
        const { data: bid } = await supabaseAdmin
            .from('bids')
            .select('id, task_id, status')
            .eq('id', bidId)
            .single();

        if (!bid) {
            res.status(404).json({ error: 'Enchère non trouvée' });
            return;
        }

        // Verify task ownership
        const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('client_id')
            .eq('id', bid.task_id)
            .single();

        if (!task || task.client_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Reject the bid
        const { error } = await supabaseAdmin
            .from('bids')
            .update({
                status: 'rejected',
                rejected_at: new Date().toISOString(),
            })
            .eq('id', bidId);

        if (error) {
            logger.warn(`Reject bid failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors du refus' });
            return;
        }

        logger.info(`Bid rejected: ${bidId}`);
        res.status(200).json({ message: 'Enchère refusée' });
    } catch (err) {
        logger.error(`rejectBid error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const withdrawBid = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const bidId = req.params.id;

    try {
        // Get the bid
        const { data: bid } = await supabaseAdmin
            .from('bids')
            .select('id, tasker_id, status')
            .eq('id', bidId)
            .single();

        if (!bid) {
            res.status(404).json({ error: 'Enchère non trouvée' });
            return;
        }

        // Verify ownership
        if (bid.tasker_id !== userId) {
            res.status(403).json({ error: 'Non autorisé' });
            return;
        }

        // Verify status
        if (bid.status !== 'pending') {
            res.status(400).json({ error: 'Seules les enchères en attente peuvent être retirées' });
            return;
        }

        // Withdraw
        const { error } = await supabaseAdmin
            .from('bids')
            .update({ status: 'withdrawn' })
            .eq('id', bidId);

        if (error) {
            logger.warn(`Withdraw bid failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors du retrait' });
            return;
        }

        logger.info(`Bid withdrawn: ${bidId} by tasker ${userId}`);
        res.status(200).json({ message: 'Enchère retirée' });
    } catch (err) {
        logger.error(`withdrawBid error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getMyBids = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        const { data: bids, error } = await supabaseAdmin
            .from('bids')
            .select(`
        *,
        tasks (
          id, title, status, city,
          categories (
            name_fr,
            icon
          )
        )
      `)
            .eq('tasker_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.warn(`getMyBids failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des enchères' });
            return;
        }

        res.status(200).json({ bids: bids || [] });
    } catch (err) {
        logger.error(`getMyBids error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
