const mongoose = require('mongoose');

const ANNOUNCEMENT_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const ANNOUNCEMENT_TYPE = ['general', 'urgent', 'event', 'task', 'policy', 'celebration'];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    
    // Announcement targeting
    targetAudience: [{
      type: String,
      enum: ['admin', 'teamleader', 'faculty', 'member', 'campus_ambassador', 'all'],
    }],
    targetTeams: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    }],
    targetUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    
    // Announcement properties
    priority: {
      type: String,
      enum: ANNOUNCEMENT_PRIORITY,
      default: 'medium',
    },
    type: {
      type: String,
      enum: ANNOUNCEMENT_TYPE,
      default: 'general',
    },
    
    // Author and scheduling
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    
    // Scheduling
    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    
    // Media attachments
    attachments: [{
      type: { type: String, enum: ['image', 'document', 'video', 'link'], required: true },
      url: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, default: '' },
    }],
    
    // Engagement tracking
    viewCount: { type: Number, default: 0 },
    uniqueViews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      isEdited: { type: Boolean, default: false },
      editedAt: { type: Date, default: null },
    }],
    
    // Announcement status
    isActive: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    sendEmail: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },
    
    // Tags and categorization
    tags: [{ type: String, trim: true }],
    category: { type: String, default: 'general' },
  },
  { timestamps: true }
);

// Enhanced indexes for performance
announcementSchema.index({ targetAudience: 1, targetTeams: 1, targetUsers: 1 });
announcementSchema.index({ createdBy: 1 });
announcementSchema.index({ teamId: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ type: 1 });
announcementSchema.index({ publishAt: -1 });
announcementSchema.index({ expiresAt: 1 });
announcementSchema.index({ isActive: 1 });
announcementSchema.index({ isPinned: 1 });
announcementSchema.index({ tags: 1 });
announcementSchema.index({ category: 1 });

// Compound indexes for common queries
announcementSchema.index({ isActive: 1, publishAt: -1 });
announcementSchema.index({ targetAudience: 1, isActive: 1, publishAt: -1 });
announcementSchema.index({ isPinned: 1, isActive: 1, publishAt: -1 });

// Virtual for is expired
announcementSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual for is currently visible
announcementSchema.virtual('isVisible').get(function() {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  if (new Date() < this.publishAt) return false;
  return true;
});

// Virtual for like count
announcementSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
announcementSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Instance method to check if user can view announcement
announcementSchema.methods.canUserView = function(user) {
  if (!this.isVisible) return false;
  
  // Check if user is in target users
  if (this.targetUsers.length > 0) {
    return this.targetUsers.includes(user._id);
  }
  
  // Check if user's role is in target audience
  if (this.targetAudience.includes('all') || this.targetAudience.includes(user.role)) {
    return true;
  }
  
  // Check if user's team is in target teams
  if (this.targetTeams.length > 0 && user.teamId) {
    return this.targetTeams.includes(user.teamId);
  }
  
  return false;
};

// Instance method to record view
announcementSchema.methods.recordView = function(userId) {
  if (!this.uniqueViews.includes(userId)) {
    this.uniqueViews.push(userId);
  }
  this.viewCount += 1;
  return this.save();
};

// Static method to get visible announcements for user
announcementSchema.statics.getVisibleForUser = function(user, options = {}) {
  const {
    limit = 20,
    skip = 0,
    priority = null,
    type = null,
    category = null,
    tags = null
  } = options;
  
  const query = {
    $and: [
      { isActive: true },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      },
      { publishAt: { $lte: new Date() } }
    ]
  };
  
  // Add targeting filters
  query.$and.push({
    $or: [
      { targetAudience: 'all' },
      { targetAudience: user.role },
      { targetUsers: user._id },
      { targetTeams: user.teamId }
    ]
  });
  
  // Add optional filters
  if (priority) query.priority = priority;
  if (type) query.type = type;
  if (category) query.category = category;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  return this.find(query)
    .populate('createdBy', 'name email avatarUrl')
    .populate('teamId', 'name color')
    .sort({ isPinned: -1, priority: -1, publishAt: -1 })
    .limit(limit)
    .skip(skip);
};

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = { Announcement, ANNOUNCEMENT_PRIORITY, ANNOUNCEMENT_TYPE };