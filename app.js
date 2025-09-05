// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Emoji reactions
const EMOJI_REACTIONS = ['👍', '❤️', '🔥', '😘', '👎', '🤘', '💯'];

// Cache configuration
class LocalCache {
    constructor() {
        this.cachePrefix = 'datingApp_';
        this.cacheExpiry = {
            short: 1 * 60 * 1000, // 1 minute
            medium: 5 * 60 * 1000, // 5 minutes
            long: 30 * 60 * 1000 // 30 minutes
        };
    }

    set(key, data, expiryType = 'medium') {
        try {
            const item = {
                data: data,
                expiry: Date.now() + (this.cacheExpiry[expiryType] || this.cacheExpiry.medium)
            };
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(item));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    get(key) {
        try {
            const itemStr = localStorage.getItem(this.cachePrefix + key);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiry) {
                localStorage.removeItem(this.cachePrefix + key);
                return null;
            }
            return item.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.cachePrefix + key);
        } catch (error) {
            console.error('Cache remove error:', error);
        }
    }

    clear() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }
}

const cache = new LocalCache();

// State variables for reactions and replies
let selectedMessageForReaction = null;
let selectedMessageForReply = null;
let longPressTimer = null;

// Microphone Permission Popup Function
function showMicrophonePermissionPopup() {
    // Check if we've already shown the popup to this user
    if (localStorage.getItem('microphonePermissionShown')) {
        return;
    }
    
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'microphone-permission-popup';
    popup.innerHTML = `
        <div class="permission-popup-content">
            <h3>Enable Microphone Access</h3>
            <p>Would you like to enable microphone access for voice messages and notes?</p>
            <div class="permission-buttons">
                <button id="permissionDeny" class="permission-btn deny">Not Now</button>
                <button id="permissionAllow" class="permission-btn allow">Allow</button>
            </div>
        </div>
    `;
    
    // Add styles for the popup
    const styles = document.createElement('style');
    styles.textContent = `
        .microphone-permission-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .permission-popup-content {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        .permission-popup-content h3 {
            margin-bottom: 10px;
            color: var(--text-dark);
        }
        .permission-popup-content p {
            margin-bottom: 20px;
            color: var(--text-light);
        }
        .permission-buttons {
            display: flex;
            justify-content: center;
            gap: 10px;
        }
        .permission-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        .permission-btn.deny {
            background-color: #e0e0e0;
            color: #333;
        }
        .permission-btn.allow {
            background-color: var(--accent-color);
            color: white;
        }
    `;
    document.head.appendChild(styles);
    document.body.appendChild(popup);
    
    // Add event listeners to buttons
    document.getElementById('permissionAllow').addEventListener('click', async () => {
        try {
            const hasPermission = await requestMicrophonePermission();
            if (hasPermission) {
                alert('Microphone access enabled successfully!');
            } else {
                alert('Could not enable microphone access. You can enable it later in your browser settings.');
            }
        } catch (error) {
            console.error('Error enabling microphone:', error);
            alert('Error enabling microphone access. Please try again later.');
        }
        // Mark as shown and remove popup
        localStorage.setItem('microphonePermissionShown', 'true');
        document.body.removeChild(popup);
        document.head.removeChild(styles);
    });
    
    document.getElementById('permissionDeny').addEventListener('click', () => {
        // Mark as shown and remove popup
        localStorage.setItem('microphonePermissionShown', 'true');
        document.body.removeChild(popup);
        document.head.removeChild(styles);
    });
}

// Microphone Permission Handling
async function requestMicrophonePermission() {
    try {
        // Check if we already have permission
        if (navigator.permissions && navigator.permissions.query) {
            const currentPermission = await navigator.permissions.query({ name: 'microphone' });
            if (currentPermission.state === 'granted') {
                return true;
            }
        }
        
        // Request permission by trying to access the microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Immediately stop using the stream
        stream.getTracks().forEach(track => track.stop());
        
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

async function checkMicrophonePermission() {
    try {
        if (!navigator.permissions || !navigator.permissions.query) {
            return 'unknown';
        }
        
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        return permissionStatus.state;
    } catch (error) {
        console.error('Error checking microphone permission:', error);
        return 'unknown';
    }
}

// Error logging utility
function logError(error, context = '') {
    console.error(`[${new Date().toISOString()}] Error${context ? ` in ${context}` : ''}:`, error);
}

// DOM Elements
let currentPage = window.location.pathname.split('/').pop().split('.')[0];
const navToggle = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const messageCountElements = document.querySelectorAll('.message-count');

// Global variables
let currentUser = null;
let profiles = [];
let currentProfileIndex = 0;
let chatPartnerId = null;
let unsubscribeMessages = null;
let unsubscribeChat = null;
let typingTimeout = null;
let userChatPoints = 0;

// Voice recording variables
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;

// Initialize page based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Add loader styles immediately
    const style = document.createElement('style');
    style.textContent = `
        .message-loader {
            display: flex;
            justify-content: center;
            padding: 40px 0;
        }
        .dot-pulse {
            position: relative;
            width: 10px;
            height: 10px;
            border-radius: 5px;
            background-color: var(--accent-color);
            color: var(--accent-color);
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0.25s;
        }
        .dot-pulse::before, .dot-pulse::after {
            content: '';
            display: inline-block;
            position: absolute;
            top: 0;
            width: 10px;
            height: 10px;
            border-radius: 5px;
            background-color: var(--accent-color);
            color: var(--accent-color);
        }
        .dot-pulse::before {
            left: -15px;
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0s;
        }
        .dot-pulse::after {
            left: 15px;
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0.5s;
        }
        @keyframes dot-pulse {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }
        /* Voice note styles */
        .voice-note-indicator {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            background-color: var(--bg-light);
            border-radius: 20px;
            margin: 10px 0;
        }
        .voice-note-timer {
            font-size: 14px;
            color: var(--text-dark);
        }
        .voice-note-controls {
            display: flex;
            gap: 10px;
        }
        .voice-message {
            max-width: 200px;
            padding: 10px 15px;
            border-radius: 18px;
            margin: 5px 0;
            position: relative;
        }
        .voice-message.sent {
            background-color: var(--accent-color);
            color: white;
            align-self: flex-end;
        }
        .voice-message.received {
            background-color: var(--bg-light);
            color: var(--text-dark);
            align-self: flex-start;
        }
        .voice-message-controls {
            display: flex;
            align-items: center;
            margin-top: 5px;
        }
        .voice-message-play-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: 24px;
            cursor: pointer;
        }
        .voice-message-duration {
            font-size: 12px;
            margin-left: 10px;
        }
        .waveform {
            height: 30px;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .waveform-bar {
            background-color: currentColor;
            width: 3px;
            border-radius: 3px;
            animation: waveform-animation 1.5s infinite ease-in-out;
        }
        @keyframes waveform-animation {
            0%, 100% { height: 5px; }
            50% { height: 20px; }
        }
        /* Online status indicator */
        .online-status {
            position: ;
            bottom: 10px;
            right: 10px;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            border: 2px solid white;
        }
        .online-status.online {
            background-color: #00FF00;
        }
        .online-status.offline {
            background-color: #9E9E9E;
        }
        .profile-card {
            position: relative;
        }
        /* Message Reactions */
        .message-reactions {
            display: flex;
            gap: 5px;
            margin-top: 5px;
            flex-wrap: wrap;
        }
        .reaction {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 2px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        .reaction-count {
            font-size: 10px;
            color: #666;
        }
        /* Reaction Picker */
        .reaction-picker {
            position: fixed;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 24px;
            padding: 10px;
            display: flex;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 1000;
        }
        .reaction-emoji {
            font-size: 24px;
            cursor: pointer;
            transition: transform 0.2s;
            padding: 5px;
        }
        .reaction-emoji:hover {
            transform: scale(1.3);
        }
        /* Reply Preview */
        .reply-preview {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--bg-light);
            border-left: 3px solid var(--accent-color);
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .reply-preview-content {
            flex: 1;
            margin-left: 10px;
            overflow: hidden;
        }
        .reply-preview-text {
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--text-light);
        }
        .reply-preview-name {
            font-size: 12px;
            font-weight: bold;
            color: var(--accent-color);
        }
        .reply-preview-cancel {
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            font-size: 16px;
            padding: 5px;
        }
        /* Message context menu */
        .message-context-menu {
            position: absolute;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 100;
            padding: 8px 0;
            display: none;
        }
        .context-menu-item {
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        .context-menu-item:hover {
            background: #f5f5f5;
        }
        /* Swipe for reply */
        .message {
            transition: transform 0.3s ease;
            will-change: transform;
        }
        
        .message-swipe-action {
            position: absolute;
            top: 50%;
            right: 15px;
            transform: translateY(-50%);
            background: var(--accent-color);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .message.received {
            position: relative;
            overflow: visible;
        }
        .reply-indicator {
            font-size: 12px;
            color: var(--accent-color);
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .reply-indicator i {
            font-size: 10px;
        }
        .reply-message-preview {
            background: rgba(0, 0, 0, 0.05);
            border-left: 2px solid var(--accent-color);
            padding: 4px 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            font-size: 12px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `;
    document.head.appendChild(style);

    // Initialize navbar toggle for mobile
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-links').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Check auth state first before initializing page
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            updateMessageCount();
            
            // Ensure user document exists
            ensureUserDocument(user).then(() => {
                // Load user's chat points
                loadUserChatPoints();
                
                // Set up real-time listener for new messages
                setupMessageListener();
                // Set up online status for current user
                setupUserOnlineStatus();
                
                // Initialize reaction picker
                initReactionPicker();
                
                // Show microphone permission popup for new users
                if (!localStorage.getItem('microphonePermissionShown')) {
                    // Wait a bit for the page to load before showing the popup
                    setTimeout(() => {
                        showMicrophonePermissionPopup();
                    }, 2000);
                }
                
                // Initialize page-specific functions after auth is confirmed
                switch (currentPage) {
                    case 'index':
                        initLandingPage();
                        break;
                    case 'login':
                        initLoginPage();
                        break;
                    case 'signup':
                        initSignupPage();
                        break;
                    case 'mingle':
                        initMinglePage();
                        break;
                    case 'profile':
                        initProfilePage();
                        break;
                    case 'account':
                        initAccountPage();
                        break;
                    case 'chat':
                        initChatPage();
                        break;
                    case 'messages':
                        initMessagesPage();
                        break;
                    case 'dashboard':
                        initDashboardPage();
                        break;
                    case 'payment':
                        initPaymentPage();
                        break;
                    case 'admin':
                        initAdminPage();
                        break;
                }
                
                // Hide auth pages if user is logged in
                if (['login', 'signup', 'index'].includes(currentPage)) {
                    window.location.href = 'dashboard.html';
                }
            }).catch(error => {
                logError(error, 'ensuring user document');
            });
        } else {
            currentUser = null;
            // Clear user-specific cache when logging out
            cache.clear();
            // Redirect to login if on protected page
            if (['mingle', 'profile', 'account', 'chat', 'messages', 'dashboard', 'payment', 'admin'].includes(currentPage)) {
                window.location.href = 'login.html';
            } else {
                // Initialize public pages
                switch (currentPage) {
                    case 'index':
                        initLandingPage();
                        break;
                    case 'login':
                        initLoginPage();
                        break;
                    case 'signup':
                        initSignupPage();
                        break;
                }
            }
        }
    });
});

// Helper function to ensure user document exists
async function ensureUserDocument(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                profileComplete: false,
                chatPoints: 12, // Give new users 12 chat points
                paymentHistory: []
            });
        }
        return true;
    } catch (error) {
        logError(error, 'ensureUserDocument');
        throw error;
    }
}

// Load user's chat points
async function loadUserChatPoints() {
    if (!currentUser) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            userChatPoints = userSnap.data().chatPoints || 0;
            updateChatPointsDisplay();
        }
    } catch (error) {
        logError(error, 'loading chat points');
    }
}

// Update chat points display on pages
function updateChatPointsDisplay() {
    const pointsElements = document.querySelectorAll('.chat-points-display');
    pointsElements.forEach(el => {
        el.textContent = userChatPoints;
    });
}

// Deduct chat points when sending a message
async function deductChatPoint() {
    if (!currentUser) return false;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            
            if (currentPoints <= 0) {
                alert('You have no chat points left. Please purchase more to continue chatting.');
                return false;
            }
            
            await updateDoc(userRef, {
                chatPoints: currentPoints - 1
            });
            
            userChatPoints = currentPoints - 1;
            updateChatPointsDisplay();
            return true;
        }
        return false;
    } catch (error) {
        logError(error, 'deducting chat point');
        return false;
    }
}

// Add chat points (admin function)
async function addChatPoints(userId, points) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            await updateDoc(userRef, {
                chatPoints: currentPoints + points
            });
            return true;
        }
        return false;
    } catch (error) {
        logError(error, 'adding chat points');
        return false;
    }
}

// Set up online status for current user
function setupUserOnlineStatus() {
    try {
        const userStatusRef = doc(db, 'status', currentUser.uid);
        
        // Set user as online
        setDoc(userStatusRef, {
            state: 'online',
            lastChanged: serverTimestamp()
        });
        
        // Set up listener for disconnect
        const isOfflineForFirestore = {
            state: 'offline',
            lastChanged: serverTimestamp()
        };
        
        // When window closes or refreshes
        window.addEventListener('beforeunload', () => {
            setDoc(userStatusRef, isOfflineForFirestore);
        });
        
        // When internet connection is lost
        window.addEventListener('offline', () => {
            setDoc(userStatusRef, isOfflineForFirestore);
        });
    } catch (error) {
        logError(error, 'setupUserOnlineStatus');
    }
}

// Improved timestamp handling
function safeParseTimestamp(timestamp) {
    try {
        if (!timestamp) return null;
        if (typeof timestamp.toDate === 'function') return timestamp.toDate();
        if (typeof timestamp === 'number') return new Date(timestamp);
        if (typeof timestamp === 'string') return new Date(timestamp);
        return null;
    } catch (error) {
        logError(error, 'safeParseTimestamp');
        return null;
    }
}

function formatTime(timestamp) {
    const date = safeParseTimestamp(timestamp);
    if (!date) return '';
    
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ago`;
    } else if (hours > 0) {
        return `${hours}h ago`;
    } else if (minutes > 0) {
        return `${minutes}m ago`;
    } else {
        return 'Just now';
    }
}

// Initialize reaction picker
function initReactionPicker() {
    const reactionPicker = document.getElementById('reactionPicker');
    if (!reactionPicker) return;
    
    // Clear existing content
    reactionPicker.innerHTML = '';
    
    // Add emoji buttons
    EMOJI_REACTIONS.forEach(emoji => {
        const emojiButton = document.createElement('div');
        emojiButton.className = 'reaction-emoji';
        emojiButton.textContent = emoji;
        emojiButton.addEventListener('click', () => addReactionToMessage(emoji));
        reactionPicker.appendChild(emojiButton);
    });
}

// Show reaction picker for a message
function showReactionPicker(messageId, x, y) {
    const reactionPicker = document.getElementById('reactionPicker');
    if (!reactionPicker) return;
    
    selectedMessageForReaction = messageId;
    
    // Position the picker near the message
    reactionPicker.style.left = `${x}px`;
    reactionPicker.style.bottom = `${window.innerHeight - y}px`;
    reactionPicker.style.display = 'flex';
    
    // Hide picker when clicking outside
    const hidePicker = (e) => {
        if (!reactionPicker.contains(e.target)) {
            reactionPicker.style.display = 'none';
            document.removeEventListener('click', hidePicker);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', hidePicker);
    }, 10);
}

// Add reaction to a message
async function addReactionToMessage(emoji) {
    if (!selectedMessageForReaction || !currentUser || !chatPartnerId) return;
    
    try {
        // Create a combined ID for the chat thread
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        
        // Get the message reference
        const messageRef = doc(db, 'conversations', threadId, 'messages', selectedMessageForReaction);
        const messageSnap = await getDoc(messageRef);
        
        if (messageSnap.exists()) {
            const messageData = messageSnap.data();
            const reactions = messageData.reactions || {};
            
            // Check if user already reacted with this emoji
            const userReactionIndex = reactions[emoji] ? reactions[emoji].indexOf(currentUser.uid) : -1;
            
            if (userReactionIndex > -1) {
                // Remove reaction if already exists
                reactions[emoji].splice(userReactionIndex, 1);
                if (reactions[emoji].length === 0) {
                    delete reactions[emoji];
                }
            } else {
                // Add reaction
                if (!reactions[emoji]) {
                    reactions[emoji] = [];
                }
                reactions[emoji].push(currentUser.uid);
            }
            
            // Update message with new reactions
            await updateDoc(messageRef, {
                reactions: reactions
            });
            
            // Hide the reaction picker
            document.getElementById('reactionPicker').style.display = 'none';
        }
    } catch (error) {
        logError(error, 'adding reaction to message');
        alert('Error adding reaction. Please try again.');
    }
}

// Show reply preview
function showReplyPreview(message) {
    const replyPreview = document.getElementById('replyPreview');
    const replyPreviewName = document.querySelector('.reply-preview-name');
    const replyPreviewText = document.querySelector('.reply-preview-text');
    
    if (!replyPreview || !replyPreviewName || !replyPreviewText) return;
    
    selectedMessageForReply = message.id;
    
    // Set reply preview content
    const senderName = message.senderId === currentUser.uid ? 'You' : document.getElementById('chatPartnerName').textContent;
    replyPreviewName.textContent = senderName;
    
    if (message.text) {
        replyPreviewText.textContent = message.text;
    } else if (message.imageUrl) {
        replyPreviewText.textContent = '📷 Photo';
    } else if (message.audioUrl) {
        replyPreviewText.textContent = '🎤 Voice message';
    }
    
    // Show reply preview
    replyPreview.style.display = 'flex';
    
    // Focus on message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }
}

// Cancel reply
function cancelReply() {
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        replyPreview.style.display = 'none';
    }
    selectedMessageForReply = null;
}

// Handle message long press for reactions
function setupMessageLongPress() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    messagesContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const messageElement = e.target.closest('.message');
        if (messageElement) {
            const messageId = messageElement.dataset.messageId;
            if (messageId) {
                showReactionPicker(messageId, e.clientX, e.clientY);
            }
        }
    });
    
    // Add touch events for mobile
    messagesContainer.addEventListener('touchstart', (e) => {
        const messageElement = e.target.closest('.message');
        if (messageElement) {
            const messageId = messageElement.dataset.messageId;
            if (messageId) {
                longPressTimer = setTimeout(() => {
                    showReactionPicker(messageId, e.touches[0].clientX, e.touches[0].clientY);
                }, 500);
            }
        }
    });
    
    messagesContainer.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    messagesContainer.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    });
}

// Enhanced swipe functionality for reply
function setupMessageSwipe() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    let startX = 0;
    let currentX = 0;
    let currentElement = null;
    let isSwiping = false;
    
    messagesContainer.addEventListener('touchstart', (e) => {
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            startX = e.touches[0].clientX;
            currentElement = messageElement;
            isSwiping = true;
            
            // Add swipe action indicator if it doesn't exist
            if (!messageElement.querySelector('.message-swipe-action')) {
                const swipeAction = document.createElement('div');
                swipeAction.className = 'message-swipe-action';
                swipeAction.innerHTML = '<i class="fas fa-reply"></i>';
                messageElement.appendChild(swipeAction);
            }
            
            messageElement.style.transition = 'none';
        }
    });
    
    messagesContainer.addEventListener('touchmove', (e) => {
        if (!isSwiping || !currentElement) return;
        
        currentX = e.touches[0].clientX;
        const diff = startX - currentX;
        
        // Limit maximum swipe distance
        const maxSwipe = 80;
        const swipeDistance = Math.min(Math.max(-diff, -maxSwipe), 0);
        
        // Apply transform for smooth swipe
        currentElement.style.transform = `translateX(${swipeDistance}px)`;
        
        // Show/hide swipe action based on swipe distance
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) {
            const opacity = Math.min(Math.abs(swipeDistance) / maxSwipe, 1);
            swipeAction.style.opacity = opacity;
        }
    });
    
    messagesContainer.addEventListener('touchend', (e) => {
        if (!isSwiping || !currentElement) return;
        
        const diff = startX - currentX;
        const swipeThreshold = 50; // Minimum swipe distance to trigger reply
        
        if (Math.abs(diff) > swipeThreshold) {
            // Swipe was far enough - trigger reply
            const messageId = currentElement.dataset.messageId;
            // Get message data from cache or Firestore
            const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
            const message = cachedMessages.find(m => m.id === messageId);
            if (message) {
                showReplyPreview(message);
            }
        }
        
        // Animate back to original position
        currentElement.style.transition = 'transform 0.3s ease';
        currentElement.style.transform = 'translateX(0)';
        
        // Hide swipe action
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) {
            swipeAction.style.opacity = '0';
        }
        
        // Reset variables
        setTimeout(() => {
            currentElement.style.transition = '';
            isSwiping = false;
            currentElement = null;
        }, 300);
    });
    
    // Prevent scrolling while swiping
    messagesContainer.addEventListener('touchmove', (e) => {
        if (isSwiping) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Voice Note Functions
async function startRecording() {
    try {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            alert('Microphone access is required to send voice notes. Please enable microphone permissions in your browser settings.');
            return;
        }

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        // Show recording UI
        document.getElementById('voiceNoteIndicator').style.display = 'flex';
        document.getElementById('messageInput').style.display = 'none';
        
        // Start timer
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        // Handle data available
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        
        // Handle stop recording (when mouse is released)
        const stopRecordingOnRelease = () => {
            stopRecording();
            document.removeEventListener('mouseup', stopRecordingOnRelease);
        };
        
        document.addEventListener('mouseup', stopRecordingOnRelease);
    } catch (error) {
        logError(error, 'starting voice recording');
        alert('Could not access microphone. Please ensure you have granted microphone permissions.');
    }
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    document.getElementById('voiceNoteTimer').textContent = 
        `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
}

async function stopRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    // Stop all tracks in the stream
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    // Wait for the recording to finish
    await new Promise(resolve => {
        mediaRecorder.onstop = resolve;
    });
    
    // Hide recording UI
    document.getElementById('voiceNoteIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
}

async function cancelRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    // Stop all tracks in the stream
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    // Hide recording UI
    document.getElementById('voiceNoteIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
    
    // Reset variables
    mediaRecorder = null;
    audioChunks = [];
}

async function sendVoiceNote() {
    if (audioChunks.length === 0) {
        alert('No recording to send');
        return;
    }
    
    try {
        // Check if user has chat points
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            return;
        }
        
        // Create a single blob from the audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        // Show uploading state
        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-spinner fa-spin"></i> Uploading';
        document.getElementById('sendVoiceNoteBtn').disabled = true;
        
        // Upload to Cloudinary
        const audioUrl = await uploadAudioToCloudinary(audioBlob);
        
        // Calculate duration
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        
        // Add voice message to chat
        await addMessage(null, null, audioUrl, duration);
        
        // Reset recording state
        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-paper-plane"></i> Send';
        document.getElementById('sendVoiceNoteBtn').disabled = false;
        mediaRecorder = null;
        audioChunks = [];
    } catch (error) {
        logError(error, 'sending voice note');
        alert('Failed to send voice note. Please try again.');
        
        // Reset button state
        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-paper-plane"></i> Send';
        document.getElementById('sendVoiceNoteBtn').disabled = false;
    }
}

async function uploadAudioToCloudinary(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto'); // Important for audio files
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        return data.secure_url;
    } catch (error) {
        logError(error, 'uploading audio to Cloudinary');
        throw error;
    }
}

function createAudioPlayer(audioUrl, duration) {
    const audio = new Audio(audioUrl);
    const container = document.createElement('div');
    
    container.innerHTML = `
        <div class="waveform">
            ${Array(10).fill('').map((_, i) => 
                `<div class="waveform-bar" style="animation-delay: ${i * 0.1}s"></div>`
            ).join('')}
        </div>
        <div class="voice-message-controls">
            <button class="voice-message-play-btn">
                <i class="fas fa-play"></i>
            </button>
            <span class="voice-message-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span>
        </div>
    `;
    
    const playBtn = container.querySelector('.voice-message-play-btn');
    const waveformBars = container.querySelectorAll('.waveform-bar');
    
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            
            // Animate waveform while playing
            const animateWaveform = () => {
                waveformBars.forEach((bar, i) => {
                    const randomHeight = 5 + Math.random() * 15;
                    bar.style.height = `${randomHeight}px`;
                });
                
                if (!audio.paused) {
                    requestAnimationFrame(animateWaveform);
                }
            };
            
            animateWaveform();
            
            audio.onended = () => {
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                waveformBars.forEach(bar => {
                    bar.style.height = '5px';
                });
            };
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            waveformBars.forEach(bar => {
                bar.style.height = '5px';
            });
        }
    });
    
    return container;
}

// Page Initialization Functions
function initLandingPage() {
    // No specific initialization needed for landing page
}

function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('toggleLoginPassword');
    const resetPasswordLink = document.getElementById('resetPassword');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'dashboard.html';
            } catch (error) {
                logError(error, 'login');
                alert(error.message);
            }
        });
    }

    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('loginPassword');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
        });
    }

    if (resetPasswordLink) {
        resetPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Please enter your email address:');
            if (email) {
                try {
                    await sendPasswordResetEmail(auth, email);
                    alert('Password reset email sent. Please check your inbox.');
                } catch (error) {
                    logError(error, 'resetPassword');
                    alert(error.message);
                }
            }
        });
    }
}

function initSignupPage() {
    const signupForm = document.getElementById('signupForm');
    const togglePassword = document.getElementById('toggleSignupPassword');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Create user profile in Firestore with 12 chat points
                await setDoc(doc(db, 'users', user.uid), {
                    email: email,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    profileComplete: false,
                    chatPoints: 12,
                    paymentHistory: []
                });
                
                window.location.href = 'dashboard.html';
            } catch (error) {
                logError(error, 'signup');
                alert(error.message);
            }
        });
    }

    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('signupPassword');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
        });
    }
}

function initDashboardPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const mingleBtn = document.getElementById('mingleBtn');
    const messagesBtn = document.getElementById('messagesBtn');
    const profileBtn = document.getElementById('profileBtn');
    const accountBtn = document.getElementById('accountBtn');
    const purchasePointsBtn = document.getElementById('purchasePointsBtn');

    // Load user's chat points
    loadUserChatPoints();

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout');
                alert(error.message);
            }
        });
    }

    if (mingleBtn) {
        mingleBtn.addEventListener('click', () => {
            window.location.href = 'mingle.html';
        });
    }

    if (messagesBtn) {
        messagesBtn.addEventListener('click', () => {
            window.location.href = 'messages.html';
        });
    }

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }

    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            window.location.href = 'account.html';
        });
    }

    if (purchasePointsBtn) {
        purchasePointsBtn.addEventListener('click', () => {
            window.location.href = 'payment.html';
        });
    }
}

function initPaymentPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');
    const planButtons = document.querySelectorAll('.plan-button');
    const paymentForm = document.getElementById('paymentForm');
    const copyBtns = document.querySelectorAll('.copy-btn');

    // Load user's chat points
    loadUserChatPoints();

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout');
                alert(error.message);
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }

    // Plan selection
    planButtons.forEach(button => {
        button.addEventListener('click', () => {
            planButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            document.getElementById('selectedPlan').value = button.dataset.plan;
        });
    });

    // Copy wallet address
    copyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const address = btn.dataset.address;
            navigator.clipboard.writeText(address).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        });
    });

    // Payment form submission
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const plan = document.getElementById('selectedPlan').value;
            const transactionId = document.getElementById('transactionId').value.trim();
            const email = document.getElementById('paymentEmail').value.trim();
            
            if (!plan) {
                alert('Please select a plan');
                return;
            }
            
            if (!transactionId) {
                alert('Please enter your transaction ID');
                return;
            }
            
            try {
                // Add payment to user's history using arrayUnion
                const userRef = doc(db, 'users', currentUser.uid);
                
                const paymentData = {
                    plan,
                    transactionId,
                    email,
                    status: 'pending',
                    date: new Date().toISOString() // Using client timestamp
                };
                
                await updateDoc(userRef, {
                    paymentHistory: arrayUnion(paymentData),
                    updatedAt: serverTimestamp()
                });
                
                alert('Payment submitted successfully! Our team will verify your payment and add your chat points soon.');
                paymentForm.reset();
            } catch (error) {
                logError(error, 'submitting payment');
                alert('Error submitting payment. Please try again.');
            }
        });
    }
}

function initAdminPage() {
    const loginForm = document.getElementById('adminLoginForm');
    const paymentList = document.getElementById('paymentList');
    const adminContent = document.getElementById('adminContent');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    // Check if admin is already logged in
    const isAdmin = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (isAdmin) {
        showAdminContent();
        loadPendingPayments();
    } else {
        showLoginForm();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            
            if (email === 'cypriandavidonyebuchi@gmail.com' && password === 'admin123') {
                sessionStorage.setItem('adminLoggedIn', 'true');
                showAdminContent();
                loadPendingPayments();
            } else {
                alert('Invalid admin credentials');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('adminLoggedIn');
            showLoginForm();
        });
    }

    function showLoginForm() {
        if (loginForm) loginForm.style.display = 'block';
        if (adminContent) adminContent.style.display = 'none';
    }

    function showAdminContent() {
        if (loginForm) loginForm.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
    }

    async function loadPendingPayments() {
        try {
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            
            paymentList.innerHTML = '';
            
            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                if (userData.paymentHistory && userData.paymentHistory.length > 0) {
                    const pendingPayments = userData.paymentHistory.filter(p => p.status === 'pending');
                    
                    for (const payment of pendingPayments) {
                        const paymentItem = document.createElement('div');
                        paymentItem.className = 'payment-item';
                        paymentItem.innerHTML = `
                            <div class="payment-info">
                                <p><strong>User:</strong> ${userData.email}</p>
                                <p><strong>Plan:</strong> ${payment.plan}</p>
                                <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
                                <p><strong>Date:</strong> ${formatTime(payment.date)}</p>
                            </div>
                            <div class="payment-actions">
                                <button class="approve-btn" data-user="${userDoc.id}" data-tx="${payment.transactionId}" data-plan="${payment.plan}">Approve</button>
                                <button class="reject-btn" data-user="${userDoc.id}" data-tx="${payment.transactionId}">Reject</button>
                            </div>
                        `;
                        
                        paymentList.appendChild(paymentItem);
                    }
                }
            }
            
            // Add event listeners to approve/reject buttons
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.user;
                    const txId = btn.dataset.tx;
                    const plan = btn.dataset.plan;
                    
                    try {
                        // Get user data
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            // Update payment status in the array
                            const updatedPayments = userSnap.data().paymentHistory.map(p => {
                                if (p.transactionId === txId) {
                                    return { ...p, status: 'approved' };
                                }
                                return p;
                            });
                            
                            // Determine points to add based on plan
                            let pointsToAdd = 0;
                            switch (plan) {
                                case '30_points': pointsToAdd = 30; break;
                                case '300_points': pointsToAdd = 300; break;
                                case 'lifetime': pointsToAdd = 9999; break; // Lifetime access
                            }
                            
                            // Update user document
                            await updateDoc(userRef, {
                                paymentHistory: updatedPayments,
                                chatPoints: (userSnap.data().chatPoints || 0) + pointsToAdd,
                                updatedAt: serverTimestamp()
                            });
                            
                            alert('Payment approved and points added!');
                            loadPendingPayments(); // Refresh list
                        }
                    } catch (error) {
                        logError(error, 'approving payment');
                        alert('Error approving payment');
                    }
                });
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.user;
                    const txId = btn.dataset.tx;
                    
                    try {
                        // Get user data
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            // Update payment status in the array
                            const updatedPayments = userSnap.data().paymentHistory.map(p => {
                                if (p.transactionId === txId) {
                                    return { ...p, status: 'rejected' };
                                }
                                return p;
                            });
                            
                            // Update user document
                            await updateDoc(userRef, {
                                paymentHistory: updatedPayments,
                                updatedAt: serverTimestamp()
                            });
                            
                            alert('Payment rejected!');
                            loadPendingPayments(); // Refresh list
                        }
                    } catch (error) {
                        logError(error, 'rejecting payment');
                        alert('Error rejecting payment');
                    }
                });
            });
        } catch (error) {
            logError(error, 'loading pending payments');
            paymentList.innerHTML = '<p>Error loading payments. Please try again.</p>';
        }
    }
}

function initMinglePage() {
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likeBtn = document.getElementById('likeBtn');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const chatBtn = document.getElementById('chatBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');

    // Load profiles to mingle with
    loadProfiles();

    if (dislikeBtn) {
        dislikeBtn.addEventListener('click', () => {
            showNextProfile();
        });
    }

    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            const currentProfile = profiles[currentProfileIndex];
            if (currentProfile) {
                try {
                    // Add to liked profiles
                    await addDoc(collection(db, 'users', currentUser.uid, 'liked'), {
                        userId: currentProfile.id,
                        timestamp: serverTimestamp()
                    });
                    
                    // Increment like count for the profile
                    const profileRef = doc(db, 'users', currentProfile.id);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const currentLikes = profileSnap.data().likes || 0;
                        await updateDoc(profileRef, {
                            likes: currentLikes + 1
                        });
                    }
                    
                    showNextProfile();
                } catch (error) {
                    logError(error, 'liking profile');
                    alert('Error liking profile. Please try again.');
                }
            }
        });
    }

    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            const currentProfile = profiles[currentProfileIndex];
            if (currentProfile) {
                window.location.href = `profile.html?id=${currentProfile.id}`;
            }
        });
    }

    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            const currentProfile = profiles[currentProfileIndex];
            if (currentProfile) {
                window.location.href = `chat.html?id=${currentProfile.id}`;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout');
                alert(error.message);
            }
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

function initProfilePage() {
    const backToMingle = document.getElementById('backToMingle');
    const messageProfileBtn = document.getElementById('messageProfileBtn');
    const likeProfileBtn = document.getElementById('likeProfileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const thumbnails = document.querySelectorAll('.thumbnail');

    // Load profile data from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');

    if (profileId) {
        loadProfileData(profileId);
    } else {
        window.location.href = 'mingle.html';
    }

    // Thumbnail click event
    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            document.getElementById('mainProfileImage').src = thumbnail.src;
        });
    });

    if (backToMingle) {
        backToMingle.addEventListener('click', () => {
            window.location.href = 'mingle.html';
        });
    }

    if (messageProfileBtn) {
        messageProfileBtn.addEventListener('click', () => {
            window.location.href = `chat.html?id=${profileId}`;
        });
    }

    if (likeProfileBtn) {
        likeProfileBtn.addEventListener('click', async () => {
            try {
                // Add to liked profiles
                await addDoc(collection(db, 'users', currentUser.uid, 'liked'), {
                    userId: profileId,
                    timestamp: serverTimestamp()
                });
                
                // Increment like count for the profile
                const profileRef = doc(db, 'users', profileId);
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    const currentLikes = profileSnap.data().likes || 0;
                    await updateDoc(profileRef, {
                        likes: currentLikes + 1
                    });
                    document.getElementById('viewLikeCount').textContent = currentLikes + 1;
                }
                
                likeProfileBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
                likeProfileBtn.classList.add('liked');
            } catch (error) {
                logError(error, 'liking profile from profile page');
                alert('Error liking profile. Please try again.');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout from profile page');
                alert(error.message);
            }
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

function initAccountPage() {
    const profileImageUpload = document.getElementById('profileImageUpload');
    const removeProfileImage = document.getElementById('removeProfileImage');
    const accountMenuItems = document.querySelectorAll('.menu-item');
    const addInterestBtn = document.getElementById('addInterestBtn');
    const profileForm = document.getElementById('profileForm');
    const settingsForm = document.getElementById('settingsForm');
    const privacyForm = document.getElementById('privacyForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');

    // Initialize menu tabs
    accountMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            accountMenuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.account-section').forEach(section => {
                section.style.display = 'none';
            });
            
            document.getElementById(`${item.dataset.section}Section`).style.display = 'block';
        });
    });

    // Profile image upload
    if (profileImageUpload) {
        profileImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Show loading state
                    const uploadButton = document.querySelector('.upload-button');
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                        uploadButton.disabled = true;
                    }

                    // Upload to Cloudinary
                    const imageUrl = await uploadImageToCloudinary(file);
                    
                    // Update profile image in Firestore
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        profileImage: imageUrl,
                        updatedAt: serverTimestamp()
                    });
                    
                    // Update image display
                    document.getElementById('accountProfileImage').src = imageUrl;
                    
                    // Reset button state
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Image';
                        uploadButton.disabled = false;
                    }
                } catch (error) {
                    logError(error, 'uploading profile image');
                    alert('Failed to upload image. Please check your connection and try again.');
                    
                    // Reset button state on error
                    const uploadButton = document.querySelector('.upload-button');
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Image';
                        uploadButton.disabled = false;
                    }
                }
            }
        });
    }

    if (removeProfileImage) {
        removeProfileImage.addEventListener('click', async () => {
            try {
                // Remove profile image in Firestore
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    profileImage: null,
                    updatedAt: serverTimestamp()
                });
                
                // Reset to default image
                document.getElementById('accountProfileImage').src = 'images-default-profile.jpg';
            } catch (error) {
                logError(error, 'removing profile image');
                alert('Error removing image: ' + error.message);
            }
        });
    }

    // Add interest
    if (addInterestBtn) {
        addInterestBtn.addEventListener('click', () => {
            const interestInput = document.getElementById('accountInterests');
            const interest = interestInput.value.trim();
            
            if (interest) {
                const interestsContainer = document.getElementById('accountInterestsContainer');
                const existingInterests = interestsContainer.querySelectorAll('.interest-tag');
                
                if (existingInterests.length >= 5) {
                    alert('You can only add up to 5 interests');
                    return;
                }
                
                const interestTag = document.createElement('span');
                interestTag.className = 'interest-tag';
                interestTag.textContent = interest;
                
                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = ' &times;';
                removeBtn.style.cursor = 'pointer';
                removeBtn.addEventListener('click', () => {
                    interestTag.remove();
                });
                
                interestTag.appendChild(removeBtn);
                interestsContainer.appendChild(interestTag);
                interestInput.value = '';
            }
        });
    }

    // Profile form submission
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('accountName').value;
            const age = document.getElementById('accountAge').value;
            const gender = document.getElementById('accountGender').value;
            const location = document.getElementById('accountLocation').value;
            const bio = document.getElementById('accountBio').value;
            const phone = document.getElementById('accountPhone').value;
            
            const interestsContainer = document.getElementById('accountInterestsContainer');
            const interests = Array.from(interestsContainer.querySelectorAll('.interest-tag')).map(tag => 
                tag.textContent.replace(' ×', '')
            );
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    name,
                    age: parseInt(age),
                    gender,
                    location,
                    bio,
                    phone: phone || null,
                    interests,
                    profileComplete: true,
                    updatedAt: serverTimestamp()
                });
                
                alert('Profile updated successfully!');
            } catch (error) {
                logError(error, 'updating profile');
                alert('Error updating profile: ' + error.message);
            }
        });
    }

    // Settings form submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            
            if (newPassword !== confirmNewPassword) {
                alert('New passwords do not match');
                return;
            }
            
            if (newPassword && !currentPassword) {
                alert('Please enter your current password');
                return;
            }
            
            try {
                if (newPassword) {
                    // In a real app, you would reauthenticate and update password
                    // This is simplified for the example
                    alert('Password change functionality would be implemented here');
                }
                
                // Clear form
                settingsForm.reset();
                alert('Settings updated successfully!');
            } catch (error) {
                logError(error, 'updating settings');
                alert('Error updating settings: ' + error.message);
            }
        });
    }

    // Privacy form submission
    if (privacyForm) {
        privacyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const showAge = document.getElementById('showAge').checked;
            const showLocation = document.getElementById('showLocation').checked;
            const showOnlineStatus = document.getElementById('showOnlineStatus').checked;
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    privacySettings: {
                        showAge,
                        showLocation,
                        showOnlineStatus
                    },
                    updatedAt: serverTimestamp()
                });
                
                alert('Privacy settings updated successfully!');
            } catch (error) {
                logError(error, 'updating privacy settings');
                alert('Error updating privacy settings: ' + error.message);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout from account page');
                alert(error.message);
            }
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

function initChatPage() {
    const backToMessages = document.getElementById('backToMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const imageUpload = document.getElementById('imageUpload');
    const voiceNoteBtn = document.getElementById('voiceNoteBtn');
    const voiceNoteIndicator = document.getElementById('voiceNoteIndicator');
    const voiceNoteTimer = document.getElementById('voiceNoteTimer');
    const cancelVoiceNoteBtn = document.getElementById('cancelVoiceNoteBtn');
    const sendVoiceNoteBtn = document.getElementById('sendVoiceNoteBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const cancelReplyBtn = document.getElementById('cancelReply');

    // Load chat data from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    chatPartnerId = urlParams.get('id');

    if (chatPartnerId) {
        // Try to load cached chat partner data first
        const cachedPartnerData = cache.get(`partner_${chatPartnerId}`);
        if (cachedPartnerData) {
            displayChatPartnerData(cachedPartnerData);
        } else {
            loadChatPartnerData(chatPartnerId);
        }

        // Try to load cached messages first
        const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`);
        if (cachedMessages) {
            displayCachedMessages(cachedMessages);
        } else {
            loadChatMessages(currentUser.uid, chatPartnerId);
        }
        
        setupTypingIndicator();
        setupMessageLongPress();
        setupMessageSwipe();
    } else {
        window.location.href = 'messages.html';
    }

    if (backToMessages) {
        backToMessages.addEventListener('click', () => {
            window.location.href = 'messages.html';
        });
    }

    // Send message
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // Check if user has chat points
            const hasPoints = await deductChatPoint();
            if (!hasPoints) {
                return;
            }
            
            addMessage(message);
            messageInput.value = '';
            
            // Clear reply if any
            cancelReply();
        }
    }

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Typing indicator
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            updateTypingStatus(true);
            
            // Reset after 2 seconds of no typing
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                updateTypingStatus(false);
            }, 2000);
        });
    }

    // Image attachment
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', () => {
            imageUpload.click();
        });
    }

    if (imageUpload) {
        imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Show loading state
                    const originalText = attachmentBtn.innerHTML;
                    attachmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading';
                    attachmentBtn.disabled = true;
                    
                    // Upload to Cloudinary
                    const imageUrl = await uploadImageToCloudinary(file);
                    
                    // Add image message
                    await addMessage(null, imageUrl);
                    
                    // Reset button state
                    attachmentBtn.innerHTML = originalText;
                    attachmentBtn.disabled = false;
                    
                    // Clear reply if any
                    cancelReply();
                } catch (error) {
                    logError(error, 'uploading chat image');
                    alert('Failed to upload image. Please check your connection and try again.');
                    
                    // Reset button state on error
                    attachmentBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                    attachmentBtn.disabled = false;
                }
            }
        });
    }

    // Voice note functionality
    if (voiceNoteBtn) {
        voiceNoteBtn.addEventListener('mousedown', async () => {
            const hasPermission = await requestMicrophonePermission();
            if (hasPermission) {
                startRecording();
            } else {
                alert('Microphone access is required to send voice notes. Please enable microphone permissions in your browser settings.');
            }
        });
    }

    if (cancelVoiceNoteBtn) {
        cancelVoiceNoteBtn.addEventListener('click', cancelRecording);
    }

    if (sendVoiceNoteBtn) {
        sendVoiceNoteBtn.addEventListener('click', sendVoiceNote);
    }

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout from chat page');
                alert(error.message);
            }
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

function initMessagesPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const messageSearch = document.getElementById('messageSearch');
    const dashboardBtn = document.getElementById('dashboardBtn');

    // Try to load cached message threads first
    const cachedThreads = cache.get(`threads_${currentUser.uid}`);
    if (cachedThreads) {
        renderMessageThreads(cachedThreads);
    } else {
        // Show loader immediately while we fetch fresh data
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = `
            <div class="message-loader">
                <div class="dot-pulse"></div>
            </div>
        `;
    }

    // Always load fresh data in the background
    loadMessageThreads();

    if (messageSearch) {
        messageSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const messageCards = document.querySelectorAll('.message-card');
            
            messageCards.forEach(card => {
                const name = card.querySelector('h3').textContent.toLowerCase();
                const message = card.querySelector('p').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || message.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                logError(error, 'logout from messages page');
                alert(error.message);
            }
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

// Data Loading Functions
async function loadUserData(userId) {
    // Try cache first
    const cachedData = cache.get(`user_${userId}`);
    if (cachedData) {
        updateAccountPage(cachedData);
        return cachedData;
    }

    // Fall back to network
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            cache.set(`user_${userId}`, userData, 'long');
            updateAccountPage(userData);
            return userData;
        }
        return null;
    } catch (error) {
        logError(error, 'loading user data');
        return null;
    }
}

function updateAccountPage(userData) {
    if (currentPage !== 'account') return;
    
    document.getElementById('accountName').value = userData.name || '';
    document.getElementById('accountAge').value = userData.age || '';
    document.getElementById('accountGender').value = userData.gender || 'male';
    document.getElementById('accountLocation').value = userData.location || '';
    document.getElementById('accountBio').value = userData.bio || '';
    document.getElementById('accountEmail').value = userData.email || '';
    document.getElementById('accountPhone').value = userData.phone || '';
    
    if (userData.profileImage) {
        document.getElementById('accountProfileImage').src = userData.profileImage;
    }
    
    // Load interests
    const interestsContainer = document.getElementById('accountInterestsContainer');
    interestsContainer.innerHTML = '';
    
    if (userData.interests && userData.interests.length > 0) {
        userData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = ' &times;';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => {
                interestTag.remove();
            });
            
            interestTag.appendChild(removeBtn);
            interestsContainer.appendChild(interestTag);
        });
    }
    
    // Load privacy settings
    if (userData.privacySettings) {
        document.getElementById('showAge').checked = userData.privacySettings.showAge !== false;
        document.getElementById('showLocation').checked = userData.privacySettings.showLocation !== false;
        document.getElementById('showOnlineStatus').checked = userData.privacySettings.showOnlineStatus !== false;
    }
}

async function loadProfiles() {
    // Try cache first
    const cachedProfiles = cache.get('mingle_profiles');
    if (cachedProfiles) {
        profiles = cachedProfiles;
        // Shuffle profiles when loading from cache
        shuffleProfiles();
        if (profiles.length > 0) {
            showProfile(0);
        } else {
            showNoProfilesMessage();
        }
    }

    // Always fetch fresh data in the background
    try {
        // Get all users except current user
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('__name__', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        profiles = [];
        querySnapshot.forEach(doc => {
            profiles.push({ id: doc.id, ...doc.data() });
        });
        
        // Shuffle the profiles array
        shuffleProfiles();
        
        // Cache the profiles
        cache.set('mingle_profiles', profiles, 'short');
        
        if (profiles.length > 0) {
            showProfile(0);
        } else {
            showNoProfilesMessage();
        }
    } catch (error) {
        logError(error, 'loading profiles');
        if (profiles.length === 0) {
            showNoProfilesMessage();
        }
    }
}

// Function to shuffle profiles array
function shuffleProfiles() {
    for (let i = profiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.floor(Math.random() * (i + 1)));
        [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
}

function showNoProfilesMessage() {
    document.getElementById('currentProfileImage').src = 'images/default-profile.jpg';
    document.getElementById('profileName').textContent = 'No profiles found';
    document.getElementById('profileAgeLocation').textContent = '';
    document.getElementById('profileBio').textContent = 'Check back later for new profiles';
}

function showProfile(index) {
    if (index >= 0 && index < profiles.length) {
        currentProfileIndex = index;
        const profile = profiles[index];
        
        document.getElementById('currentProfileImage').src = profile.profileImage || 'images-default-profile.jpg';
        document.getElementById('profileName').textContent = profile.name || 'Unknown';
        
        let ageLocation = '';
        if (profile.age) ageLocation += `${profile.age} • `;
        if (profile.location) ageLocation += profile.location;
        document.getElementById('profileAgeLocation').textContent = ageLocation;
        
        document.getElementById('profileBio').textContent = profile.bio || 'No bio available';
        document.getElementById('likeCount').textContent = profile.likes || 0;
        
        // Update online status indicator
        updateProfileOnlineStatus(profile.id);
    }
}

function updateProfileOnlineStatus(userId) {
    const statusRef = doc(db, 'status', userId);
    
    onSnapshot(statusRef, (doc) => {
        const status = doc.data()?.state || 'offline';
        const statusIndicator = document.getElementById('profileStatusIndicator');
        
        if (statusIndicator) {
            statusIndicator.className = `online-status ${status}`;
        }
    });
}

function showNextProfile() {
    if (currentProfileIndex < profiles.length - 1) {
        showProfile(currentProfileIndex + 1);
    } else {
        // Reached end of profiles
        showNoProfilesMessage();
    }
}

async function loadProfileData(profileId) {
    // Try cache first
    const cachedProfile = cache.get(`profile_${profileId}`);
    if (cachedProfile) {
        displayProfileData(cachedProfile);
    }

    // Always fetch fresh data
    try {
        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            // Cache the profile data
            cache.set(`profile_${profileId}`, profileData, 'medium');
            displayProfileData(profileData);
            
            // Check if already liked
            const likedRef = collection(db, 'users', currentUser.uid, 'liked');
            const likedQuery = query(likedRef, where('userId', '==', profileId));
            const likedSnap = await getDocs(likedQuery);
            
            if (!likedSnap.empty) {
                document.getElementById('likeProfileBtn').innerHTML = '<i class="fas fa-heart"></i> Liked';
                document.getElementById('likeProfileBtn').classList.add('liked');
            }
            
            // Set up online status listener
            setupOnlineStatusListener(profileId);
        } else {
            window.location.href = 'mingle.html';
        }
    } catch (error) {
        logError(error, 'loading profile data');
        window.location.href = 'mingle.html';
    }
}

function displayProfileData(profileData) {
    document.getElementById('mainProfileImage').src = profileData.profileImage || 'images-default-profile.jpg';
    document.querySelectorAll('.thumbnail')[0].src = profileData.profileImage || 'images-default-profile.jpg';
    document.getElementById('viewProfileName').textContent = profileData.name || 'Unknown';
    
    let ageText = '';
    if (profileData.age) ageText = `${profileData.age}`;
    document.getElementById('viewProfileAge').textContent = ageText;
    
    if (profileData.location) {
        document.getElementById('viewProfileLocation').textContent = profileData.location;
    } else {
        document.getElementById('viewProfileLocation').textContent = '';
    }
    
    document.getElementById('viewProfileBio').textContent = profileData.bio || 'No bio available';
    document.getElementById('viewLikeCount').textContent = profileData.likes || 0;
    
    // Load interests
    const interestsContainer = document.getElementById('interestsContainer');
    interestsContainer.innerHTML = '';
    
    if (profileData.interests && profileData.interests.length > 0) {
        profileData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            interestsContainer.appendChild(interestTag);
        });
    }
    
    // Add online status indicator to profile image
    const profileImageContainer = document.querySelector('.profile-image-container');
    if (profileImageContainer) {
        // Remove existing status indicator if any
        const existingIndicator = profileImageContainer.querySelector('.online-status');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'profileStatusIndicator';
        statusIndicator.className = 'online-status';
        profileImageContainer.appendChild(statusIndicator);
        
        // Set up online status listener
        setupOnlineStatusListener(profileData.id, 'profileStatusIndicator');
    }
}

async function loadChatPartnerData(partnerId) {
    try {
        const partnerRef = doc(db, 'users', partnerId);
        const partnerSnap = await getDoc(partnerRef);
        
        if (partnerSnap.exists()) {
            const partnerData = partnerSnap.data();
            // Cache the partner data
            cache.set(`partner_${partnerId}`, partnerData, 'medium');
            displayChatPartnerData(partnerData);
            
            // Set up online status listener
            setupOnlineStatusListener(partnerId, 'chatPartnerStatus');
        }
    } catch (error) {
        logError(error, 'loading chat partner data');
    }
}

function displayChatPartnerData(partnerData) {
    document.getElementById('chatPartnerImage').src = partnerData.profileImage || 'images-default-profile.jpg';
    document.getElementById('chatPartnerName').textContent = partnerData.name || 'Unknown';
}

function loadChatMessages(userId, partnerId) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    // Create a combined ID for the chat thread
    const threadId = [userId, partnerId].sort().join('_');
    
    // Listen for new messages (simplified query)
    unsubscribeChat = onSnapshot(
        collection(db, 'conversations', threadId, 'messages'),
        (snapshot) => {
            const messages = [];
            
            // Sort messages client-side by timestamp
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ref: doc.ref, ...doc.data() });
            });
            
            messages.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (new Date(a.timestamp)).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (new Date(b.timestamp)).getTime();
                return timeA - timeB;
            });
            
            // Cache the messages
            cache.set(`messages_${userId}_${partnerId}`, messages, 'short');
            
            // Display messages
            messagesContainer.innerHTML = '';
            messages.forEach(message => {
                displayMessage(message, userId);
                
                // Mark as read if it's the current user's chat
                if (message.senderId === partnerId && !message.read) {
                    markMessageAsRead(message.ref);
                }
            });
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    );
}

function displayCachedMessages(messages) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    messages.forEach(message => {
        displayMessage(message, currentUser.uid);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayMessage(message, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    let messageContent = '';
    
    // Add reply indicator if this is a reply
    if (message.replyTo) {
        const repliedMessage = getRepliedMessage(message.replyTo);
        if (repliedMessage) {
            const senderName = repliedMessage.senderId === currentUserId ? 'You' : document.getElementById('chatPartnerName').textContent;
            let previewText = '';
            
            if (repliedMessage.text) {
                previewText = repliedMessage.text;
            } else if (repliedMessage.imageUrl) {
                previewText = '📷 Photo';
            } else if (repliedMessage.audioUrl) {
                previewText = '🎤 Voice message';
            }
            
            messageContent += `
                <div class="reply-indicator">
                    <i class="fas fa-reply"></i> Replying to ${senderName}
                </div>
                <div class="reply-message-preview">${previewText}</div>
            `;
        }
    }
    
    if (message.imageUrl) {
        messageContent += `
            <img src="${message.imageUrl}" alt="Message image" class="message-image">
        `;
    } else if (message.audioUrl) {
        // Voice message
        const voiceMessageDiv = document.createElement('div');
        voiceMessageDiv.className = `voice-message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
        
        const audioPlayer = createAudioPlayer(message.audioUrl, message.duration || 0);
        voiceMessageDiv.appendChild(audioPlayer);
        
        messageDiv.appendChild(voiceMessageDiv);
    } else if (message.text) {
        messageContent += `<p>${message.text}</p>`;
    }
    
    // Add reactions if any
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        messageContent += `<div class="message-reactions">`;
        for (const [emoji, users] of Object.entries(message.reactions)) {
            messageContent += `<span class="reaction">${emoji} <span class="reaction-count">${users.length}</span></span>`;
        }
        messageContent += `</div>`;
    }
    
    // Add timestamp
    messageContent += `<span class="message-time">${formatTime(message.timestamp)} 
        ${message.senderId === currentUserId && message.read ? '✓✓' : ''}
    </span>`;
    
    messageDiv.innerHTML = messageContent;
    messagesContainer.appendChild(messageDiv);
}

function getRepliedMessage(messageId) {
    const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
    return cachedMessages.find(m => m.id === messageId);
}

async function addMessage(text, imageUrl = null, audioUrl = null, duration = null) {
    if (!text && !imageUrl && !audioUrl) return;
    
    try {
        // Create a combined ID for the chat thread
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        
        const messageData = {
            senderId: currentUser.uid,
            text: text || null,
            imageUrl: imageUrl || null,
            audioUrl: audioUrl || null,
            duration: duration || null,
            read: false,
            timestamp: serverTimestamp()
        };
        
        // Add replyTo if replying to a message
        if (selectedMessageForReply) {
            messageData.replyTo = selectedMessageForReply;
        }
        
        // Add message to Firestore
        await addDoc(collection(db, 'conversations', threadId, 'messages'), messageData);
        
        // Update the conversation document
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: {
                text: text || (imageUrl ? 'Image' : (audioUrl ? 'Voice message' : 'Message')),
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Clear reply after sending
        cancelReply();
    } catch (error) {
        logError(error, 'adding message');
        alert('Error sending message. Please try again.');
    }
}

async function markMessageAsRead(messageRef) {
    try {
        await updateDoc(messageRef, {
            read: true
        });
    } catch (error) {
        logError(error, 'marking message as read');
    }
}

async function loadMessageThreads() {
    const messagesList = document.getElementById('messagesList');
    
    try {
        // Get all conversations where user is a participant
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        unsubscribeMessages = onSnapshot(threadsQuery, async (snapshot) => {
            const threads = [];
            
            // First collect all thread data
            snapshot.forEach(doc => {
                threads.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort threads client-side by lastMessageTime
            threads.sort((a, b) => {
                const timeA = a.lastMessage?.timestamp?.toMillis ? a.lastMessage.timestamp.toMillis() : (new Date(a.lastMessage?.timestamp)).getTime();
                const timeB = b.lastMessage?.timestamp?.toMillis ? b.lastMessage.timestamp.toMillis() : (new Date(b.lastMessage?.timestamp)).getTime();
                return (timeB || 0) - (timeA || 0);
            });
            
            // Now load partner data and unread counts
            const threadsWithData = [];
            let totalUnread = 0;
            
            for (const thread of threads) {
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                if (!partnerId) continue;
                
                try {
                    // Get partner profile
                    const partnerRef = doc(db, 'users', partnerId);
                    const partnerSnap = await getDoc(partnerRef);
                    
                    if (!partnerSnap.exists()) continue;
                    
                    // Get unread count
                    let unreadCount = 0;
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', thread.id, 'messages'),
                            orderBy('timestamp', 'desc'),
                            limit(20)
                        );
                        const messagesSnap = await getDocs(messagesQuery);
                        
                        messagesSnap.forEach(doc => {
                            const message = doc.data();
                            if (message.senderId === partnerId && !message.read) {
                                unreadCount++;
                            }
                        });
                    } catch (error) {
                        logError(error, 'getting unread count');
                    }
                    
                    totalUnread += unreadCount;
                    
                    threadsWithData.push({
                        ...thread,
                        partnerData: partnerSnap.data(),
                        unreadCount
                    });
                } catch (error) {
                    logError(error, 'loading thread data');
                }
            }
            
            // Cache the threads
            cache.set(`threads_${currentUser.uid}`, threadsWithData, 'short');
            
            // Render all threads
            renderMessageThreads(threadsWithData);
            updateMessageCount(totalUnread);
        });
    } catch (error) {
        logError(error, 'loading message threads');
        messagesList.innerHTML = '<p class="no-messages">Error loading messages. Please refresh the page.</p>';
    }
}

function renderMessageThreads(threads) {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    if (threads.length === 0) {
        messagesList.innerHTML = '<p class="no-messages">No messages yet. Start mingling!</p>';
        return;
    }
    
    threads.forEach(thread => {
        const messageCard = document.createElement('div');
        messageCard.className = 'message-card';
        
        // Truncate message preview to 3 words
        let messagePreview = thread.lastMessage?.text || 'New match';
        if (messagePreview.split(' ').length > 3) {
            messagePreview = messagePreview.split(' ').slice(0, 3).join(' ') + '...';
        }
        
        const messageTime = thread.lastMessage?.timestamp 
            ? formatTime(thread.lastMessage.timestamp)
            : '';
        
        messageCard.innerHTML = `
            <img src="${thread.partnerData.profileImage || 'images-default-profile.jpg'}" 
                 alt="${thread.partnerData.name}">
            <div class="message-content">
                <h3>${thread.partnerData.name || 'Unknown'} 
                    <span class="message-time">${messageTime}</span>
                </h3>
                <p>${messagePreview}</p>
            </div>
            ${thread.unreadCount > 0 ? `<span class="unread-count">${thread.unreadCount}</span>` : ''}
            <div class="online-status" id="status-${thread.participants.find(id => id !== currentUser.uid)}">
                <i class="fas fa-circle"></i>
            </div>
        `;
        
        messageCard.addEventListener('click', () => {
            window.location.href = `chat.html?id=${
                thread.participants.find(id => id !== currentUser.uid)
            }`;
        });
        
        messagesList.appendChild(messageCard);
        
        // Set up online status listener for each thread
        const partnerId = thread.participants.find(id => id !== currentUser.uid);
        if (partnerId) {
            setupOnlineStatusListener(partnerId, `status-${partnerId}`);
        }
    });
}

function setupTypingIndicator() {
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);
        
        // Listen for partner's typing status
        onSnapshot(typingRef, (doc) => {
            const typingData = doc.data();
            const typingIndicator = document.getElementById('typingIndicator');
            
            if (typingData && typingData[chatPartnerId]) {
                document.getElementById('partnerNameTyping').textContent = 
                    document.getElementById('chatPartnerName').textContent;
                typingIndicator.style.display = 'block';
            } else {
                typingIndicator.style.display = 'none';
            }
        });
    } catch (error) {
        logError(error, 'setting up typing indicator');
    }
}

async function updateTypingStatus(isTyping) {
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);
        
        await setDoc(typingRef, {
            [currentUser.uid]: isTyping
        }, { merge: true });
    } catch (error) {
        logError(error, 'updating typing status');
    }
}

function setupOnlineStatusListener(userId, elementId = 'onlineStatus') {
    try {
        const statusRef = doc(db, 'status', userId);
        
        onSnapshot(statusRef, (doc) => {
            const status = doc.data()?.state || 'offline';
            const element = document.getElementById(elementId);
            
            if (element) {
                if (status === 'online') {
                    element.innerHTML = '<i class="fas fa-circle"></i>';
                    element.style.color = 'var(--accent-color)';
                } else {
                    element.innerHTML = '<i class="far fa-circle"></i>';
                    element.style.color = 'var(--text-light)';
                }
            }
        });
    } catch (error) {
        logError(error, 'setting up online status listener');
    }
}

async function setupMessageListener() {
    try {
        // Listen for new messages to update the count
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        onSnapshot(threadsQuery, async (snapshot) => {
            let totalUnread = 0;
            
            for (const doc of snapshot.docs) {
                const thread = doc.data();
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                
                if (partnerId) {
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', doc.id, 'messages'),
                            orderBy('timestamp', 'desc'),
                            limit(20)
                        );
                        const messagesSnap = await getDocs(messagesQuery);
                        
                        messagesSnap.forEach(messageDoc => {
                            const message = messageDoc.data();
                            if (message.senderId === partnerId && !message.read) {
                                totalUnread++;
                            }
                        });
                    } catch (error) {
                        logError(error, 'getting unread count in message listener');
                    }
                }
            }
            
            updateMessageCount(totalUnread);
        });
    } catch (error) {
        logError(error, 'setting up message listener');
    }
}

function updateMessageCount(count) {
    messageCountElements.forEach(element => {
        if (count > 0) {
            element.textContent = count;
            element.style.display = 'flex';
        } else {
            element.style.display = 'none';
        }
    });
}

async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    try {
        // First check if we have a valid connection
        if (!navigator.onLine) {
            throw new Error('No internet connection available');
        }

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, 
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        return data.secure_url;
    } catch (error) {
        logError(error, 'uploading image to Cloudinary');
        throw new Error('Failed to upload image. Please check your connection and try again.');
    }
}

// Clean up listeners when leaving page
window.addEventListener('beforeunload', () => {
    try {
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeChat) unsubscribeChat();
        
        // Stop any ongoing recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        // Clear recording timer
        if (recordingTimer) {
            clearInterval(recordingTimer);
        }
        
        // Clear long press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
        
        // Set user as offline when leaving
        if (currentUser) {
            const userStatusRef = doc(db, 'status', currentUser.uid);
            setDoc(userStatusRef, {
                state: 'offline',
                lastChanged: serverTimestamp()
            });
        }
    } catch (error) {
        logError(error, 'beforeunload cleanup');
    }
});