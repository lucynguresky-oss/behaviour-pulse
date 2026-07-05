import mongoose from 'mongoose';
import { shouldExpressUseLocalDb } from '../config/db.js';
import { localEmailLog } from '../utils/dbStore.js';

const EmailLogSchema = new mongoose.Schema({
  schoolId: { type: String, required: true, default: 'school-main', index: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  targetOption: { type: String, required: true },
  targetLabel: { type: String, required: true },
  recipientEmails: [{ type: String }],
  pointsChange: { type: Number, required: true },
  reason: { type: String, required: true },
  subject: { type: String, required: true },
  aiGeneratedContext: { type: String, required: true },
  status: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
  deliveryMode: { type: String, default: '' },
  previewUrl: { type: String, default: '' },
  success: { type: Boolean, default: false },
  error: { type: String, default: '' },
}, { timestamps: true });

/**
 * Native Mongoose Model for MongoDB-backed production environments.
 */
const MongooseEmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', EmailLogSchema);

/**
 * Unified EmailLog Database Wrapper Interface.
 * Dynamically switches between local JSON-file sandbox and MongoDB.
 */
const EmailLogWrapper = {
  /**
   * Queries email logs from the active database engine.
   * @param {Object} query - MongoDB-style query filters
   * @returns {Promise<Array<Object>>} Array of email log documents
   */
  find: async (query = {}) => shouldExpressUseLocalDb() ? localEmailLog.find(query) : MongooseEmailLog.find(query).sort({ createdAt: -1 }),

  /**
   * Registers a new email log entry.
   * @param {Object} data - Schema fields containing dispatch details
   * @returns {Promise<Object>} Newly created log object
   */
  create: async (data) => shouldExpressUseLocalDb() ? localEmailLog.create(data) : MongooseEmailLog.create(data),

  /**
   * Finds a log by ID and applies updates.
   * @param {String} id - Unique log identifier
   * @param {Object} update - Updated fields
   * @returns {Promise<Object|null>} Updated log document
   */
  findByIdAndUpdate: async (id, update) => shouldExpressUseLocalDb() ? localEmailLog.findByIdAndUpdate(id, update) : MongooseEmailLog.findByIdAndUpdate(id, update, { new: true }),

  schema: EmailLogSchema
};

export default EmailLogWrapper;
export { MongooseEmailLog };
