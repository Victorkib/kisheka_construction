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
 * Connect to MongoDB database with retry logic
 * Uses singleton pattern to reuse connection across requests
 * Includes health checks, automatic reconnection, and exponential backoff retries
 *
 * CRITICAL FOR PRODUCTION (Netlify):
 * - Serverless cold starts can take 5-15 seconds for MongoDB Atlas
 * - DNS resolution + TLS handshake + server selection on first request
 * - These timeouts are calibrated for production serverless environments
 *
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
    // CRITICAL: Increased timeouts for production serverless cold starts
    // Netlify functions can take 10-15s to establish MongoDB Atlas connection
    connectTimeoutMS: 15000,        // 15 seconds (was default ~30s, explicit for clarity)
    serverSelectionTimeoutMS: 15000, // 15 seconds (was 5s - too aggressive for production)
    socketTimeoutMS: 45000,          // 45 seconds (unchanged - for query execution)
    // Enable connection monitoring
    monitorCommands: false,
    // Retry writes for better reliability
    retryWrites: true,
    // Read preference: prefer primary for consistency
    // This ensures we read the most recent writes (critical for auth sync verification)
    readPreference: 'primary',
    // Read concern: majority ensures we read replicated data
    readConcern: { level: 'majority' },
  };

  // CRITICAL: Retry logic with exponential backoff for production reliability
  // On Netlify, cold starts + network issues can cause transient failures
  // We retry up to 3 times with delays: 0ms, 2000ms, 4000ms (total max wait: ~21s + connection time)
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait before retry (exponential backoff: 0ms, 2s, 4s)
      if (attempt > 0) {
        const delayMs = attempt * 2000;
        console.log(`[MongoDB] Retry attempt ${attempt}/${maxRetries}, waiting ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

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

          console.log('✅ MongoDB connected successfully', {
            attempt: attempt + 1,
            database: dbName
          });

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

      // Return the successful connection
      return await connectionPromise;
    } catch (error) {
      lastError = error;
      console.error(`[MongoDB] Connection attempt ${attempt + 1}/${maxRetries + 1} failed:`, {
        message: error.message,
        code: error.code,
        name: error.name
      });

      // Clear connection promise so next attempt starts fresh
      connectionPromise = null;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error('[MongoDB] All connection attempts failed after retries');
        throw new Error(
          `MongoDB connection failed after ${maxRetries + 1} attempts: ${lastError.message}. ` +
          'This is likely a transient network issue. Please try again.'
        );
      }
    }
  }
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

