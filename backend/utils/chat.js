/**
 * Generate chat_id from two user IDs
 * Format: smallerUserId_biggerUserId
 */
const generateChatId = (userId1, userId2) => {
  const ids = [userId1, userId2].sort((a, b) => a.localeCompare(b));
  return `${ids[0]}_${ids[1]}`;
};

module.exports = {
  generateChatId
};

