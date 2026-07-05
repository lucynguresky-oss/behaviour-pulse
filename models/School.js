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

// Native Mongoose Model
const MongooseSchool = mongoose.models.School || mongoose.model('School', SchoolSchema);

// Unified Wrapper Interface
const SchoolWrapper = {
  find: async (query = {}) => {
    if (shouldExpressUseLocalDb()) {
      return localSchool.find(query);
    }
    return MongooseSchool.find(query);
  },
  findOne: async (query) => {
    if (shouldExpressUseLocalDb()) {
      return localSchool.findOne(query);
    }
    return MongooseSchool.findOne(query);
  },
  findById: async (id) => {
    if (shouldExpressUseLocalDb()) {
      return localSchool.findById(id);
    }
    return MongooseSchool.findById(id);
  },
  create: async (data) => {
    if (shouldExpressUseLocalDb()) {
      return localSchool.create(data);
    }
    return MongooseSchool.create(data);
  },
  findByIdAndUpdate: async (id, update) => {
    if (shouldExpressUseLocalDb()) {
      return localSchool.findByIdAndUpdate(id, update);
    }
    return MongooseSchool.findByIdAndUpdate(id, update, { new: true });
  },
  schema: SchoolSchema
};

export default SchoolWrapper;
export { MongooseSchool };
