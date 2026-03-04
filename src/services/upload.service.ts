import sharp from 'sharp';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

interface UploadOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

interface UploadResult {
    url: string;
    path: string;
}

export const processAndUpload = async (
    fileBuffer: Buffer,
    fileName: string,
    bucket: string,
    userId: string,
    options: UploadOptions = {}
): Promise<UploadResult> => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 80 } = options;

    // Process image with Sharp
    const processedBuffer = await sharp(fileBuffer)
        .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true, // Don't upscale small images
        })
        .jpeg({ quality })
        .withMetadata({}) // Strip all EXIF/GPS metadata
        .toBuffer();

    // Generate unique filename
    const randomString = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}-${randomString}.jpg`;

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePath, processedBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
        });

    if (error) {
        logger.error(`Upload failed to ${bucket}: ${error.message}`);
        throw new Error(`Erreur lors de l'upload: ${error.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return {
        url: urlData.publicUrl,
        path: filePath,
    };
};

export const deleteFile = async (
    bucket: string,
    filePath: string
): Promise<boolean> => {
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove([filePath]);

    if (error) {
        logger.error(`Delete failed from ${bucket}: ${error.message}`);
        return false;
    }

    return true;
};
