// MongoDB initialization script
db = db.getSiblingDB('lens-portfolio');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        }
      }
    }
  }
});

db.createCollection('portfolios', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user', 'title', 'slug'],
      properties: {
        title: {
          bsonType: 'string',
          maxLength: 100
        },
        slug: {
          bsonType: 'string',
          pattern: '^[a-z0-9-]+$'
        }
      }
    }
  }
});

db.createCollection('photos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user', 'portfolio', 'url', 'publicId'],
      properties: {
        title: {
          bsonType: 'string',
          maxLength: 100
        },
        description: {
          bsonType: 'string',
          maxLength: 500
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ 'subscription.plan': 1 });

db.portfolios.createIndex({ user: 1 });
db.portfolios.createIndex({ slug: 1 }, { unique: true });
db.portfolios.createIndex({ isPublic: 1 });
db.portfolios.createIndex({ 'analytics.totalViews': -1 });

db.photos.createIndex({ user: 1 });
db.photos.createIndex({ portfolio: 1 });
db.photos.createIndex({ isPublic: 1 });
db.photos.createIndex({ 'analytics.views': -1 });
db.photos.createIndex({ createdAt: -1 });

print('MongoDB initialization completed successfully');
