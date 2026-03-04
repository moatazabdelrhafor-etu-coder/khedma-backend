import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

interface NotificationData {
    [key: string]: unknown;
}

export const createNotification = async (
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: NotificationData
) => {
    try {
        const { data: notification, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                type,
                title,
                body,
                data: data || null,
            })
            .select()
            .single();

        if (error) {
            logger.warn(`Notification creation failed: ${error.message}`);
            return null;
        }

        logger.info(`Notification sent: ${type} to user ${userId}`);
        return notification;
    } catch (err) {
        logger.error(`createNotification error: ${err}`);
        return null;
    }
};
