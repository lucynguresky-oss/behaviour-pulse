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

const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);

const UserWrapper = {
  find: async (query) => shouldExpressUseLocalDb() ? localUser.find(query) : MongooseUser.find(query),
  findOne: async (query) => shouldExpressUseLocalDb() ? localUser.findOne(query) : MongooseUser.findOne(query),
  findById: async (id) => shouldExpressUseLocalDb() ? localUser.findById(id) : MongooseUser.findById(id),
  create: async (data) => shouldExpressUseLocalDb() ? localUser.create(data) : MongooseUser.create(data),
  findByIdAndUpdate: async (id, update) => shouldExpressUseLocalDb() ? localUser.findByIdAndUpdate(id, update) : MongooseUser.findByIdAndUpdate(id, update, { new: true }),
  schema: UserSchema
};

export default UserWrapper;
export { MongooseUser };
