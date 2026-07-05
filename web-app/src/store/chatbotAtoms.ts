import { atom } from 'jotai';

// WebSocket connection status atom
export const socketStatusAtom = atom('disconnected'); // 'connecting', 'connected', 'disconnected'

// Type definitions for a message
// You can expand this with more specific types if needed
/*
 * message payload
 * @param {string} mid - unique message id
 * @param {object} payload - message content
 * @param {string} sender - 'user' | 'system'
 * @param {string} status - 'sending' | 'success' | 'failed'
 * @param {number} type - message type
 * @param {number} subType - message subType
 */
export const messagesAtom = atom([]);

// Atom for the input text in the message input bar
export const inputTextAtom = atom('');
