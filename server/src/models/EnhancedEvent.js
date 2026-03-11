const mongoose = require('mongoose');

const EVENT_TYPE = ['competition', 'workshop', 'talk', 'cultural', 'fun', 'other'];
const EVENT_STATUS = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EVENT_TYPE, default: 'other' },
    status: { 
      type: String, 
      enum: EVENT_STATUS, 
      default: 'upcoming' 
    },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null }, // For multi-day events
    venue: { type: String, default: '' },
    maxParticipants: { type: Number, default: null },
    currentParticipants: { type: Number, default: 0 },
    registrationDeadline: { type: Date, default: null },
    autoCloseRegistration: { type: Boolean, default: true },
    
    // Event management
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Event resources
    documents: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, enum: ['pdf', 'image', 'link', 'other'], default: 'other' },
      },
    ],
    
    // Event settings
    isActive: { type: Boolean, default: true },
    isFlagship: { type: Boolean, default: false }, // Flagship events award more CA referral points
    isPublic: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false },
    
    // Event analytics
    viewCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    
    // Event coordinators
    coordinators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  { timestamps: true }
);

// Enhanced indexes for performance
eventSchema.index({ date: 1 });
eventSchema.index({ teamId: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ registrationDeadline: 1 });
eventSchema.index({ createdBy: 1 });

// Virtual for registration progress
eventSchema.virtual('registrationProgress').get(function() {
  if (!this.maxParticipants) return null;
  return Math.round((this.currentParticipants / this.maxParticipants) * 100);
});

// Virtual for is registration full
eventSchema.virtual('isRegistrationFull').get(function() {
  if (!this.maxParticipants) return false;
  return this.currentParticipants >= this.maxParticipants;
});

// Virtual for is registration open
eventSchema.virtual('isRegistrationOpen').get(function() {
  if (!this.isActive || this.isRegistrationFull) return false;
  if (this.registrationDeadline && new Date() > this.registrationDeadline) return false;
  if (this.autoCloseRegistration && this.isRegistrationFull) return false;
  return true;
});

// Method to check if user can register
eventSchema.methods.canUserRegister = function(userId) {
  // Check if registration is open
  if (!this.isRegistrationOpen) return false;
  
  // Check if already registered (would need EventRegistration model)
  // This is a placeholder - actual implementation would query EventRegistration
  return true;
};

// Pre-save middleware to update status based on dates
eventSchema.pre('save', function(next) {
  const now = new Date();
  
  // Auto-update status based on dates
  if (this.status !== 'cancelled') {
    if (now < this.date) {
      this.status = 'upcoming';
    } else if (!this.endDate || now <= this.endDate) {
      this.status = 'ongoing';
    } else {
      this.status = 'completed';
    }
  }
  
  next();
});

const Event = mongoose.model('Event', eventSchema);
module.exports = { Event, EVENT_TYPE, EVENT_STATUS };