import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getMyNotifications = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Total count
        const { count: total } = await supabaseAdmin
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Unread count
        const { count: unreadCount } = await supabaseAdmin
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        // Paginated notifications
        const { data: notifications, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.warn(`getMyNotifications failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des notifications' });
            return;
        }

        res.status(200).json({
            notifications: notifications || [],
            total: total || 0,
            unread_count: unreadCount || 0,
            page,
            limit,
        });
    } catch (err) {
        logger.error(`getMyNotifications error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const markAsRead = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    try {
        const { data: notification } = await supabaseAdmin
            .from('notifications')
            .select('user_id')
            .eq('id', notificationId)
            .single();

        if (!notification || notification.user_id !== userId) {
            res.status(404).json({ error: 'Notification non trouvée' });
            return;
        }

        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) {
            logger.warn(`markAsRead failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        res.status(200).json({ message: 'Lu' });
    } catch (err) {
        logger.error(`markAsRead error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const markAllAsRead = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            logger.warn(`markAllAsRead failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        res.status(200).json({ message: 'Tout lu' });
    } catch (err) {
        logger.error(`markAllAsRead error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
