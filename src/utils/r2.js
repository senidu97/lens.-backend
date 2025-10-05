const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configure S3 client for Cloudflare R2
const r2Client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Environment-based directory structure
const ENVIRONMENT_PREFIX = process.env.R2_ENVIRONMENT_PREFIX || process.env.NODE_ENV || 'dev';

// Local storage fallback for development
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const LOCAL_PUBLIC_URL = process.env.LOCAL_PUBLIC_URL || 'http://localhost:5000/uploads';

// Ensure uploads directory exists
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

// Helper function to generate environment-aware key
const generateKey = (folder, filename) => {
  // Format: environment/folder/filename
  // Examples:
  // - dev/photos/user123/image.jpg
  // - prod/avatars/user123/avatar.jpg
  // - staging/cover-photos/user123/cover.jpg
  return `${ENVIRONMENT_PREFIX}/${folder}/${filename}`;
};

// Helper function to get environment-aware URL
const generateUrl = (key) => {
  return `${PUBLIC_URL}/${key}`;
};

// Helper function to upload to local storage (development fallback)
const uploadToLocal = async (buffer, key, contentType, metadata = {}) => {
  try {
    const filePath = path.join(LOCAL_UPLOADS_DIR, key);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, buffer);
    
    return {
      success: true,
      key,
      url: `${LOCAL_PUBLIC_URL}/${key}`,
      etag: `"${Date.now()}"`,
      environment: ENVIRONMENT_PREFIX,
    };
  } catch (error) {
    console.error('Local upload error:', error);
    throw error;
  }
};

// Helper function to upload buffer to R2
const uploadToR2 = async (buffer, key, contentType, metadata = {}) => {
  try {
    // Check if R2 is configured
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.warn('R2 not configured, using local file storage for development');
      return uploadToLocal(buffer, key, contentType, metadata);
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    const result = await r2Client.send(command);
    return {
      success: true,
      key,
      url: generateUrl(key),
      etag: result.ETag,
      environment: ENVIRONMENT_PREFIX,
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`Failed to upload to R2: ${error.message}`);
  }
};

// Helper function to delete from R2
const deleteFromR2 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new Error(`Failed to delete from R2: ${error.message}`);
  }
};

// Helper function to generate presigned URL for upload
const generatePresignedUploadUrl = async (key, contentType, expiresIn = 3600) => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

// Helper function to generate presigned URL for download
const generatePresignedDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Presigned download URL generation error:', error);
    throw new Error(`Failed to generate presigned download URL: ${error.message}`);
  }
};

// Helper function to process and upload image
const processAndUploadImage = async (buffer, options = {}) => {
  const {
    userId,
    folder = 'photos',
    quality = 85,
    maxWidth = 2048,
    maxHeight = 2048,
    generateThumbnail = true,
    thumbnailSize = 300,
    extractColors = true,
  } = options;

  try {
    // Generate unique filename
    const fileId = uuidv4();
    const timestamp = Date.now();
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Process main image
    const processedImage = await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();

    // Generate main image key with environment prefix
    const mainImageKey = generateKey(folder, `${userId}/${timestamp}_${fileId}.jpg`);
    
    // Upload main image
    const mainImageResult = await uploadToR2(processedImage, mainImageKey, 'image/jpeg', {
      originalName: options.originalName || 'image.jpg',
      userId: userId.toString(),
      type: 'main',
      width: metadata.width.toString(),
      height: metadata.height.toString(),
    });

    let thumbnailResult = null;
    let colorPalette = [];

    // Generate thumbnail if requested
    if (generateThumbnail) {
      const thumbnailBuffer = await sharp(buffer)
        .resize(thumbnailSize, thumbnailSize, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = generateKey(folder, `${userId}/${timestamp}_${fileId}_thumb.jpg`);
      
      thumbnailResult = await uploadToR2(thumbnailBuffer, thumbnailKey, 'image/jpeg', {
        originalName: options.originalName || 'image.jpg',
        userId: userId.toString(),
        type: 'thumbnail',
        width: thumbnailSize.toString(),
        height: thumbnailSize.toString(),
      });
    }

    // Extract dominant colors if requested
    if (extractColors) {
      colorPalette = await extractDominantColors(buffer);
    }

    return {
      success: true,
      mainImage: {
        key: mainImageKey,
        url: mainImageResult.url,
        width: metadata.width,
        height: metadata.height,
        size: processedImage.length,
        format: 'jpg',
      },
      thumbnail: thumbnailResult ? {
        key: thumbnailResult.key,
        url: thumbnailResult.url,
        width: thumbnailSize,
        height: thumbnailSize,
        size: thumbnailBuffer.length,
        format: 'jpg',
      } : null,
      colorPalette,
      metadata: {
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        originalFormat: metadata.format,
        originalSize: buffer.length,
      },
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
};

// Helper function to extract dominant colors
const extractDominantColors = async (buffer) => {
  try {
    const { data, info } = await sharp(buffer)
      .resize(150, 150)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = {};
    const step = info.channels;

    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const color = `rgb(${r},${g},${b})`;
      colors[color] = (colors[color] || 0) + 1;
    }

    // Sort colors by frequency and return top 5
    return Object.entries(colors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color, count]) => ({
        color,
        percentage: Math.round((count / (data.length / step)) * 100),
      }));
  } catch (error) {
    console.error('Color extraction error:', error);
    return [];
  }
};

// Helper function to upload avatar
const uploadAvatar = async (buffer, userId) => {
  try {
    const fileId = uuidv4();
    const timestamp = Date.now();
    
    // Process avatar (square crop)
    const processedAvatar = await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    const avatarKey = generateKey('avatars', `${userId}/${timestamp}_${fileId}.jpg`);
    
    const result = await uploadToR2(processedAvatar, avatarKey, 'image/jpeg', {
      userId: userId.toString(),
      type: 'avatar',
      width: '400',
      height: '400',
    });

    return {
      success: true,
      key: avatarKey,
      url: result.url,
      width: 400,
      height: 400,
      size: processedAvatar.length,
      format: 'jpg',
    };
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }
};

// Helper function to get file info from R2
const getFileInfo = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const result = await r2Client.send(command);
    return {
      success: true,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
      metadata: result.Metadata,
    };
  } catch (error) {
    console.error('Get file info error:', error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
};

// Helper function to check if file exists
const fileExists = async (key) => {
  try {
    await getFileInfo(key);
    return true;
  } catch (error) {
    return false;
  }
};

// Helper function to generate CDN URL with transformations
const generateCDNUrl = (key, transformations = {}) => {
  const baseUrl = `${PUBLIC_URL}/${key}`;
  
  if (Object.keys(transformations).length === 0) {
    return baseUrl;
  }

  // For Cloudflare R2, you can use Cloudflare Images or custom transformations
  // This is a basic implementation - you might want to use Cloudflare Images API
  const params = new URLSearchParams();
  
  if (transformations.width) params.append('width', transformations.width);
  if (transformations.height) params.append('height', transformations.height);
  if (transformations.quality) params.append('quality', transformations.quality);
  if (transformations.format) params.append('format', transformations.format);
  
  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
};

module.exports = {
  r2Client,
  uploadToR2,
  deleteFromR2,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  processAndUploadImage,
  extractDominantColors,
  uploadAvatar,
  getFileInfo,
  fileExists,
  generateCDNUrl,
};
