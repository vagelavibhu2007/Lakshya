const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    presentMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// One record per team per day
attendanceSchema.index({ teamId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ presentMembers: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = { Attendance };