import mongoose from 'mongoose';
import { shouldExpressUseLocalDb } from '../config/db.js';
import { localLog } from '../utils/dbStore.js';

const BehaviorLogSchema = new mongoose.Schema({
  schoolId: { type: String, required: true, default: 'school-main', index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pointsChange: { type: Number, required: true },
  reason: { type: String, required: true },
  parentNotified: { type: Boolean, default: false },
  
  // Administrative reports escalation features
  escalatedToAdmin: { type: Boolean, default: false },
  adminStatus: { type: String, enum: ['pending_review', 'action_taken', 'archived'], default: 'pending_review' },
  adminAction: { type: String, default: '' },
  adminNotes: { type: String, default: '' },
  adminReviewedBy: { type: String, default: '' },
  adminReviewedAt: { type: String, default: '' },
}, { timestamps: true });

// Native Mongoose Model
const MongooseBehaviorLog = mongoose.models.BehaviorLog || mongoose.model('BehaviorLog', BehaviorLogSchema);

// Unified Wrapper Interface
const BehaviorLogWrapper = {
  find: async (query = {}) => {
    if (shouldExpressUseLocalDb()) {
      return localLog.find(query);
    }
    return MongooseBehaviorLog.find(query).sort({ createdAt: -1 });
  },
  create: async (data) => {
    if (shouldExpressUseLocalDb()) {
      return localLog.create(data);
    }
    return MongooseBehaviorLog.create(data);
  },
  findByIdAndUpdate: async (id, update) => {
    if (shouldExpressUseLocalDb()) {
      return localLog.findByIdAndUpdate(id, update);
    }
    return MongooseBehaviorLog.findByIdAndUpdate(id, update, { new: true });
  },
  // Expose schema if needed for inspection
  schema: BehaviorLogSchema
};

export default BehaviorLogWrapper;
export { MongooseBehaviorLog };
