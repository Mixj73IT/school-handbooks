'use strict';

// Simple JSON-file-backed user store with bcrypt password hashing.
// Roles: "admin" (full control, manages users/years/settings) and
//        "editor" (can edit handbook content).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { USERS_DIR } = require('../config');

const usersFile = path.join(USERS_DIR, 'users.json');

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function normalizeUsername(name) {
  return String(name || '').trim().toLowerCase();
}

function findById(id) {
  return loadUsers().find((u) => u.id === id) || null;
}

function findByUsername(username) {
  const wanted = normalizeUsername(username);
  return loadUsers().find((u) => u.username === wanted) || null;
}

function createUser({ username, name, password, role }) {
  const uname = normalizeUsername(username);
  if (!uname) throw new Error('Username is required');
  if (!['admin', 'editor'].includes(role)) throw new Error('Invalid role');
  if (findByUsername(uname)) throw new Error('That username already exists');
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters');

  const user = {
    id: crypto.randomUUID(),
    username: uname,
    name: String(name || uname).trim() || uname,
    role,
    passwordHash: bcrypt.hashSync(String(password), 10),
    createdAt: new Date().toISOString(),
  };
  const users = loadUsers();
  users.push(user);
  saveUsers(users);
  return publicUser(user);
}

function updateUser(id, { name, role, password }) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');

  const admins = users.filter((u) => u.role === 'admin');
  if (role) {
    if (!['admin', 'editor'].includes(role)) throw new Error('Invalid role');
    if (user.role === 'admin' && role !== 'admin' && admins.length === 1) {
      throw new Error('Cannot demote the only admin');
    }
    user.role = role;
  }
  if (name !== undefined) user.name = String(name).trim() || user.username;
  if (password) {
    if (String(password).length < 8) throw new Error('Password must be at least 8 characters');
    user.passwordHash = bcrypt.hashSync(String(password), 10);
  }
  saveUsers(users);
  return publicUser(user);
}

function deleteUser(id) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin' && users.filter((u) => u.role === 'admin').length === 1) {
    throw new Error('Cannot delete the only admin');
  }
  saveUsers(users.filter((u) => u.id !== id));
}

function changePassword(id, currentPassword, newPassword) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');
  if (!bcrypt.compareSync(String(currentPassword || ''), user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }
  if (String(newPassword || '').length < 8) throw new Error('New password must be at least 8 characters');
  user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  saveUsers(users);
}

function verifyCredentials(username, password) {
  const user = findByUsername(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(String(password || ''), user.passwordHash);
  return ok ? publicUser(user) : null;
}

// Strip the password hash before a user object crosses into views/sessions.
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  loadUsers,
  findById,
  findByUsername,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  verifyCredentials,
  publicUser,
};
