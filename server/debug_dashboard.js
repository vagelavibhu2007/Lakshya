const dns = require("node:dns/promises")
dns.setServers(["1.1.1.1"]);

require('dotenv').config();
const mongoose = require('mongoose');

const { Task } = require('./src/models/Task');
const { User } = require('./src/models/User');
const { Submission } = require('./src/models/Submission');
const { PointsLedger } = require('./src/models/PointsLedger');
const { Announcement } = require('./src/models/Announcement');
const { Resource } = require('./src/models/Resource');
const { Event } = require('./src/models/Event');
const Team = require('./src/models/Team');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const promises = [
      User.countDocuments({ isActive: true }).then(r => console.log('users', r)),
      Team.countDocuments().then(r => console.log('teams', r)),
      Task.countDocuments().then(r => console.log('tasks', r)),
      Event.countDocuments({ isActive: true }).then(r => console.log('events', r)),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).then(r => console.log('taskagg', r.length)),
      PointsLedger.aggregate([
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $lookup: { from: 'teams', localField: 'user.teamId', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$user.teamId', teamName: { $first: '$team.name' }, totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
      ]).then(r => console.log('ptsagg1', r.length)),
      PointsLedger.aggregate([
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', email: '$user.email', role: '$user.role', total: 1 } },
      ]).then(r => console.log('ptsagg2', r.length)),
      Announcement.find().sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name').then(r => console.log('anns', r.length)),
      Resource.find().sort({ createdAt: -1 }).limit(5).populate('uploadedBy', 'name').then(r => console.log('res', r.length)),
    ];

    await Promise.all(promises);

    const tasksByTeam = await Task.aggregate([
      { $group: { _id: { teamId: '$teamId', status: '$status' }, count: { $sum: 1 } } },
      { $lookup: { from: 'teams', localField: '_id.teamId', foreignField: '_id', as: 'team' } },
      { $unwind: '$team' },
      { $project: { teamId: '$_id.teamId', teamName: '$team.name', status: '$_id.status', count: 1, _id: 0 } },
    ]);
    console.log('tasksByTeam', tasksByTeam.length);

    console.log('All queries succeeded');
    process.exit(0);
  } catch (err) {
    console.error('CRASH:', err);
    process.exit(1);
  }
}

test();