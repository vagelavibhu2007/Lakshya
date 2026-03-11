const mongoose = require('mongoose');

const SUBMISSION_STATUS = ['pending', 'verified', 'rejected'];
const PROOF_TYPE = ['file', 'link', 'text'];

const submissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    proofType: { type: String, enum: PROOF_TYPE, required: true },
    proofValue: { type: String, required: true }, // URL for file/link, text for text
    originalFileName: { type: String, default: null },
    note: { type: String, default: '' },
    status: { type: String, enum: SUBMISSION_STATUS, default: 'pending' },
    awardedPoints: { type: Number, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

submissionSchema.index({ taskId: 1, submittedBy: 1 });
submissionSchema.index({ status: 1 });

const Submission = mongoose.model('Submission', submissionSchema);
module.exports = { Submission, SUBMISSION_STATUS, PROOF_TYPE };