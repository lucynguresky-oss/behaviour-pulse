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
  escalatedToAdmin: { type: Boolean, default: false },
  adminStatus: { type: String, enum: ['pending_review', 'action_taken', 'archived'], default: 'pending_review' },
  adminAction: { type: String, default: '' },
  adminNotes: { type: String, default: '' },
  adminReviewedBy: { type: String, default: '' },
  adminReviewedAt: { type: String, default: '' },
}, { timestamps: true });

const MongooseBehaviorLog = mongoose.models.BehaviorLog || mongoose.model('BehaviorLog', BehaviorLogSchema);

const BehaviorLogWrapper = {
  find: async (query = {}) => shouldExpressUseLocalDb() ? localLog.find(query) : MongooseBehaviorLog.find(query).sort({ createdAt: -1 }),
  create: async (data) => shouldExpressUseLocalDb() ? localLog.create(data) : MongooseBehaviorLog.create(data),
  findByIdAndUpdate: async (id, update) => shouldExpressUseLocalDb() ? localLog.findByIdAndUpdate(id, update) : MongooseBehaviorLog.findByIdAndUpdate(id, update, { new: true }),
  schema: BehaviorLogSchema
};

export default BehaviorLogWrapper;
export { MongooseBehaviorLog };
