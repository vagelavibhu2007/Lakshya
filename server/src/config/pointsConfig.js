/**
 * Centralised points configuration for the CA referral reward system.
 * Adjust values here to change how many points CAs earn per event type.
 */
const POINTS_CONFIG = {
  EVENT_REFERRAL: {
    flagship: 50,  // Points awarded when a referred participant joins a flagship event (e.g. Hackathon)
    regular: 10,   // Points awarded for any other event
  },
};

module.exports = { POINTS_CONFIG };