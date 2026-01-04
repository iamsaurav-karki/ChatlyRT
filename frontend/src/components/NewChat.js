import React, { useState } from 'react';
import './NewChat.css';

const NewChat = ({ users, onSelectUser, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="new-chat-overlay" onClick={onClose}>
      <div className="new-chat-popup" onClick={(e) => e.stopPropagation()}>
        <div className="new-chat-header">
          <h2>New Chat</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="new-chat-search">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="new-chat-users">
          {filteredUsers.length === 0 ? (
            <div className="no-users-found">No users found</div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.user_id}
                className="new-chat-user-item"
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
              >
                <div className="new-chat-avatar">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="new-chat-user-info">
                  <div className="new-chat-username">{user.username}</div>
                  <div className="new-chat-email">{user.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChat;

