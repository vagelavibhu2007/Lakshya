const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    teamLeads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    color: { type: String, default: '#6366f1' }, // UI accent color per team
  },
  { timestamps: true }
);


const Team = mongoose.model('Team', teamSchema);
module.exports = Team;