const { createClient } = require('redis');

let client = null;
let isConnected = false;

const connectRedis = async () => {
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
      console.error('Redis error:', err.message);
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    client.on('disconnect', () => {
      isConnected = false;
    });

    await client.connect();
    return client;
  } catch (err) {
    console.warn('⚠️  Redis not available, using fallback tracking:', err.message);
    isConnected = false;
    return null;
  }
};

/**
 * Update user's last seen timestamp
 */
const updateHeartbeat = async (userId) => {
  const timestamp = new Date().toISOString();
  if (isConnected && client) {
    await client.setEx(`heartbeat:${userId}`, 300, timestamp); // 5 min TTL
  }
  return timestamp;
};

/**
 * Get user's last seen timestamp
 */
const getLastSeen = async (userId) => {
  if (isConnected && client) {
    const ts = await client.get(`heartbeat:${userId}`);
    return ts ? new Date(ts) : null;
  }
  return null;
};

/**
 * Check if user is online (last seen < 60 seconds)
 */
const isUserOnline = async (userId) => {
  const lastSeen = await getLastSeen(userId);
  if (!lastSeen) return false;
  const diffSeconds = (Date.now() - lastSeen.getTime()) / 1000;
  return diffSeconds < 60;
};

/**
 * Store active session token
 */
const setSession = async (userId, token, expirySeconds = 86400) => {
  if (isConnected && client) {
    await client.setEx(`session:${userId}`, expirySeconds, token);
  }
};

/**
 * Invalidate user session
 */
const invalidateSession = async (userId) => {
  if (isConnected && client) {
    await client.del(`session:${userId}`);
    await client.del(`heartbeat:${userId}`);
  }
};

/**
 * Get all online users (admin view)
 */
const getOnlineUsers = async () => {
  if (!isConnected || !client) return [];
  const keys = await client.keys('heartbeat:*');
  const onlineUsers = [];
  for (const key of keys) {
    const userId = key.replace('heartbeat:', '');
    const online = await isUserOnline(userId);
    if (online) onlineUsers.push(userId);
  }
  return onlineUsers;
};

module.exports = {
  connectRedis,
  updateHeartbeat,
  getLastSeen,
  isUserOnline,
  setSession,
  invalidateSession,
  getOnlineUsers,
  getClient: () => client,
  isConnected: () => isConnected
};