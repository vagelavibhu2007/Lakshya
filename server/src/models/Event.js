const mongoose = require('mongoose');

const EVENT_TYPE = ['competition', 'workshop', 'talk', 'cultural', 'fun', 'other'];
const EVENT_STATUS = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EVENT_TYPE, default: 'other' },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    venue: { type: String, default: '' },
    // Legacy: capacity was the original field. Keep it for backward compatibility.
    capacity: { type: Number, default: null },
    // New: maxParticipants is the preferred field going forward.
    maxParticipants: { type: Number, default: null },
    // Denormalized count for quick reads (kept in sync via EventRegistration).
    currentParticipants: { type: Number, default: 0 },
    status: { type: String, enum: EVENT_STATUS, default: 'upcoming' },
    isFlagship: { type: Boolean, default: false }, // Flagship events award more CA referral points
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    documents: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ teamId: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ maxParticipants: 1 });
eventSchema.index({ currentParticipants: 1 });

// Virtual to unify capacity field across versions
eventSchema.virtual('effectiveCapacity').get(function () {
  return this.maxParticipants ?? this.capacity ?? null;
});

const Event = mongoose.model('Event', eventSchema);
module.exports = { Event, EVENT_TYPE, EVENT_STATUS };