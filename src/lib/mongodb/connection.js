import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;
let connectionPromise = null;

/**
 * Check if MongoDB connection is healthy
 * @param {MongoClient} client - MongoDB client to check
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function isConnectionHealthy(client) {
  try {
    if (!client) return false;
    await client.db().admin().ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Connect to MongoDB database
 * Uses singleton pattern to reuse connection across requests
 * Includes health checks and automatic reconnection
 * @returns {Promise<{client: MongoClient, db: Db}>}
 */
async function connectToDatabase() {
  // Check if cached connection is healthy
  if (cachedClient && cachedDb) {
    const isHealthy = await isConnectionHealthy(cachedClient);
    if (isHealthy) {
      return { client: cachedClient, db: cachedDb };
    } else {
      // Connection is stale, clear cache and reconnect
      console.warn('⚠️ MongoDB connection is stale, reconnecting...');
      cachedClient = null;
      cachedDb = null;
    }
  }

  // If there's already a connection attempt in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    // Enable connection monitoring
    monitorCommands: false,
    // Retry writes for better reliability
    retryWrites: true,
  };

  // Create connection promise
  connectionPromise = (async () => {
    try {
      const client = new MongoClient(uri, options);
      await client.connect();
      
      // Get database name from URI or use default
      const dbName = process.env.MONGODB_DB_NAME || 'kisheka_prod';
      const db = client.db(dbName);
      
      // Verify connection with ping
      await db.admin().ping();
      
      console.log('✅ MongoDB connected successfully');
      
      // Cache the connection
      cachedClient = client;
      cachedDb = db;
      
      // Set up error handlers for automatic reconnection
      client.on('error', (error) => {
        console.error('❌ MongoDB client error:', error);
        // Clear cache on error to force reconnection
        cachedClient = null;
        cachedDb = null;
      });

      client.on('close', () => {
        console.warn('⚠️ MongoDB connection closed');
        cachedClient = null;
        cachedDb = null;
      });
      
      return { client, db };
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      // Clear cache on error
      cachedClient = null;
      cachedDb = null;
      throw error;
    } finally {
      // Clear connection promise after completion
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Get database instance
 * @returns {Promise<Db>}
 */
export async function getDatabase() {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Get MongoDB client
 * @returns {Promise<MongoClient>}
 */
export async function getClient() {
  const { client } = await connectToDatabase();
  return client;
}

/**
 * Close database connection
 * Useful for cleanup in scripts
 */
export async function closeDatabase() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('MongoDB connection closed');
  }
}

export default connectToDatabase;

