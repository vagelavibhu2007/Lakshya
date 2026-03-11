const mongoose = require('mongoose');

const RESOURCE_TYPE = ['file', 'link', 'text'];
const RESOURCE_SCOPE = ['global', 'team', 'role'];

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    tags: [{ type: String, lowercase: true, trim: true }],
    type: { type: String, enum: RESOURCE_TYPE, required: true },
    value: { type: String, required: true }, // URL path or text snippet
    originalFileName: { type: String, default: null },
    fileMimeType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    scope: { type: String, enum: RESOURCE_SCOPE, default: 'global' },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    targetRoles: [{ type: String }],
    isCAResource: { type: Boolean, default: false },
    category: { type: String, default: 'all' },
    accessCode: { type: String, default: null },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

resourceSchema.index({ scope: 1, createdAt: -1 });
resourceSchema.index({ teamId: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' }); // text search

const Resource = mongoose.model('Resource', resourceSchema);
module.exports = { Resource, RESOURCE_TYPE, RESOURCE_SCOPE };