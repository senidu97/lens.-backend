# Lens. Backend API

A comprehensive Node.js backend API for the Lens. photography portfolio platform, built with Express.js, MongoDB, and Cloudflare R2 for image storage.

## Features

- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **User Management**: User profiles, settings, and preferences
- **Portfolio Management**: Create, update, and manage photography portfolios
- **Photo Management**: Upload, organize, and manage photos with metadata
- **Image Processing**: Automatic image optimization and thumbnail generation
- **Cloud Storage**: Cloudflare R2 integration for image storage and CDN
- **Search & Discovery**: Advanced search functionality for portfolios and photos
- **Analytics**: View tracking and basic analytics
- **Rate Limiting**: API rate limiting and security measures
- **Validation**: Comprehensive input validation and error handling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Image Processing**: Sharp
- **Cloud Storage**: Cloudflare R2 (S3-compatible)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- Cloudflare R2 bucket
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lens.-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/lens-portfolio
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRE=7d
   JWT_REFRESH_SECRET=your-refresh-secret-key-here
   JWT_REFRESH_EXPIRE=30d
   
   # Cloudflare R2 Configuration
   R2_ACCOUNT_ID=your-cloudflare-account-id
   R2_ACCESS_KEY_ID=your-r2-access-key-id
   R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
   R2_BUCKET_NAME=your-bucket-name
   R2_PUBLIC_URL=https://your-bucket-name.your-account-id.r2.cloudflarestorage.com
   R2_REGION=auto
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Cloudflare R2 Setup

### 1. Create R2 Bucket
1. Go to Cloudflare Dashboard → R2 Object Storage
2. Create a new bucket
3. Note the bucket name and account ID

### 2. Configure Public Access
1. Go to your bucket settings
2. Enable public access
3. Note the public URL format: `https://your-bucket-name.your-account-id.r2.cloudflarestorage.com`

### 3. Create API Token
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create a custom token with R2 permissions
3. Note the Access Key ID and Secret Access Key

### 4. Environment Variables
```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket-name.your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update current user
- `PUT /api/auth/change-password` - Change password
- `DELETE /api/auth/me` - Delete account

### Users
- `GET /api/users/:username` - Get user profile
- `GET /api/users/:username/portfolios` - Get user's portfolios
- `GET /api/users/:username/photos` - Get user's photos
- `GET /api/users/me/profile` - Get current user's profile
- `PUT /api/users/me/profile` - Update current user's profile
- `GET /api/users/me/stats` - Get user statistics
- `GET /api/users/search` - Search users
- `POST /api/users/:username/follow` - Follow/unfollow user
- `GET /api/users/:username/followers` - Get user's followers
- `GET /api/users/:username/following` - Get user's following

### Portfolios
- `GET /api/portfolios` - Get all public portfolios
- `GET /api/portfolios/my` - Get user's portfolios
- `GET /api/portfolios/:slug` - Get portfolio by slug
- `POST /api/portfolios` - Create new portfolio
- `PUT /api/portfolios/:id` - Update portfolio
- `DELETE /api/portfolios/:id` - Delete portfolio
- `PUT /api/portfolios/:id/default` - Set default portfolio
- `GET /api/portfolios/:id/analytics` - Get portfolio analytics
- `POST /api/portfolios/:id/duplicate` - Duplicate portfolio

### Photos
- `GET /api/photos` - Get all public photos
- `GET /api/photos/my` - Get user's photos
- `GET /api/photos/featured` - Get featured photos
- `GET /api/photos/trending` - Get trending photos
- `GET /api/photos/:id` - Get photo by ID
- `PUT /api/photos/:id` - Update photo
- `DELETE /api/photos/:id` - Delete photo
- `POST /api/photos/:id/like` - Like photo
- `POST /api/photos/:id/download` - Download photo
- `POST /api/photos/:id/share` - Share photo
- `GET /api/photos/:id/analytics` - Get photo analytics
- `PUT /api/photos/reorder` - Reorder photos

### Upload (R2 Integration)
- `POST /api/upload/photo` - Upload single photo to R2
- `POST /api/upload/photos` - Upload multiple photos to R2
- `POST /api/upload/avatar` - Upload avatar to R2
- `DELETE /api/upload/photo/:id` - Delete photo from R2
- `POST /api/upload/presigned-url` - Get presigned upload URL
- `POST /api/upload/download-url` - Get presigned download URL
- `GET /api/upload/limits` - Get upload limits
- `GET /api/upload/config` - Get R2 configuration

## Database Models

### User
- Basic profile information
- Authentication data
- Subscription and preferences
- Statistics and analytics
- Social features (following/followers)
- R2 avatar storage

### Portfolio
- Portfolio metadata
- Layout and theme settings
- SEO configuration
- Analytics and view tracking
- Public/private visibility
- R2 cover photo storage

### Photo
- Photo metadata and EXIF data
- R2 storage URLs and keys
- Analytics and engagement
- Organization and categorization
- Processing status
- Color palette extraction

## R2 Integration Features

### Image Processing
- **Automatic Optimization**: Images are automatically optimized for web
- **Thumbnail Generation**: Automatic thumbnail creation
- **Format Conversion**: Support for multiple image formats
- **Color Extraction**: Dominant color palette extraction
- **Metadata Preservation**: EXIF data preservation and extraction

### Storage Structure
```
bucket/
├── dev/                    # Development environment
│   ├── photos/
│   │   └── {userId}/
│   │       ├── {timestamp}_{fileId}.jpg
│   │       └── {timestamp}_{fileId}_thumb.jpg
│   ├── avatars/
│   │   └── {userId}/
│   │       └── {timestamp}_{fileId}.jpg
│   └── cover-photos/
│       └── {userId}/
│           └── {timestamp}_{fileId}.jpg
└── prod/                   # Production environment
    ├── photos/
    │   └── {userId}/
    │       ├── {timestamp}_{fileId}.jpg
    │       └── {timestamp}_{fileId}_thumb.jpg
    ├── avatars/
    │   └── {userId}/
    │       └── {timestamp}_{fileId}.jpg
    └── cover-photos/
        └── {userId}/
            └── {timestamp}_{fileId}.jpg
```

### CDN Integration
- R2 public URLs serve as CDN endpoints
- Automatic image optimization
- Global edge caching
- Custom domain support

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation
- **CORS Protection**: Cross-origin resource sharing configuration
- **Helmet Security**: Security headers and protection
- **File Upload Security**: File type and size validation
- **R2 Security**: Secure presigned URLs for uploads

## Subscription Plans

### Free Plan
- 30 photos maximum
- 3 portfolios maximum
- 10MB file size limit
- Basic features

### Pro Plan
- Unlimited photos
- Unlimited portfolios
- 50MB file size limit
- Advanced features
- Custom domains
- Priority support

## Error Handling

The API includes comprehensive error handling with:
- Validation errors
- Authentication errors
- Authorization errors
- Database errors
- File upload errors
- R2 storage errors

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables
- Different limits for different endpoints

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

### Code Structure
```
src/
├── models/          # MongoDB models
├── routes/          # API routes
├── middleware/      # Custom middleware
├── utils/           # Utility functions (R2 integration)
└── server.js        # Main server file
```

## Deployment

### Environment Variables
Ensure all required environment variables are set in production:

- `NODE_ENV=production`
- `MONGODB_URI` - Production MongoDB connection string
- `JWT_SECRET` - Strong JWT secret
- `R2_*` - Cloudflare R2 configuration
- `FRONTEND_URL` - Production frontend URL

### Production Considerations
- Use a process manager like PM2
- Set up MongoDB replica set for production
- Configure proper logging
- Set up monitoring and alerting
- Use HTTPS in production
- Configure proper CORS settings
- Set up R2 bucket policies for production

## R2 Best Practices

### File Organization
- Use consistent naming conventions
- Organize files by environment (dev/prod), user and type
- Include timestamps for uniqueness
- Store metadata in database, not file names
- All user uploads go directly to R2 (no local storage)

### Performance
- Use appropriate image sizes
- Generate thumbnails for faster loading
- Implement lazy loading
- Use CDN for global distribution

### Security
- Validate file types and sizes
- Use presigned URLs for uploads
- Implement proper access controls
- Monitor usage and costs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository.