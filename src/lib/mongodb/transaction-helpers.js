/**
 * MongoDB Transaction Helpers
 * 
 * Provides utilities for executing operations within MongoDB transactions.
 * Ensures atomicity for critical operations.
 * 
 * NOTE: Transactions require MongoDB replica set (even single-node replica set).
 * MongoDB Atlas clusters typically have replica sets enabled by default.
 */

import { getClient } from './connection';

/**
 * Execute operations within a MongoDB transaction
 * 
 * All operations within the callback will be executed atomically.
 * If any operation fails, all operations will be rolled back.
 * 
 * @param {Function} operations - Async function that receives { db, session }
 * @param {Object} options - Transaction options
 * @param {number} options.maxTimeMS - Maximum time for transaction (default: 30000ms)
 * @param {Object} options.transactionOptions - Additional transaction options
 * @returns {Promise<*>} Result of operations function
 * 
 * @example
 * const result = await withTransaction(async ({ db, session }) => {
 *   const po = await db.collection('purchase_orders').insertOne(
 *     purchaseOrder,
 *     { session }
 *   );
 *   await db.collection('material_requests').updateOne(
 *     { _id: requestId },
 *     { $set: { linkedPurchaseOrderId: po.insertedId } },
 *     { session }
 *   );
 *   return po.insertedId;
 * });
 */
export async function withTransaction(operations, options = {}) {
  const { maxTimeMS = 30000, transactionOptions = {} } = options;
  const client = await getClient();
  const session = client.startSession();

  try {
    let result;
    
    // Execute operations within transaction
    await session.withTransaction(
      async () => {
        const db = client.db(process.env.MONGODB_DB_NAME || 'kisheka_prod');
        result = await operations({ db, session });
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxTimeMS,
        ...transactionOptions,
      }
    );
    
    return result;
  } catch (error) {
    console.error('Transaction error:', error);
    
    // Provide more specific error messages
    if (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) {
      throw new Error('Transaction failed due to transient error. Please retry.');
    } else if (error.errorLabels && error.errorLabels.includes('UnknownTransactionCommitResult')) {
      throw new Error('Transaction commit result unknown. Please verify the operation completed.');
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

/**
 * Check if MongoDB supports transactions
 * 
 * Transactions require a replica set. This function checks if the
 * MongoDB deployment supports transactions.
 * 
 * @returns {Promise<boolean>} True if transactions are supported
 */
export async function supportsTransactions() {
  try {
    const client = await getClient();
    const admin = client.db().admin();
    
    // Check if this is a replica set
    const status = await admin.command({ isMaster: 1 });
    return !!(status.setName || status.isreplicaset);
  } catch (error) {
    console.error('Error checking transaction support:', error);
    return false;
  }
}

/**
 * Execute operations with fallback if transactions are not supported
 * 
 * If transactions are supported, uses withTransaction.
 * Otherwise, executes operations sequentially with manual rollback.
 * 
 * @param {Function} operations - Async function that receives { db, session }
 * @param {Function} rollback - Async function to rollback if operations fail (only used if no transactions)
 * @param {Object} options - Transaction options
 * @returns {Promise<*>} Result of operations function
 */
export async function withTransactionOrFallback(operations, rollback, options = {}) {
  const hasTransactions = await supportsTransactions();
  
  if (hasTransactions) {
    // Use transactions
    return await withTransaction(operations, options);
  } else {
    // Fallback: Execute sequentially with manual rollback
    console.warn('⚠️  MongoDB transactions not supported. Using fallback mode with manual rollback.');
    
    const client = await getClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'kisheka_prod');
    
    try {
      return await operations({ db, session: null });
    } catch (error) {
      console.error('Operation failed, attempting rollback:', error);
      try {
        await rollback({ db, session: null });
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
        throw new Error(`Operation failed and rollback also failed: ${error.message}`);
      }
      throw error;
    }
  }
}




























