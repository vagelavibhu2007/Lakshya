const mongoose = require('mongoose');

const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUS = ['pending', 'in_progress', 'completed', 'cancelled', 'overdue'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    
    // Task assignment
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Task scheduling
    deadline: { type: Date, required: true },
    startDate: { type: Date, default: Date.now },
    estimatedHours: { type: Number, default: null },
    actualHours: { type: Number, default: null },
    
    // Task properties
    priority: {
      type: String,
      enum: TASK_PRIORITY,
      default: 'medium',
    },
    status: {
      type: String,
      enum: TASK_STATUS,
      default: 'pending',
    },
    
    // Task categorization
    category: { type: String, default: 'general' },
    tags: [{ type: String, trim: true }],
    
    // Task resources
    attachments: [{
      filename: { type: String, required: true },
      url: { type: String, required: true },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      uploadedAt: { type: Date, default: Date.now },
    }],
    
    // Task completion
    completionNotes: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    
    // Task visibility
    isPublic: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    
    // Task analytics
    viewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    
    // Dependencies
    dependsOn: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    }],
    
    // Recurrence
    isRecurring: { type: Boolean, default: false },
    recurrencePattern: {
      type: { type: String, enum: ['daily', 'weekly', 'monthly'], default: null },
      interval: { type: Number, default: 1 },
      endDate: { type: Date, default: null },
    },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Enhanced indexes for performance
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ teamId: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ isActive: 1 });
taskSchema.index({ createdAt: -1 });

// Compound indexes for common queries
taskSchema.index({ teamId: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ teamId: 1, priority: 1, status: 1 });

// Virtual for is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return new Date() > this.deadline;
});

// Virtual for days until deadline
taskSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion percentage
taskSchema.virtual('completionPercentage').get(function() {
  switch (this.status) {
    case 'completed': return 100;
    case 'in_progress': return 50;
    case 'pending': return 0;
    default: return 0;
  }
});

// Pre-save middleware to update status based on deadline
taskSchema.pre('save', function(next) {
  if (this.isOverdue && this.status === 'pending') {
    this.status = 'overdue';
  }
  next();
});

// Static method to get tasks by priority
taskSchema.statics.getByPriority = function(teamId, priority = null) {
  const query = { teamId, isActive: true };
  if (priority) query.priority = priority;
  
  return this.find(query)
    .populate('assignedTo', 'name email avatarUrl')
    .populate('createdBy', 'name email')
    .sort({ priority: -1, deadline: 1 });
};

// Static method to get overdue tasks
taskSchema.statics.getOverdue = function(teamId = null) {
  const query = { 
    deadline: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] },
    isActive: true 
  };
  if (teamId) query.teamId = teamId;
  
  return this.find(query)
    .populate('assignedTo', 'name email avatarUrl')
    .populate('createdBy', 'name email')
    .sort({ deadline: 1 });
};

const Task = mongoose.model('Task', taskSchema);
module.exports = { Task, TASK_PRIORITY, TASK_STATUS };