const mongoose = require('mongoose');

const TASK_STATUS = ['open', 'submitted', 'verified', 'rejected', 'closed'];
const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deadline: { type: Date, default: null },
    priority: { type: String, enum: TASK_PRIORITY, default: 'medium' },
    basePoints: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: TASK_STATUS, default: 'open' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closeNote: { type: String, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ teamId: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ deadline: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = { Task, TASK_STATUS, TASK_PRIORITY };