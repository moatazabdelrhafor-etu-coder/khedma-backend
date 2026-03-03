import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email?: string;
        phone?: string;
        app_metadata: Record<string, unknown>;
        user_metadata: Record<string, unknown>;
        [key: string]: unknown;
    };
}

export const authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        // Create a fresh client with the user's token to verify it
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: { Authorization: `Bearer ${token}` },
                },
            }
        );

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            logger.warn(`Invalid token attempt: ${error?.message}`);
            res.status(401).json({ error: 'Token invalide' });
            return;
        }

        req.user = {
            id: data.user.id,
            email: data.user.email,
            phone: data.user.phone,
            app_metadata: data.user.app_metadata,
            user_metadata: data.user.user_metadata,
        };

        next();
    } catch (err) {
        logger.error(`Auth middleware error: ${err}`);
        res.status(401).json({ error: 'Token invalide' });
    }
};
