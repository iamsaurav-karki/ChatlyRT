const cassandra = require('../config/database');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { Uuid } = require('cassandra-driver').types;

class User {
  static async create(username, email, password) {
    const userId = require('uuid').v4();
    const hashedPassword = await hashPassword(password);
    const now = new Date();
    
    const query = 'INSERT INTO users (user_id, username, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';
    await cassandra.execute(query, [userId, username, email, hashedPassword, now, now], { prepare: true });
    
    // Return user data without token - user must login separately
    return { userId, username, email };
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ? ALLOW FILTERING';
    const result = await cassandra.execute(query, [email], { prepare: true });
    return result.first();
  }

  static async findById(userId) {
    const query = 'SELECT user_id, username, email, bio, avatar_url, created_at, updated_at FROM users WHERE user_id = ?';
    const uuid = typeof userId === 'string' ? Uuid.fromString(userId) : userId;
    const result = await cassandra.execute(query, [uuid], { prepare: true });
    return result.first();
  }

  static async findAll() {
    const query = 'SELECT user_id, username, email, bio, avatar_url, created_at FROM users';
    const result = await cassandra.execute(query, [], { prepare: true });
    return result.rows;
  }

  static async updateProfile(userId, updates) {
    const uuid = typeof userId === 'string' ? Uuid.fromString(userId) : userId;
    const fields = [];
    const values = [];
    
    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    if (updates.bio !== undefined) {
      fields.push('bio = ?');
      values.push(updates.bio || null);
    }
    if (updates.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(updates.avatar_url);
    }
    
    if (fields.length === 0) {
      return await this.findById(userId);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date());
    values.push(uuid);
    
    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
    await cassandra.execute(query, values, { prepare: true });
    
    return await this.findById(userId);
  }

  static async login(email, password) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken(user.user_id);
    return {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      token
    };
  }
}

module.exports = User;

