import React, { useState, useEffect, useRef } from 'react';
import { usersAPI, messagesAPI, uploadAPI, reactionsAPI } from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import Profile from './Profile';
import NewChat from './NewChat';
import ReactionPicker from './ReactionPicker';
import './Chat.css';

const Chat = ({ user, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const [deleteMenu, setDeleteMenu] = useState(null); // { messageId, x, y }
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const fileInputRef = useRef(null);

  // Keep selectedUser ref in sync
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Close sidebar on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Connect socket
    const socket = connectSocket(user.token);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      loadUsers();
    });

    socket.on('receiveMessage', (message) => {
      const currentSelectedUser = selectedUserRef.current;
      if (
        currentSelectedUser &&
        (message.senderId === currentSelectedUser.user_id ||
         message.receiverId === currentSelectedUser.user_id ||
         message.sender_id === currentSelectedUser.user_id ||
         message.receiver_id === currentSelectedUser.user_id)
      ) {
        // Normalize message data - ensure message_id is always set
        const normalizedMessage = {
          ...message,
          message_id: message.message_id || message.messageId,
          messageId: message.message_id || message.messageId,
          sender_id: message.sender_id || message.senderId,
          receiver_id: message.receiver_id || message.receiverId,
          created_at: message.created_at || message.timestamp,
          timestamp: message.created_at || message.timestamp
        };

        // Check for duplicates by message_id to prevent duplicate messages
        setMessages((prev) => {
          const newMsgId = normalizedMessage.message_id?.toString();
          
          // First check by message_id (most reliable)
          if (newMsgId && newMsgId.length > 10) {
            const existingIndex = prev.findIndex(msg => {
              const msgId = msg.message_id?.toString() || msg.messageId?.toString();
              return msgId && msgId === newMsgId;
            });
            
            if (existingIndex !== -1) {
              // Update existing message with server data (replace optimistic update)
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...normalizedMessage };
              return updated;
            }
          }
          
          // Fallback: Check by content + timestamp + sender (for messages without message_id)
          if (!newMsgId || newMsgId.length <= 10) {
            const isDuplicate = prev.some((msg) => {
              const sameContent = (msg.content || '') === (normalizedMessage.content || '');
              const sameSender = (msg.sender_id || msg.senderId) === (normalizedMessage.sender_id || normalizedMessage.senderId);
              const sameReceiver = (msg.receiver_id || msg.receiverId) === (normalizedMessage.receiver_id || normalizedMessage.receiverId);
              const sameTime = Math.abs(
                new Date(msg.created_at || msg.timestamp || 0).getTime() - 
                new Date(normalizedMessage.created_at || normalizedMessage.timestamp || 0).getTime()
              ) < 2000; // Within 2 seconds
              return sameContent && sameSender && sameReceiver && sameTime;
            });
            
            if (isDuplicate) {
              console.log('[Frontend] Duplicate message detected, skipping:', normalizedMessage);
              return prev; // Don't add duplicate
            }
          }
          
          return [...prev, normalizedMessage];
        });

        // Load reactions for the new message if it has a valid messageId
        if (normalizedMessage.message_id && normalizedMessage.message_id.length > 10) {
          loadReactions(normalizedMessage.message_id);
        }
      }
    });

    // Receive initial list of online users when connecting
    socket.on('onlineUsersList', ({ userIds }) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on('userOnline', ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    socket.on('userOffline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    socket.on('messageDeleted', ({ chatId, messageId, deleteForEveryone }) => {
      // Remove message from UI immediately
      setMessages((prev) => {
        return prev.filter(msg => {
          const msgId = msg.message_id?.toString() || msg.messageId?.toString();
          const messageIdStr = messageId?.toString();
          // Only remove if it's from the current chat
          if (selectedUserRef.current) {
            // Generate chatId the same way backend does (sorted user IDs)
            const userIds = [user.userId, selectedUserRef.current.user_id].sort();
            const currentChatId = `${userIds[0]}_${userIds[1]}`;
            if (currentChatId === chatId && msgId === messageIdStr) {
              return false; // Remove this message
            }
          }
          return true; // Keep messages from other chats
        });
      });
      setDeleteMenu(null);
    });

    return () => {
      disconnectSocket();
    };
  }, [user.token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      const usersList = response.data;
      setUsers(usersList);
      setLoading(false);
      
      // If we have a selected user from localStorage, restore it
      const savedSelectedUserId = localStorage.getItem('selectedUserId');
      if (savedSelectedUserId && !selectedUser) {
        const savedUser = usersList.find(u => u.user_id === savedSelectedUserId);
        if (savedUser) {
          setSelectedUser(savedUser);
          loadChatHistory(savedUser.user_id);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  const loadChatHistory = async (userId) => {
    try {
      console.log(`[Frontend] Loading chat history for user: ${userId}`);
      const response = await messagesAPI.getChatHistory(userId);
      const messagesData = response.data || [];
      console.log(`[Frontend] Received ${messagesData.length} messages from API`);
      
      // Remove duplicates based on message_id before setting state
      const uniqueMessages = [];
      const seenMessageIds = new Set();
      
      messagesData.forEach(msg => {
        const messageId = msg.message_id?.toString() || msg.messageId?.toString();
        if (messageId && !seenMessageIds.has(messageId)) {
          seenMessageIds.add(messageId);
          uniqueMessages.push(msg);
        } else if (!messageId) {
          // If no message_id, use content + timestamp + sender as fallback
          const fallbackKey = `${msg.content || ''}_${msg.created_at || msg.timestamp}_${msg.sender_id || msg.senderId}`;
          if (!seenMessageIds.has(fallbackKey)) {
            seenMessageIds.add(fallbackKey);
            uniqueMessages.push(msg);
          }
        }
      });
      
      console.log(`[Frontend] After deduplication: ${uniqueMessages.length} unique messages`);
      setMessages(uniqueMessages);
      
      // Load reactions for all messages (only for messages with valid message_id)
      const reactionsPromises = uniqueMessages
        .filter(msg => msg.message_id) // Only load reactions for messages with message_id
        .map(async (msg) => {
          const messageId = msg.message_id?.toString();
          if (messageId && messageId.length > 10) { // Valid UUID check
            try {
              const reactionsResponse = await reactionsAPI.getReactions(userId, messageId);
              return { messageId, reactions: reactionsResponse.data || [] };
            } catch (error) {
              // Silently fail for reactions - not all messages have reactions
              return { messageId, reactions: [] };
            }
          }
          return null;
        })
        .filter(p => p !== null);
      
      if (reactionsPromises.length > 0) {
        const reactionsResults = await Promise.all(reactionsPromises);
        const reactionsMap = {};
        reactionsResults.forEach(result => {
          if (result) {
            reactionsMap[result.messageId] = result.reactions;
          }
        });
        setMessageReactions(reactionsMap);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleUserSelect = (selectedUserData) => {
    setSelectedUser(selectedUserData);
    // Save selected user to localStorage for persistence across refreshes
    localStorage.setItem('selectedUserId', selectedUserData.user_id);
    loadChatHistory(selectedUserData.user_id);
    // Close sidebar on mobile when user is selected
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setMessages([]);
    localStorage.removeItem('selectedUserId');
    setSidebarOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;

    setUploading(true);
    try {
      const response = await uploadAPI.uploadFile(file);
      const { url, type, name } = response.data;

      const socket = getSocket();
      if (socket) {
        socket.emit('sendMessage', {
          receiverId: selectedUser.user_id,
          content: '',
          attachmentUrl: url,
          attachmentType: type,
          attachmentName: name
        });

        // Don't optimistically add message - wait for server confirmation to avoid duplicates
        // The socket will receive the message back from the server
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !uploading) || !selectedUser) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('sendMessage', {
        receiverId: selectedUser.user_id,
        content: newMessage.trim()
      });

      // Don't optimistically add message - wait for server confirmation to avoid duplicates
      // The socket will receive the message back from the server

      setNewMessage('');
    }
  };

  const handleReaction = async (messageId, reaction) => {
    if (!selectedUser || !messageId || messageId.length < 10) {
      console.warn('[handleReaction] Invalid messageId:', messageId);
      return;
    }

    const messageIdStr = messageId.toString();
    try {
      const response = await reactionsAPI.toggleReaction(
        selectedUser.user_id,
        messageIdStr,
        reaction
      );
      setMessageReactions((prev) => ({
        ...prev,
        [messageIdStr]: response.data.reactions || []
      }));
    } catch (error) {
      console.error('Reaction error:', error);
      // Don't show error to user, just log it
    }
  };

  const loadReactions = async (messageId) => {
    if (!selectedUser || messageReactions[messageId]) return;

    try {
      const response = await reactionsAPI.getReactions(
        selectedUser.user_id,
        messageId
      );
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: response.data
      }));
    } catch (error) {
      console.error('Load reactions error:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  const handleDeleteMessage = async (messageId, deleteForEveryone = false) => {
    if (!selectedUser || !messageId || messageId.length < 10) {
      console.warn('[handleDeleteMessage] Invalid messageId:', messageId);
      return;
    }

    const messageIdStr = messageId.toString();
    try {
      const socket = getSocket();
      if (socket) {
        // Optimistically remove from UI immediately
        setMessages((prev) => prev.filter(msg => {
          const msgId = msg.message_id?.toString() || msg.messageId?.toString();
          return msgId !== messageIdStr;
        }));
        setDeleteMenu(null);

        // Emit delete event to server
        socket.emit('deleteMessage', {
          receiverId: selectedUser.user_id,
          messageId: messageIdStr,
          deleteForEveryone
        });
      }
    } catch (error) {
      console.error('Delete message error:', error);
      alert('Failed to delete message');
      // Reload messages on error
      if (selectedUser) {
        loadChatHistory(selectedUser.user_id);
      }
    }
  };

  const handleMessageContextMenu = (e, messageId, isOwn) => {
    e.preventDefault();
    e.stopPropagation();
    if (!messageId || messageId.length < 10) {
      console.warn('[handleMessageContextMenu] Invalid messageId:', messageId);
      return;
    }
    
    const messageIdStr = messageId.toString();
    // Calculate position, ensuring menu stays on screen
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.max(e.clientY, 50);
    
    setDeleteMenu({
      messageId: messageIdStr,
      x,
      y,
      isOwn
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setDeleteMenu(null);
    };
    if (deleteMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [deleteMenu]);

  return (
    <div className="chat-container">
      {showProfile && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdate={() => {
            loadUsers();
            setShowProfile(false);
          }}
        />
      )}
      
      {showNewChat && (
        <NewChat
          users={users}
          onSelectUser={handleUserSelect}
          onClose={() => setShowNewChat(false)}
        />
      )}

      {showReactionPicker && (
        <ReactionPicker
          position={showReactionPicker}
          onSelect={(reaction) => {
            handleReaction(showReactionPicker.messageId, reaction);
          }}
          onClose={() => setShowReactionPicker(null)}
        />
      )}

      {deleteMenu && (
        <>
          <div 
            className="delete-menu-overlay"
            onClick={() => setDeleteMenu(null)}
          />
          <div 
            className="delete-menu"
            style={{
              position: 'fixed',
              left: `${deleteMenu.x}px`,
              top: `${deleteMenu.y}px`,
              zIndex: 3000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="delete-option"
              onClick={() => {
                handleDeleteMessage(deleteMenu.messageId, false);
                setDeleteMenu(null);
              }}
            >
              Delete for you
            </button>
            {deleteMenu.isOwn && (
              <button
                className="delete-option delete-everyone"
                onClick={() => {
                  handleDeleteMessage(deleteMenu.messageId, true);
                  setDeleteMenu(null);
                }}
              >
                Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
      {/* Mobile Menu Toggle */}
      {!selectedUser && (
        <button className="mobile-menu-toggle" onClick={toggleSidebar}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Mobile Back Button */}
      {selectedUser && (
        <button className="mobile-back-btn" onClick={handleBackToUsers}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={`chat-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="user-info" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
            {user.avatar_url ? (
              <img 
                src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${user.avatar_url}`} 
                alt={user.username}
                className="user-avatar-img"
              />
            ) : (
              <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            )}
            <div>
              <div className="user-name">{user.username}</div>
              <div className="user-status online">Online</div>
            </div>
          </div>
          <div className="sidebar-header-actions">
            <button onClick={() => setShowProfile(true)} className="profile-btn" title="Edit Profile">
              ⚙️
            </button>
            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>

        <div className="users-list">
          <div className="users-list-header">
            <h3>All Users</h3>
            <button 
              className="new-chat-btn"
              onClick={() => setShowNewChat(true)}
              title="New Chat"
            >
              +
            </button>
          </div>
          {loading ? (
            <div className="loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="no-users">No other users found</div>
          ) : (
            users.map((u) => (
              <div
                key={u.user_id}
                className={`user-item ${selectedUser?.user_id === u.user_id ? 'active' : ''}`}
                onClick={() => {
                  handleUserSelect(u);
                }}
              >
                {u.avatar_url ? (
                  <img 
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${u.avatar_url}`} 
                    alt={u.username}
                    className="user-avatar-small-img"
                  />
                ) : (
                  <div className="user-avatar-small">
                    {u.username[0].toUpperCase()}
                  </div>
                )}
                <div className="user-details">
                  <div className="user-name-small">{u.username}</div>
                  <div className="user-email-small">{u.email}</div>
                </div>
                {isUserOnline(u.user_id) && (
                  <div className="online-indicator" title="Online"></div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                {selectedUser.avatar_url ? (
                  <img 
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${selectedUser.avatar_url}`} 
                    alt={selectedUser.username}
                    className="user-avatar-medium-img"
                  />
                ) : (
                  <div className="user-avatar-medium">
                    {selectedUser.username[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="chat-user-name">{selectedUser.username}</div>
                  <div className="chat-user-status">
                    {isUserOnline(selectedUser.user_id) ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.map((msg, idx) => {
                const isOwn = msg.sender_id === user.userId || msg.senderId === user.userId;
                // Normalize messageId - prefer message_id, fallback to messageId, then index
                const messageId = (msg.message_id?.toString() || msg.messageId?.toString() || idx.toString());
                const messageIdStr = messageId.toString();
                const attachmentUrl = msg.attachment_url || msg.attachmentUrl;
                const attachmentType = msg.attachment_type || msg.attachmentType;
                const attachmentName = msg.attachment_name || msg.attachmentName;
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                const reactions = messageReactions[messageIdStr] || [];
                
                // Ensure message has valid messageId for reactions/deletion
                const hasValidMessageId = messageIdStr.length > 10 && messageIdStr !== idx.toString();

                return (
                  <div
                    key={messageIdStr || `msg-${idx}`}
                    className={`message ${isOwn ? 'own-message' : 'other-message'}`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (hasValidMessageId) {
                        handleReaction(messageIdStr, '👍');
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasValidMessageId) {
                        handleMessageContextMenu(e, messageIdStr, isOwn);
                      }
                    }}
                    onClick={() => {
                      // Close delete menu when clicking elsewhere
                      if (deleteMenu) {
                        setDeleteMenu(null);
                      }
                    }}
                  >
                    {attachmentUrl && (
                      <div className="message-attachment">
                        {attachmentType === 'image' || (attachmentType && attachmentType.startsWith('image/')) ? (
                          <img 
                            src={`${apiUrl}${attachmentUrl}`} 
                            alt={attachmentName || 'Image'} 
                            className="attachment-image"
                            onClick={() => window.open(`${apiUrl}${attachmentUrl}`, '_blank')}
                          />
                        ) : (
                          <a 
                            href={`${apiUrl}${attachmentUrl}`} 
                            download={attachmentName}
                            className="attachment-file"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            📎 {attachmentName || 'File'}
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="message-content">{msg.content}</div>
                    )}
                    {hasValidMessageId && (
                      <div className="message-reactions">
                        {reactions.length > 0 && Object.entries(
                          reactions.reduce((acc, r) => {
                            const key = r.reaction;
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(r.user_id);
                            return acc;
                          }, {})
                        ).map(([reaction, userIds]) => (
                          <button
                            key={reaction}
                            className={`reaction-btn ${userIds.includes(user.userId) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReaction(messageIdStr, reaction);
                            }}
                          >
                            {reaction} {userIds.length}
                          </button>
                        ))}
                        <button
                          className="add-reaction-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setShowReactionPicker({ 
                              messageId: messageIdStr, 
                              x: rect.left + rect.width / 2, 
                              y: rect.top 
                            });
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <div className="message-time">
                      {new Date(msg.created_at || msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-form">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="attach-btn"
                disabled={uploading}
                title="Attach file"
              >
                {uploading ? '⏳' : '📎'}
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
              />
              <button type="submit" className="send-btn" disabled={uploading}>
                {uploading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon">💬</div>
            <h2>Select a user to start chatting</h2>
            <p>Choose someone from the sidebar to begin your conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

