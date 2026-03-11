const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1"]);
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models/User');
const Team = require('./src/models/Team');
const { Task } = require('./src/models/Task');
const { Announcement } = require('./src/models/Announcement');
const { Event } = require('./src/models/Event');
const { Resource } = require('./src/models/Resource');

const TEAMS = [
  { name: 'Tech', description: 'Technology and development team', color: '#6366f1' },
  { name: 'PR & Publicity', description: 'Public relations and media outreach', color: '#ec4899' },
  { name: 'Marketing', description: 'Marketing and promotions', color: '#f59e0b' },
  { name: 'Sponsorship', description: 'Corporate sponsorships and partnerships', color: '#10b981' },
  { name: 'Graphics & Visuals', description: 'Design and visual content', color: '#8b5cf6' },
  { name: 'Production & Logistics', description: 'On-ground production and logistics', color: '#ef4444' },
  { name: 'Content & Decoration', description: 'Content planning and venue decoration', color: '#06b6d4' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Team.deleteMany({}),
      Task.deleteMany({}),
      Announcement.deleteMany({}),
      Event.deleteMany({}),
      Resource.deleteMany({}),
    ]);
    console.log('🧹 cleaned existing data');

    // Create teams
    const teams = await Team.insertMany(TEAMS);
    console.log(`✅ Created ${teams.length} teams`);

    const teamMap = {};
    teams.forEach((t) => { teamMap[t.name] = t; });

    // Create admin
    const adminHash = await bcrypt.hash('Admin@123', 12);
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@techfest.com',
      passwordHash: adminHash,
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Created admin: admin@techfest.com / Admin@123');

    // Create faculty
    const facultyHash = await bcrypt.hash('Faculty@123', 12);
    const faculty = await User.create({
      name: 'Dr. Ramesh Kumar',
      email: 'faculty@techfest.com',
      passwordHash: facultyHash,
      role: 'faculty',
      isActive: true,
    });
    console.log('✅ Created faculty: faculty@techfest.com / Faculty@123');

    // Create team leaders
    const tlHash = await bcrypt.hash('Leader@123', 12);
    const techLeader = await User.create({
      name: 'Priya Sharma',
      email: 'tl.tech@techfest.com',
      passwordHash: tlHash,
      role: 'teamleader',
      teamId: teamMap['Tech']._id,
      isActive: true,
    });
    const prLeader = await User.create({
      name: 'Arjun Mehta',
      email: 'tl.pr@techfest.com',
      passwordHash: tlHash,
      role: 'teamleader',
      teamId: teamMap['PR & Publicity']._id,
      isActive: true,
    });
    const mktLeader = await User.create({
      name: 'Sneha Patil',
      email: 'tl.mkt@techfest.com',
      passwordHash: tlHash,
      role: 'teamleader',
      teamId: teamMap['Marketing']._id,
      isActive: true,
    });

    // Assign leaders to teams
    await Team.findByIdAndUpdate(teamMap['Tech']._id, { leaderId: techLeader._id });
    await Team.findByIdAndUpdate(teamMap['PR & Publicity']._id, { leaderId: prLeader._id });
    await Team.findByIdAndUpdate(teamMap['Marketing']._id, { leaderId: mktLeader._id });
    console.log('✅ Created 3 team leaders');

    // Create members (formerly volunteers)
    const volHash = await bcrypt.hash('Vol@12345', 12);
    const volunteers = await User.insertMany([
      { name: 'Rahul Verma', email: 'vol1@techfest.com', passwordHash: volHash, role: 'member', teamId: teamMap['Tech']._id, isActive: true },
      { name: 'Anita Singh', email: 'vol2@techfest.com', passwordHash: volHash, role: 'member', teamId: teamMap['Tech']._id, isActive: true },
      { name: 'Kiran Nair', email: 'vol3@techfest.com', passwordHash: volHash, role: 'member', teamId: teamMap['PR & Publicity']._id, isActive: true },
      { name: 'Pooja Iyer', email: 'vol4@techfest.com', passwordHash: volHash, role: 'member', teamId: teamMap['Marketing']._id, isActive: true },
    ]);

    // Create CAs
    const caHash = await bcrypt.hash('CA@12345', 12);
    const campusAmbassadors = await User.insertMany([
      { name: 'Amit Shah', email: 'ca1@techfest.com', passwordHash: caHash, role: 'campus_ambassador', teamId: teamMap['PR & Publicity']._id, isActive: true },
      { name: 'Divya Reddy', email: 'ca2@techfest.com', passwordHash: caHash, role: 'campus_ambassador', teamId: teamMap['Marketing']._id, isActive: true },
    ]);
    console.log(`✅ Created ${volunteers.length} volunteers and ${campusAmbassadors.length} campus ambassadors`);

    // Create sample tasks
    const tasks = await Task.insertMany([
      {
        title: 'Setup event registration portal',
        description: 'Build and host the event registration form for Techfest 2026.',
        teamId: teamMap['Tech']._id,
        assignees: [volunteers[0]._id, volunteers[1]._id],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: 'high',
        basePoints: 50,
        status: 'open',
        createdBy: techLeader._id,
      },
      {
        title: 'Design social media banner pack',
        description: 'Create Instagram, LinkedIn and Twitter banners for Techfest 2026 launch.',
        teamId: teamMap['PR & Publicity']._id,
        assignees: [volunteers[2]._id],
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        priority: 'urgent',
        basePoints: 30,
        status: 'open',
        createdBy: prLeader._id,
      },
      {
        title: 'Draft sponsorship deck v1',
        description: 'Create the first version of the sponsorship deck with tier structure.',
        teamId: teamMap['Sponsorship']._id,
        assignees: [],
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        priority: 'high',
        basePoints: 40,
        status: 'open',
        createdBy: admin._id,
      },
      {
        title: 'Campus outreach - weekly report',
        description: 'Compile weekly report on campus ambassador activities and reach.',
        teamId: teamMap['Marketing']._id,
        assignees: [campusAmbassadors[1]._id],
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        basePoints: 20,
        status: 'open',
        createdBy: mktLeader._id,
      },
    ]);
    console.log(`✅ Created ${tasks.length} sample tasks`);

    // Create announcements
    await Announcement.insertMany([
      {
        title: '🎉 Welcome to Techfest 2026 Internal Portal!',
        body: 'Welcome everyone to our internal coordination portal. Please complete your profiles and check your assigned tasks. Let\'s make this the best fest yet!',
        scope: 'global',
        createdBy: admin._id,
        pinned: true,
      },
      {
        title: 'Tech Team Kickoff Meeting',
        body: 'All Tech team members please join the kickoff call this Saturday at 10 AM. Meeting link will be shared on WhatsApp.',
        scope: 'team',
        teamId: teamMap['Tech']._id,
        createdBy: techLeader._id,
        pinned: false,
      },
      {
        title: 'Deadline Reminder - Sponsorship Deck',
        body: 'The sponsorship deck must be ready by next Monday. Please coordinate with the design team.',
        scope: 'role',
        targetRoles: ['teamleader', 'admin'],
        createdBy: admin._id,
        pinned: false,
      },
    ]);
    console.log('✅ Created sample announcements');

    // Create sample event
    await Event.insertMany([
      {
        name: 'Hackathon 2026',
        type: 'competition',
        description: '24-hour hackathon open to all students. Theme: AI for Social Good',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        venue: 'Main Auditorium, Block C',
        capacity: 200,
        teamId: teamMap['Tech']._id,
        createdBy: admin._id,
      },
      {
        name: 'Industry Talk: Future of AI',
        type: 'talk',
        description: 'Guest lecture by a senior engineer from Google on the future of AI.',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        venue: 'Seminar Hall 2',
        capacity: 150,
        teamId: teamMap['PR & Publicity']._id,
        createdBy: admin._id,
      },
    ]);
    console.log('✅ Created sample events');

    // Create sample resource
    await Resource.create({
      title: 'Techfest 2026 Brand Kit',
      description: 'Official logo, color palette, and typography guidelines for all teams.',
      tags: ['branding', 'design', 'official'],
      type: 'text',
      value: 'Primary Color: #6366f1 (Indigo)\nSecondary Color: #ec4899 (Pink)\nLogo: Available in /assets/logo.png\nFont: Inter (Google Fonts)',
      scope: 'global',
      uploadedBy: admin._id,
    });
    console.log('✅ Created sample resource');

    console.log('\n🚀 Seed complete! Credentials:');
    console.log('  Admin:   admin@techfest.com     / Admin@123');
    console.log('  Faculty: faculty@techfest.com   / Faculty@123');
    console.log('  TL Tech: tl.tech@techfest.com   / Leader@123');
    console.log('  TL PR:   tl.pr@techfest.com     / Leader@123');
    console.log('  TL Mkt:  tl.mkt@techfest.com    / Leader@123');
    console.log('  Vol 1:   vol1@techfest.com       / Vol@12345');
    console.log('  Vol 2:   vol2@techfest.com       / Vol@12345');
    console.log('  CA 1:    ca1@techfest.com         / CA@12345');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();