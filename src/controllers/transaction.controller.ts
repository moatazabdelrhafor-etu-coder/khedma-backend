import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getMyTransactions = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        // Count
        const { count } = await supabaseAdmin
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .or(`tasker_id.eq.${userId},client_id.eq.${userId}`);

        // Paginated data
        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select(`
        *,
        tasks (
          title
        ),
        users!transactions_tasker_id_fkey (
          full_name
        )
      `)
            .or(`tasker_id.eq.${userId},client_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.warn(`getMyTransactions failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération des transactions' });
            return;
        }

        res.status(200).json({
            transactions: transactions || [],
            total: count || 0,
            page,
            limit,
        });
    } catch (err) {
        logger.error(`getMyTransactions error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getMonthlySummary = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const userId = req.user!.id;

    // Default to current month
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = (req.query.month_year as string) || defaultMonth;

    try {
        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select('agreed_amount, final_amount, commission_amount')
            .eq('tasker_id', userId)
            .eq('month_year', monthYear);

        if (error) {
            logger.warn(`getMonthlySummary failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur lors de la récupération du résumé' });
            return;
        }

        const txList = transactions || [];
        const taskCount = txList.length;

        const totalEarned = txList.reduce((sum, tx) => {
            return sum + (tx.final_amount || tx.agreed_amount || 0);
        }, 0);

        const totalCommission = txList.reduce((sum, tx) => {
            return sum + (tx.commission_amount || 0);
        }, 0);

        res.status(200).json({
            month: monthYear,
            total_earned: totalEarned,
            total_commission: totalCommission,
            net_earned: totalEarned - totalCommission,
            task_count: taskCount,
        });
    } catch (err) {
        logger.error(`getMonthlySummary error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
