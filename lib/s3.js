import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export const uploadImageToR2 = async (fileBuffer, fileName, contentType) => {
    try {
        const uploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: fileBuffer,
            ContentType: contentType,
            // Metadata if needed
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Return the public URL
        // Public URL format: https://<your-custom-domain>/<key> or R2.dev URL if testing
        const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
        return publicUrl;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw new Error('Failed to upload image to Cloudflare R2');
    }
};
