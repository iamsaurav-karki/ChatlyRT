import React, { useEffect, useRef } from 'react';
import './ReactionPicker.css';

const ReactionPicker = ({ position, onSelect, onClose }) => {
  const pickerRef = useRef(null);
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Calculate position to keep picker on screen
  const getPosition = () => {
    const pickerWidth = 280; // Approximate width
    const pickerHeight = 60;
    let x = position.x;
    let y = position.y - pickerHeight - 10;

    // Keep within viewport
    if (x < pickerWidth / 2) x = pickerWidth / 2;
    if (x > window.innerWidth - pickerWidth / 2) x = window.innerWidth - pickerWidth / 2;
    if (y < 10) y = position.y + 50;

    return { x, y };
  };

  const pos = getPosition();

  return (
    <div
      ref={pickerRef}
      className="reaction-picker"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`
      }}
    >
      {reactions.map((reaction) => (
        <button
          key={reaction}
          className="reaction-picker-btn"
          onClick={() => {
            onSelect(reaction);
            onClose();
          }}
        >
          {reaction}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;

