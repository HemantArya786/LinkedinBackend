'use strict';

/**
 * Seed script – populates MongoDB with sample users, posts, connections.
 * Run with: node src/utils/seed.js
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const Post = require('../models/Post');
const { Connection, Notification } = require('../models/index');
const logger = require('./logger');

const USERS = [
  {
    name: 'Arjun Sharma',
    email: 'arjun@example.com',
    password: 'password123',
    headline: 'Senior Software Engineer @ Google',
    bio: 'Passionate about building scalable systems. 10+ years in distributed computing.',
    interests: ['Node.js', 'Kubernetes', 'System Design'],
    role: 'user',
  },
  {
    name: 'Priya Mehta',
    email: 'priya@example.com',
    password: 'password123',
    headline: 'Product Manager @ Flipkart',
    bio: 'Turning complex problems into simple products. Love data-driven decisions.',
    interests: ['Product Strategy', 'UX Research', 'Agile'],
    role: 'user',
  },
  {
    name: 'Rahul Gupta',
    email: 'rahul@example.com',
    password: 'password123',
    headline: 'Full Stack Developer | React & Node.js',
    bio: 'Open source contributor. Building the future one commit at a time.',
    interests: ['React', 'Node.js', 'MongoDB', 'Open Source'],
    role: 'user',
  },
  {
    name: 'Anjali Singh',
    email: 'anjali@example.com',
    password: 'password123',
    headline: 'Data Scientist @ Microsoft',
    bio: 'Machine learning enthusiast. Former research associate at IIT Delhi.',
    interests: ['Machine Learning', 'Python', 'NLP', 'Statistics'],
    role: 'user',
  },
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'adminpass123',
    headline: 'Platform Administrator',
    bio: 'Platform admin.',
    interests: [],
    role: 'admin',
  },
];

const POST_CONTENTS = [
  '🚀 Excited to share that I just completed my 100th open source contribution! The journey from writing my first PR to having it merged was incredible. Every rejection taught me something new. Keep pushing! #OpenSource #SoftwareEngineering',
  'Just finished reading "Designing Data-Intensive Applications" by Martin Kleppmann. This is an absolute must-read for any backend engineer working on distributed systems. The chapter on consensus algorithms alone is worth the price. 📚 #SystemDesign #BackendDev',
  'Hot take: The most underrated skill in software engineering is knowing when NOT to write code. Sometimes the best solution is deleting code, using an existing tool, or restructuring the problem entirely. #SoftwareEngineering #Programming',
  'After 3 months of building our recommendation engine from scratch, we finally hit 99.2% accuracy on our test set! The key? A hybrid approach combining collaborative filtering with content-based signals. Thread below on our approach 🧵 #MachineLearning #DataScience',
  'Job hunting tip from someone who has been on both sides of the table: Your GitHub/portfolio matters far less than most people think. What really stands out is how you communicate your thought process. Practice explaining your decisions out loud. #CareerAdvice #JobSearch',
];

async function seed() {
  try {
    await mongoose.connect(config.mongo.uri, config.mongo.options);
    logger.info('Connected to MongoDB for seeding');

    // Clear collections
    await Promise.all([
      User.deleteMany({}),
      Post.deleteMany({}),
      Connection.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    logger.info('Cleared existing data');

    // Create users
    const createdUsers = await Promise.all(
      USERS.map(async (u) => {
        const hashed = await bcrypt.hash(u.password, 12);
        return User.create({ ...u, password: hashed });
      })
    );
    logger.info(`Created ${createdUsers.length} users`);

    // Create posts
    const posts = await Promise.all(
      POST_CONTENTS.map((content, i) =>
        Post.create({
          author: createdUsers[i % createdUsers.length]._id,
          content,
          visibility: 'public',
        })
      )
    );
    logger.info(`Created ${posts.length} posts`);

    // Create connections (first 4 users all connected)
    const connections = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        connections.push({
          senderId: createdUsers[i]._id,
          receiverId: createdUsers[j]._id,
          status: 'accepted',
        });
      }
    }
    await Connection.insertMany(connections);

    // Update connection counts
    for (let i = 0; i < 4; i++) {
      await User.findByIdAndUpdate(createdUsers[i]._id, { connectionsCount: 3 });
    }
    logger.info(`Created ${connections.length} connections`);

    // Sample notification
    await Notification.create({
      userId: createdUsers[0]._id,
      type: 'like',
      actorId: createdUsers[1]._id,
      referenceId: posts[0]._id,
      referenceType: 'post',
      message: `${createdUsers[1].name} liked your post`,
    });

    logger.info('✅  Seeding complete!');
    logger.info('\n📋  Login credentials:');
    USERS.forEach((u) => logger.info(`   ${u.email}  /  ${u.password}  [${u.role}]`));
  } catch (err) {
    logger.error('Seeding failed', { err });
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
