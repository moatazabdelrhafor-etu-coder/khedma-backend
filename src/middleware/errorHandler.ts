import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

    if (process.env.NODE_ENV === 'development') {
        res.status(500).json({
            error: 'Erreur serveur interne',
            details: err.message,
        });
    } else {
        res.status(500).json({
            error: 'Erreur serveur interne',
        });
    }
};
