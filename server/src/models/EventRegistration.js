const mongoose = require('mongoose');

const REGISTRATION_STATUS = ['registered', 'confirmed', 'cancelled', 'attended', 'no_show'];

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: REGISTRATION_STATUS,
      default: 'registered',
    },
    registeredAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    attendedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    
    // Registration metadata
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    
    // Emergency contact
    emergencyContact: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      relation: { type: String, default: null },
    },

    // CA referral tracking
    referralCode: { type: String, default: null }, // Code entered during registration
    caId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Resolved CA who owns the referral code
    },
  },
  { timestamps: true }
);

// Compound indexes for uniqueness and performance
eventRegistrationSchema.index(
  { eventId: 1, userId: 1 }, 
  { unique: true }
);
eventRegistrationSchema.index({ userId: 1 });
eventRegistrationSchema.index({ eventId: 1 });
eventRegistrationSchema.index({ status: 1 });
eventRegistrationSchema.index({ registeredAt: -1 });

// Pre-save middleware to update event participant count
eventRegistrationSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('status')) {
    const Event = mongoose.model('Event');
    const eventId = this.eventId;
    
    // Count active registrations (registered, confirmed, attended)
    const activeCount = await mongoose.model('EventRegistration').countDocuments({
      eventId: eventId,
      status: { $in: ['registered', 'confirmed', 'attended'] }
    });
    
    await Event.findByIdAndUpdate(eventId, {
      currentParticipants: activeCount
    });
  }
  next();
});

// Post-remove middleware to update event participant count
eventRegistrationSchema.post('remove', async function(doc) {
  const Event = mongoose.model('Event');
  const eventId = doc.eventId;
  
  // Count active registrations
  const activeCount = await mongoose.model('EventRegistration').countDocuments({
    eventId: eventId,
    status: { $in: ['registered', 'confirmed', 'attended'] }
  });
  
  await Event.findByIdAndUpdate(eventId, {
    currentParticipants: activeCount
  });
});

const EventRegistration = mongoose.model('EventRegistration', eventRegistrationSchema);
module.exports = { EventRegistration, REGISTRATION_STATUS };