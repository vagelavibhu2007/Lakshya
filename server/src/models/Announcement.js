const mongoose = require('mongoose');

const AUDIENCE_SCOPE = ['global', 'team', 'role'];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    scope: { type: String, enum: AUDIENCE_SCOPE, default: 'global' },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    targetRoles: [{ type: String }], // if scope=role, which roles
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pinned: { type: Boolean, default: false },
    sendEmail: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ scope: 1, createdAt: -1 });
announcementSchema.index({ teamId: 1 });
announcementSchema.index({ pinned: -1, createdAt: -1 });

const announcementReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Announcement',
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

announcementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

const Announcement = mongoose.model('Announcement', announcementSchema);
const AnnouncementRead = mongoose.model('AnnouncementRead', announcementReadSchema);
module.exports = { Announcement, AnnouncementRead, AUDIENCE_SCOPE };