import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import { createNotification } from '../services/notification.service';
import { logger } from '../utils/logger';

export const getDashboardStats = async (
    _req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        // Users by type
        const { count: totalClients } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('user_type', 'client');

        const { count: totalTaskers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('user_type', 'tasker');

        // Tasks by status
        const statuses = ['open', 'bidding', 'assigned', 'in_progress', 'completed', 'cancelled'];
        const taskCounts: Record<string, number> = {};
        for (const status of statuses) {
            const { count } = await supabaseAdmin
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('status', status);
            taskCounts[status] = count || 0;
        }

        // Total bids
        const { count: totalBids } = await supabaseAdmin
            .from('bids')
            .select('*', { count: 'exact', head: true });

        // Total reviews
        const { count: totalReviews } = await supabaseAdmin
            .from('reviews')
            .select('*', { count: 'exact', head: true });

        // KYC by status
        const kycStatuses = ['pending', 'submitted', 'verified', 'rejected'];
        const kycCounts: Record<string, number> = {};
        for (const status of kycStatuses) {
            const { count } = await supabaseAdmin
                .from('tasker_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('kyc_status', status);
            kycCounts[status] = count || 0;
        }

        // Revenue from commissions
        const { data: paidTx } = await supabaseAdmin
            .from('transactions')
            .select('commission_amount')
            .eq('commission_status', 'paid');

        const totalRevenue = (paidTx || []).reduce((sum, tx) => sum + (tx.commission_amount || 0), 0);

        const { data: unpaidTx } = await supabaseAdmin
            .from('transactions')
            .select('commission_amount')
            .eq('commission_status', 'unpaid');

        const pendingRevenue = (unpaidTx || []).reduce((sum, tx) => sum + (tx.commission_amount || 0), 0);

        res.status(200).json({
            stats: {
                users: {
                    total_clients: totalClients || 0,
                    total_taskers: totalTaskers || 0,
                    total: (totalClients || 0) + (totalTaskers || 0),
                },
                tasks: taskCounts,
                total_bids: totalBids || 0,
                total_reviews: totalReviews || 0,
                kyc: kycCounts,
                revenue: {
                    total_earned: totalRevenue,
                    pending: pendingRevenue,
                },
            },
        });
    } catch (err) {
        logger.error(`getDashboardStats error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getPendingKyc = async (
    _req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { data: pending, error } = await supabaseAdmin
            .from('tasker_profiles')
            .select(`
        *,
        users!tasker_profiles_user_id_fkey (
          full_name,
          phone,
          created_at
        )
      `)
            .eq('kyc_status', 'submitted')
            .order('kyc_submitted_at', { ascending: true });

        if (error) {
            logger.warn(`getPendingKyc failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        res.status(200).json({ pending: pending || [] });
    } catch (err) {
        logger.error(`getPendingKyc error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const approveKyc = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const profileId = req.params.id;

    try {
        const { data: profile, error } = await supabaseAdmin
            .from('tasker_profiles')
            .update({
                kyc_status: 'verified',
                kyc_verified_at: new Date().toISOString(),
            })
            .eq('id', profileId)
            .select('user_id')
            .single();

        if (error || !profile) {
            res.status(404).json({ error: 'Profil non trouvé' });
            return;
        }

        await createNotification(
            profile.user_id,
            'kyc_approved',
            'KYC Approuvé',
            'Votre identité a été vérifiée avec succès',
        );

        logger.info(`KYC approved for profile ${profileId}`);
        res.status(200).json({ message: 'KYC approuvé' });
    } catch (err) {
        logger.error(`approveKyc error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const rejectKyc = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const profileId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
        res.status(400).json({ error: 'La raison du refus est requise' });
        return;
    }

    try {
        const { data: profile, error } = await supabaseAdmin
            .from('tasker_profiles')
            .update({
                kyc_status: 'rejected',
                kyc_rejected_reason: reason,
            })
            .eq('id', profileId)
            .select('user_id')
            .single();

        if (error || !profile) {
            res.status(404).json({ error: 'Profil non trouvé' });
            return;
        }

        await createNotification(
            profile.user_id,
            'kyc_rejected',
            'KYC Refusé',
            reason,
        );

        logger.info(`KYC rejected for profile ${profileId}: ${reason}`);
        res.status(200).json({ message: 'KYC refusé' });
    } catch (err) {
        logger.error(`rejectKyc error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const approveDiploma = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const profileId = req.params.id;

    try {
        const { error } = await supabaseAdmin
            .from('tasker_profiles')
            .update({ diploma_verified: true })
            .eq('id', profileId);

        if (error) {
            res.status(404).json({ error: 'Profil non trouvé' });
            return;
        }

        logger.info(`Diploma approved for profile ${profileId}`);
        res.status(200).json({ message: 'Diplôme vérifié' });
    } catch (err) {
        logger.error(`approveDiploma error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getCommissions = async (
    _req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select('month_year, final_amount, agreed_amount, commission_amount, commission_status');

        if (error) {
            logger.warn(`getCommissions failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        // Group by month_year
        const monthMap: Record<string, {
            total_tasks: number;
            total_amount: number;
            total_commission: number;
            paid_commission: number;
            unpaid_commission: number;
        }> = {};

        for (const tx of (transactions || [])) {
            const month = tx.month_year || 'unknown';
            if (!monthMap[month]) {
                monthMap[month] = {
                    total_tasks: 0,
                    total_amount: 0,
                    total_commission: 0,
                    paid_commission: 0,
                    unpaid_commission: 0,
                };
            }
            monthMap[month].total_tasks += 1;
            monthMap[month].total_amount += tx.final_amount || tx.agreed_amount || 0;
            monthMap[month].total_commission += tx.commission_amount || 0;
            if (tx.commission_status === 'paid') {
                monthMap[month].paid_commission += tx.commission_amount || 0;
            } else {
                monthMap[month].unpaid_commission += tx.commission_amount || 0;
            }
        }

        const commissions = Object.entries(monthMap)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => b.month.localeCompare(a.month));

        res.status(200).json({ commissions });
    } catch (err) {
        logger.error(`getCommissions error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getTaskerCommissions = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = (req.query.month_year as string) || defaultMonth;

    try {
        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select(`
        tasker_id, final_amount, agreed_amount, commission_amount, commission_status,
        users!transactions_tasker_id_fkey (
          full_name,
          phone
        )
      `)
            .eq('month_year', monthYear);

        if (error) {
            logger.warn(`getTaskerCommissions failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        // Group by tasker
        const taskerMap: Record<string, {
            tasker_id: string;
            full_name: string;
            phone: string;
            task_count: number;
            total_earned: number;
            commission_owed: number;
            all_paid: boolean;
        }> = {};

        for (const tx of (transactions || [])) {
            const tid = tx.tasker_id;
            if (!taskerMap[tid]) {
                const userInfo = tx.users as any;
                taskerMap[tid] = {
                    tasker_id: tid,
                    full_name: userInfo?.full_name || '',
                    phone: userInfo?.phone || '',
                    task_count: 0,
                    total_earned: 0,
                    commission_owed: 0,
                    all_paid: true,
                };
            }
            taskerMap[tid].task_count += 1;
            taskerMap[tid].total_earned += tx.final_amount || tx.agreed_amount || 0;
            taskerMap[tid].commission_owed += tx.commission_amount || 0;
            if (tx.commission_status !== 'paid') {
                taskerMap[tid].all_paid = false;
            }
        }

        const taskers = Object.values(taskerMap).map((t) => ({
            ...t,
            commission_status: t.all_paid ? 'paid' : 'unpaid',
            all_paid: undefined,
        }));

        res.status(200).json({ month: monthYear, taskers });
    } catch (err) {
        logger.error(`getTaskerCommissions error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const markCommissionPaid = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const transactionId = req.params.id;

    try {
        const { error } = await supabaseAdmin
            .from('transactions')
            .update({ commission_status: 'paid' })
            .eq('id', transactionId);

        if (error) {
            logger.warn(`markCommissionPaid failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        res.status(200).json({ message: 'Commission marquée payée' });
    } catch (err) {
        logger.error(`markCommissionPaid error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const getReports = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const statusFilter = req.query.status as string;

    try {
        let query = supabaseAdmin
            .from('reports')
            .select(`
        *,
        reporter:users!reports_reporter_id_fkey (
          full_name
        ),
        reported:users!reports_reported_id_fkey (
          full_name
        ),
        tasks (
          title
        )
      `)
            .order('created_at', { ascending: false });

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: reports, error } = await query;

        if (error) {
            logger.warn(`getReports failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        res.status(200).json({ reports: reports || [] });
    } catch (err) {
        logger.error(`getReports error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const resolveReport = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const reportId = req.params.id;
    const { resolution, status } = req.body;

    if (!resolution || !status) {
        res.status(400).json({ error: 'La résolution et le statut sont requis' });
        return;
    }

    try {
        const { error } = await supabaseAdmin
            .from('reports')
            .update({
                resolution,
                status,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', reportId);

        if (error) {
            logger.warn(`resolveReport failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        logger.info(`Report resolved: ${reportId}`);
        res.status(200).json({ message: 'Signalement résolu' });
    } catch (err) {
        logger.error(`resolveReport error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const banUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const targetId = req.params.id;
    const { reason } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                is_banned: true,
                ban_reason: reason || null,
            })
            .eq('id', targetId);

        if (error) {
            logger.warn(`banUser failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        logger.info(`User banned: ${targetId}`);
        res.status(200).json({ message: 'Utilisateur banni' });
    } catch (err) {
        logger.error(`banUser error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const unbanUser = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const targetId = req.params.id;

    try {
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                is_banned: false,
                ban_reason: null,
            })
            .eq('id', targetId);

        if (error) {
            logger.warn(`unbanUser failed: ${error.message}`);
            res.status(400).json({ error: 'Erreur' });
            return;
        }

        logger.info(`User unbanned: ${targetId}`);
        res.status(200).json({ message: 'Utilisateur débanni' });
    } catch (err) {
        logger.error(`unbanUser error: ${err}`);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
