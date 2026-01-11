/**
 * SMS Message Personalization Helper
 * Provides personalization tokens and context for SMS messages
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Get supplier relationship context
 * @param {Object} supplier - Supplier object
 * @param {string} projectId - Project ID (optional)
 * @returns {Promise<Object>} Relationship context data
 */
export async function getSupplierRelationshipContext(supplier, projectId = null) {
  if (!supplier) return null;

  try {
    const db = await getDatabase();
    const context = {
      supplierName: supplier.name || supplier.contactPerson || 'Supplier',
      contactPerson: supplier.contactPerson || null,
      totalOrders: 0,
      acceptedOrders: 0,
      rejectedOrders: 0,
      totalValue: 0,
      averageResponseTime: null,
      lastOrderDate: null,
      relationshipDuration: null,
      isNewSupplier: false,
      isPreferredSupplier: false,
      projectContext: null
    };

    // Get supplier's order history
    const orderQuery = {
      supplierId: supplier._id,
      deletedAt: null
    };

    if (projectId && ObjectId.isValid(projectId)) {
      orderQuery.projectId = new ObjectId(projectId);
    }

    const orders = await db.collection('purchase_orders')
      .find(orderQuery)
      .sort({ createdAt: -1 })
      .toArray();

    if (orders.length > 0) {
      context.totalOrders = orders.length;
      context.acceptedOrders = orders.filter(o => o.status === 'order_accepted' || o.status === 'delivered').length;
      context.rejectedOrders = orders.filter(o => o.status === 'order_rejected').length;
      context.totalValue = orders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
      context.lastOrderDate = orders[0].createdAt;

      // Calculate average response time (for accepted orders)
      const acceptedOrdersWithResponse = orders.filter(o => 
        o.supplierResponseDate && 
        (o.status === 'order_accepted' || o.status === 'delivered')
      );
      
      if (acceptedOrdersWithResponse.length > 0) {
        const responseTimes = acceptedOrdersWithResponse.map(o => {
          const sentAt = o.sentAt || o.createdAt;
          const respondedAt = o.supplierResponseDate;
          return (new Date(respondedAt) - new Date(sentAt)) / (1000 * 60 * 60); // Hours
        });
        context.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }

      // Calculate relationship duration
      const firstOrder = orders[orders.length - 1];
      if (firstOrder && firstOrder.createdAt) {
        const daysSinceFirstOrder = (new Date() - new Date(firstOrder.createdAt)) / (1000 * 60 * 60 * 24);
        context.relationshipDuration = Math.floor(daysSinceFirstOrder);
      }

      // Check if new supplier (less than 30 days)
      if (context.relationshipDuration !== null && context.relationshipDuration < 30) {
        context.isNewSupplier = true;
      }

      // Check if preferred supplier (high acceptance rate and good response time)
      const acceptanceRate = context.totalOrders > 0 ? context.acceptedOrders / context.totalOrders : 0;
      if (acceptanceRate >= 0.8 && context.averageResponseTime !== null && context.averageResponseTime < 24) {
        context.isPreferredSupplier = true;
      }
    } else {
      context.isNewSupplier = true;
    }

    // Get project context if projectId provided
    if (projectId && ObjectId.isValid(projectId)) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
        deletedAt: null
      });

      if (project) {
        context.projectContext = {
          projectName: project.projectName || project.projectCode,
          projectCode: project.projectCode,
          location: project.location
        };
      }
    }

    return context;
  } catch (error) {
    console.error('[SMS Personalization] Error getting relationship context:', error);
    // Return basic context on error
    return {
      supplierName: supplier.name || supplier.contactPerson || 'Supplier',
      contactPerson: supplier.contactPerson || null,
      totalOrders: 0,
      isNewSupplier: true
    };
  }
}

/**
 * Generate personalized greeting
 * @param {Object} context - Relationship context
 * @param {string} language - Language code ('en' or 'sw')
 * @returns {string} Personalized greeting
 */
export function generatePersonalizedGreeting(context, language = 'en') {
  if (!context) return '';

  const name = context.contactPerson || context.supplierName || '';

  if (language === 'sw') {
    if (context.isNewSupplier) {
      return name ? `Karibu ${name},` : 'Karibu,';
    } else if (context.isPreferredSupplier) {
      return name ? `Habari ${name},` : 'Habari,';
    } else {
      return name ? `Hujambo ${name},` : 'Hujambo,';
    }
  }

  // English
  if (context.isNewSupplier) {
    return name ? `Hello ${name},` : 'Hello,';
  } else if (context.isPreferredSupplier) {
    return name ? `Dear ${name},` : 'Dear Supplier,';
  } else {
    return name ? `Hi ${name},` : 'Hi,';
  }
}

/**
 * Generate relationship context message
 * @param {Object} context - Relationship context
 * @param {string} language - Language code ('en' or 'sw')
 * @returns {string} Relationship context message
 */
export function generateRelationshipContext(context, language = 'en') {
  if (!context || context.totalOrders === 0) return '';

  if (language === 'sw') {
    if (context.isPreferredSupplier) {
      return 'Asante kwa ufadhili wako wa kila wakati.';
    } else if (context.totalOrders > 5) {
      return 'Asante kwa ufadhili wako.';
    }
    return '';
  }

  // English
  if (context.isPreferredSupplier) {
    return 'Thank you for your continued partnership.';
  } else if (context.totalOrders > 5) {
    return 'Thank you for your partnership.';
  }
  return '';
}

/**
 * Generate project context message
 * @param {Object} context - Relationship context
 * @param {string} language - Language code ('en' or 'sw')
 * @returns {string} Project context message
 */
export function generateProjectContext(context, language = 'en') {
  if (!context || !context.projectContext) return '';

  const { projectName, projectCode, location } = context.projectContext;

  if (language === 'sw') {
    if (location) {
      return `Mradi: ${projectName} (${location})`;
    }
    return `Mradi: ${projectName}`;
  }

  // English
  if (location) {
    return `Project: ${projectName} (${location})`;
  }
  return `Project: ${projectName}`;
}

/**
 * Apply personalization to SMS message
 * @param {string} message - Base message
 * @param {Object} context - Relationship context
 * @param {string} language - Language code ('en' or 'sw')
 * @param {Object} options - Personalization options
 * @param {boolean} options.includeGreeting - Include personalized greeting
 * @param {boolean} options.includeRelationship - Include relationship context
 * @param {boolean} options.includeProject - Include project context
 * @returns {string} Personalized message
 */
export function personalizeMessage(message, context, language = 'en', options = {}) {
  const {
    includeGreeting = true,
    includeRelationship = true,
    includeProject = true
  } = options;

  if (!context) return message;

  let personalizedMessage = '';

  // Add greeting
  if (includeGreeting) {
    const greeting = generatePersonalizedGreeting(context, language);
    if (greeting) {
      personalizedMessage += greeting + '\n';
    }
  }

  // Add project context
  if (includeProject && context.projectContext) {
    const projectContext = generateProjectContext(context, language);
    if (projectContext) {
      personalizedMessage += projectContext + '\n';
    }
  }

  // Add main message
  personalizedMessage += message;

  // Add relationship context at the end
  if (includeRelationship) {
    const relationshipContext = generateRelationshipContext(context, language);
    if (relationshipContext) {
      personalizedMessage += '\n' + relationshipContext;
    }
  }

  return personalizedMessage.trim();
}

