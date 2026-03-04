import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from './auth';

export const requireAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
    }

    try {
        const adminPhones = (process.env.ADMIN_PHONES || '').split(',').map((p) => p.trim()).filter(Boolean);

        if (adminPhones.length === 0) {
            res.status(403).json({ error: 'Accès administrateur requis' });
            return;
        }

        // Get the user's phone from the users table
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('phone')
            .eq('id', userId)
            .single();

        if (!user || !adminPhones.includes(user.phone)) {
            res.status(403).json({ error: 'Accès administrateur requis' });
            return;
        }

        next();
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
