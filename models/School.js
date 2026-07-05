import mongoose from 'mongoose';
import { shouldExpressUseLocalDb } from '../config/db.js';
import { localSchool } from '../utils/dbStore.js';

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, unique: true, sparse: true },
  address: { type: String, default: '' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  settings: {
    pointsCap: { type: Number, default: 500 },
    allowedEmailDomains: [{ type: String }],
    enableAiSuggestions: { type: Boolean, default: true }
  }
}, { timestamps: true });

const MongooseSchool = mongoose.models.School || mongoose.model('School', SchoolSchema);

const SchoolWrapper = {
  find: async (query = {}) => shouldExpressUseLocalDb() ? localSchool.find(query) : MongooseSchool.find(query),
  findOne: async (query) => shouldExpressUseLocalDb() ? localSchool.findOne(query) : MongooseSchool.findOne(query),
  findById: async (id) => shouldExpressUseLocalDb() ? localSchool.findById(id) : MongooseSchool.findById(id),
  create: async (data) => shouldExpressUseLocalDb() ? localSchool.create(data) : MongooseSchool.create(data),
  findByIdAndUpdate: async (id, update) => shouldExpressUseLocalDb() ? localSchool.findByIdAndUpdate(id, update) : MongooseSchool.findByIdAndUpdate(id, update, { new: true }),
  schema: SchoolSchema
};

export default SchoolWrapper;
export { MongooseSchool };
