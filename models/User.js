import mongoose from 'mongoose';
import { shouldExpressUseLocalDb } from '../config/db.js';
import { localUser } from '../utils/dbStore.js';

const UserSchema = new mongoose.Schema({
  schoolId: { type: String, required: true, default: 'school-main', index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'principal', 'deputy', 'teacher', 'student'], default: 'student' },
  pointsBalance: { type: Number, default: 0 },
  className: { type: String, default: '' },
}, { timestamps: true });

UserSchema.index({ schoolId: 1, email: 1 }, { unique: true });

// Native Mongoose Model
const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);

// Unified Wrapper Interface
const UserWrapper = {
  find: async (query) => {
    if (shouldExpressUseLocalDb()) {
      return localUser.find(query);
    }
    return MongooseUser.find(query);
  },
  findOne: async (query) => {
    if (shouldExpressUseLocalDb()) {
      return localUser.findOne(query);
    }
    return MongooseUser.findOne(query);
  },
  findById: async (id) => {
    if (shouldExpressUseLocalDb()) {
      return localUser.findById(id);
    }
    return MongooseUser.findById(id);
  },
  create: async (data) => {
    if (shouldExpressUseLocalDb()) {
      return localUser.create(data);
    }
    return MongooseUser.create(data);
  },
  findByIdAndUpdate: async (id, update) => {
    if (shouldExpressUseLocalDb()) {
      return localUser.findByIdAndUpdate(id, update);
    }
    return MongooseUser.findByIdAndUpdate(id, update, { new: true });
  },
  // Expose schema if needed for inspection
  schema: UserSchema
};

export default UserWrapper;
export { MongooseUser };
