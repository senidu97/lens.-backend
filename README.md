# Lens. Backend API

A comprehensive Node.js backend API for the Lens. photography portfolio platform, built with Express.js and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **User Management**: User profiles, settings, and preferences
- **Portfolio Management**: Create, update, and manage photography portfolios
- **Photo Management**: Upload, organize, and manage photos with metadata
- **Image Processing**: Automatic image optimization and thumbnail generation
- **Cloud Storage**: Cloudinary integration for image storage and CDN
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
- **Cloud Storage**: Cloudinary
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- Cloudinary account
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lens-backend
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
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
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

### Upload
- `POST /api/upload/photo` - Upload single photo
- `POST /api/upload/photos` - Upload multiple photos
- `POST /api/upload/avatar` - Upload avatar
- `DELETE /api/upload/photo/:id` - Delete photo from cloud
- `GET /api/upload/limits` - Get upload limits

## Database Models

### User
- Basic profile information
- Authentication data
- Subscription and preferences
- Statistics and analytics
- Social features (following/followers)

### Portfolio
- Portfolio metadata
- Layout and theme settings
- SEO configuration
- Analytics and view tracking
- Public/private visibility

### Photo
- Photo metadata and EXIF data
- Cloud storage URLs
- Analytics and engagement
- Organization and categorization
- Processing status

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation
- **CORS Protection**: Cross-origin resource sharing configuration
- **Helmet Security**: Security headers and protection
- **File Upload Security**: File type and size validation

## Image Processing

- **Automatic Optimization**: Images are automatically optimized for web
- **Thumbnail Generation**: Automatic thumbnail creation
- **Format Conversion**: Support for multiple image formats
- **Color Extraction**: Dominant color palette extraction
- **Metadata Preservation**: EXIF data preservation and extraction

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
- Cloudinary errors

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
├── utils/           # Utility functions
└── server.js        # Main server file
```

## Deployment

### Environment Variables
Ensure all required environment variables are set in production:

- `NODE_ENV=production`
- `MONGODB_URI` - Production MongoDB connection string
- `JWT_SECRET` - Strong JWT secret
- `CLOUDINARY_*` - Cloudinary configuration
- `FRONTEND_URL` - Production frontend URL

### Production Considerations
- Use a process manager like PM2
- Set up MongoDB replica set for production
- Configure proper logging
- Set up monitoring and alerting
- Use HTTPS in production
- Configure proper CORS settings

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
