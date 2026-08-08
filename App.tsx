
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, User, Post, Comment, UserNotification, Announcement, Story, LiveStream } from './types.ts';
import Header from './components/Header.tsx';
import Navbar from './components/Navbar.tsx';
import Feed from './components/Feed.tsx';
import PostCreator from './components/PostCreator.tsx';
import Leaderboard from './components/Leaderboard.tsx';
import Chat from './components/Chat.tsx';
import Profile from './components/Profile.tsx';
import Notifications from './components/Notifications.tsx';
import Reels from './components/Reels.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import Shop from './components/Shop.tsx';
import LiveStreamModal from './components/LiveStreamModal.tsx';
import { LiveHub } from './components/LiveHub.tsx';
import { auth, db } from './firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, set, update, push, remove, Unsubscribe as DBUnsubscribe } from 'firebase/database';
import { useLanguage } from './LanguageContext.tsx';
import CallingOverlay, { ActiveCall } from './components/CallingOverlay.tsx';
import { HeadsUpNotification, IncomingMessagePayload, playChatNotificationSound } from './components/HeadsUpNotification.tsx';

// List Admin King
const ADMIN_EMAILS = ['nwaystore68@gmail.com', 'nwaystore78@gmail.com', 'nocteos609@gmail.com'];

export default function App() {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<View>(View.FEED);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('vimos_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('vimos_user');
    } catch { return true; }
  });
  const [loadingPosts, setLoadingPosts] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('vimos_posts');
      const parsed = stored ? JSON.parse(stored) : [];
      return parsed.length === 0;
    } catch { return true; }
  });
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const stored = localStorage.getItem('vimos_users');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      const stored = localStorage.getItem('vimos_posts');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const stored = localStorage.getItem('vimos_stories');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const stored = localStorage.getItem('vimos_announcements');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [bannedMessage, setBannedMessage] = useState<string | null>(null);
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);
  const [targetChatGroupId, setTargetChatGroupId] = useState<string | null>(null);
  const [initialChatMessage, setInitialChatMessage] = useState<string | null>(null);

  // Real-time Heads-Up & Audio Chat Notification States
  const [incomingChatPayload, setIncomingChatPayload] = useState<IncomingMessagePayload | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const seenChatMsgIdsRef = useRef<Set<string>>(new Set());
  const mountTimeRef = useRef<number>(Date.now());

  const requestNotifPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(perm => {
        setNotifPermission(perm);
        if (perm === 'granted') {
          playChatNotificationSound();
        }
      });
    }
  };

  // Live Stream States
  const [activeStreams, setActiveStreams] = useState<LiveStream[]>(() => {
    try {
      const stored = localStorage.getItem('vimos_active_streams');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [selectedLiveStreamId, setSelectedLiveStreamId] = useState<string | null>(null);
  const [liveModalMode, setLiveModalMode] = useState<'browse' | 'create' | 'watch'>('browse');

  const userUnsubscribeRef = useRef<DBUnsubscribe | null>(null);

  const isEmailAdmin = (email?: string | null) => {
    if (!email) return false;
    return ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
  };

  useEffect(() => {
    // Fast safety timer so user isn't stuck on loading screen
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 50);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
        userUnsubscribeRef.current = null;
      }

      if (user) {
        const isAdmin = isEmailAdmin(user.email);
        const fallbackAccountName = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
        
        // Optimistically set currentUser to avoid loading screen
        setCurrentUser(prev => {
          const updated = prev || {
            id: user.uid,
            name: fallbackAccountName,
            email: user.email || '',
            bio: 'A wandering soul in Vimos.',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}&backgroundColor=000000`,
            followers: [],
            following: [],
            recentCaptures: [],
            totalLikes: 0,
            isAdmin: isAdmin
          };
          try { localStorage.setItem('vimos_user', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setAuthLoading(false);

        const userRef = ref(db, `users/${user.uid}`);
        
        userUnsubscribeRef.current = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.isBanned) {
              setBannedMessage(t('banned_msg'));
              signOut(auth);
              try { localStorage.removeItem('vimos_user'); } catch {}
              return;
            }
            if (data.isAdmin !== isAdmin) {
              update(userRef, { isAdmin: isAdmin });
            }

            // Fix legacy Anonymous Shadow name in database if present
            const cleanName = (!data.name || data.name === 'Anonymous Shadow' || data.name === 'Anonymous')
              ? fallbackAccountName
              : data.name;

            if (cleanName !== data.name) {
              update(userRef, { name: cleanName });
            }

            const activeUserData = { 
              id: user.uid, 
              ...data,
              name: cleanName,
              isAdmin: isAdmin,
              followers: data.followers ? Object.keys(data.followers) : [],
              following: data.following ? Object.keys(data.following) : [],
              recentCaptures: data.recentCaptures ? Object.values(data.recentCaptures) : []
            };
            setCurrentUser(activeUserData);
            try { localStorage.setItem('vimos_user', JSON.stringify(activeUserData)); } catch {}
          } else {
            const newUser = {
              name: fallbackAccountName,
              email: user.email || '',
              bio: 'A wandering soul in Vimos.',
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}&backgroundColor=000000`,
              followers: {},
              following: {},
              recentCaptures: {},
              totalLikes: 0,
              isAdmin: isAdmin
            };
            set(userRef, newUser);
            const formattedUser = {
              id: user.uid,
              ...newUser,
              followers: [],
              following: [],
              recentCaptures: []
            };
            setCurrentUser(formattedUser);
            try { localStorage.setItem('vimos_user', JSON.stringify(formattedUser)); } catch {}
          }
        }, (err) => console.warn('User listener error:', err));
      } else {
        setCurrentUser(null);
        setCurrentView(View.FEED);
        setSelectedProfileId(null);
        setAuthLoading(false);
        try { localStorage.removeItem('vimos_user'); } catch {}
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (userUnsubscribeRef.current) userUnsubscribeRef.current();
    };
  }, []);

  useEffect(() => {
    const postsRef = ref(db, 'posts');
    const storiesRef = ref(db, 'stories');
    const usersRef = ref(db, 'users');
    const annRef = ref(db, 'announcements');
    const streamsRef = ref(db, 'livestreams');

    const postLoadingTimer = setTimeout(() => {
      setLoadingPosts(false);
    }, 50);

    const unsubscribeStreams = onValue(streamsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const streamList: LiveStream[] = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ id, ...val }))
          .filter((item) => item.status === 'live');
        setActiveStreams(streamList);
        try { localStorage.setItem('vimos_active_streams', JSON.stringify(streamList)); } catch {}
      } else {
        setActiveStreams([]);
        try { localStorage.removeItem('vimos_active_streams'); } catch {}
      }
    }, (err) => console.warn('Streams listener error:', err));

    const unsubscribePosts = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postList = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
          likes: val.likes ? Object.keys(val.likes) : [],
          dislikes: val.dislikes ? Object.keys(val.dislikes) : [],
          comments: val.comments ? Object.entries(val.comments).map(([cid, cval]: [string, any]) => ({ id: cid, ...cval })) : []
        }));
        const sorted = postList.sort((a, b) => b.timestamp - a.timestamp);
        setPosts(sorted);
        try { localStorage.setItem('vimos_posts', JSON.stringify(sorted.slice(0, 30))); } catch {}
      } else {
        setPosts([]);
      }
      setLoadingPosts(false);
    }, (err) => console.warn('Posts listener error:', err));

    const unsubscribeStories = onValue(storiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const validStories: Story[] = [];
        
        Object.entries(data).forEach(([id, val]: [string, any]) => {
          if (now - val.createdAt < twentyFourHours) {
            validStories.push({ id, ...val });
          } else {
            remove(ref(db, `stories/${id}`));
          }
        });
        const sorted = validStories.sort((a, b) => b.createdAt - a.createdAt);
        setStories(sorted);
        try { localStorage.setItem('vimos_stories', JSON.stringify(sorted)); } catch {}
      } else {
        setStories([]);
      }
    }, (err) => console.warn('Stories listener error:', err));

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
          followers: val.followers ? Object.keys(val.followers) : [],
          following: val.following ? Object.keys(val.following) : [],
          recentCaptures: val.recentCaptures ? Object.values(val.recentCaptures) : [],
          isAdmin: isEmailAdmin(val.email)
        }));
        setUsers(userList);
        try { localStorage.setItem('vimos_users', JSON.stringify(userList.slice(0, 50))); } catch {}
      }
    }, (err) => console.warn('Users listener error:', err));

    const unsubscribeAnn = onValue(annRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const annList = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        }));
        const sorted = annList.sort((a, b) => b.timestamp - a.timestamp);
        setAnnouncements(sorted);
        try { localStorage.setItem('vimos_announcements', JSON.stringify(sorted)); } catch {}
      } else {
        setAnnouncements([]);
      }
    }, (err) => console.warn('Announcements listener error:', err));

    return () => {
      clearTimeout(postLoadingTimer);
      unsubscribeStreams();
      unsubscribePosts();
      unsubscribeStories();
      unsubscribeUsers();
      unsubscribeAnn();
    };
  }, []);

  useEffect(() => {
    const callsRef = ref(db, 'calls');
    const unsubscribeCalls = onValue(callsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
          activeParticipants: val.activeParticipants || {}
        })) as ActiveCall[];
        setActiveCalls(list);

        if (currentUser) {
          const incomingPrivateCall = list.find(c => 
            c.type === 'private' && 
            c.receiverId === currentUser.id && 
            c.status !== 'ended'
          );

          const outgoingCall = list.find(c => 
            c.callerId === currentUser.id && 
            c.status !== 'ended'
          );

          const manuallyJoinedCall = list.find(c => 
            c.status !== 'ended' && 
            c.activeParticipants?.[currentUser.id] === true
          );

          if (incomingPrivateCall) {
            setCurrentCall(incomingPrivateCall);
          } else if (outgoingCall) {
            setCurrentCall(outgoingCall);
          } else if (manuallyJoinedCall) {
            setCurrentCall(manuallyJoinedCall);
          } else {
            setCurrentCall(null);
          }
        } else {
          setCurrentCall(null);
        }
      } else {
        setActiveCalls([]);
        setCurrentCall(null);
      }
    });

    return () => unsubscribeCalls();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    const notifRef = ref(db, `notifications/${currentUser.id}`);
    const unsubscribeNotifs = onValue(notifRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        })).sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(list);
      } else {
        setNotifications([]);
      }
    });
    return () => unsubscribeNotifs();
  }, [currentUser?.id]);

  // Global Realtime Chat Notification Listener
  useEffect(() => {
    if (!currentUser) return;

    // 1. Listen to Direct Chats & Shop Chats
    const chatsRef = ref(db, 'chats');
    const unsubscribeChats = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      Object.entries(data).forEach(([chatId, chatVal]: [string, any]) => {
        if (!chatId.includes(currentUser.id)) return;
        const messagesObj = chatVal?.messages;
        if (!messagesObj) return;

        Object.entries(messagesObj).forEach(([msgId, msgVal]: [string, any]) => {
          if (
            msgVal.senderId &&
            msgVal.senderId !== currentUser.id &&
            msgVal.timestamp &&
            msgVal.timestamp > mountTimeRef.current - 5000 &&
            !seenChatMsgIdsRef.current.has(msgId)
          ) {
            seenChatMsgIdsRef.current.add(msgId);
            const senderUser = users.find(u => u.id === msgVal.senderId);
            const senderName = senderUser?.name || 'Pengirim Vimos';
            const senderPhoto = senderUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${msgVal.senderId}`;

            setIncomingChatPayload({
              id: msgId,
              senderId: msgVal.senderId,
              senderName,
              senderPhoto,
              text: msgVal.text || 'Mengirim pesan baru',
              timestamp: msgVal.timestamp,
              chatType: 'user',
              targetId: msgVal.senderId
            });
          } else {
            if (msgId) seenChatMsgIdsRef.current.add(msgId);
          }
        });
      });
    });

    // 2. Listen to Collectives / Groups
    const groupsRef = ref(db, 'groups');
    const unsubscribeGroups = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      Object.entries(data).forEach(([groupId, groupVal]: [string, any]) => {
        const participants = groupVal.participants ? Object.keys(groupVal.participants) : [];
        if (!participants.includes(currentUser.id)) return;

        const messagesObj = groupVal.messages;
        if (!messagesObj) return;

        Object.entries(messagesObj).forEach(([msgId, msgVal]: [string, any]) => {
          if (
            msgVal.senderId &&
            msgVal.senderId !== currentUser.id &&
            msgVal.timestamp &&
            msgVal.timestamp > mountTimeRef.current - 5000 &&
            !seenChatMsgIdsRef.current.has(msgId)
          ) {
            seenChatMsgIdsRef.current.add(msgId);
            const senderUser = users.find(u => u.id === msgVal.senderId);
            const senderName = senderUser?.name || 'Anggota Grup';
            const senderPhoto = senderUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${msgVal.senderId}`;

            setIncomingChatPayload({
              id: msgId,
              senderId: msgVal.senderId,
              senderName,
              senderPhoto,
              text: msgVal.text || 'Pesan grup baru',
              timestamp: msgVal.timestamp,
              chatType: 'group',
              targetId: groupId,
              groupName: groupVal.name || 'Collective'
            });
          } else {
            if (msgId) seenChatMsgIdsRef.current.add(msgId);
          }
        });
      });
    });

    return () => {
      unsubscribeChats();
      unsubscribeGroups();
    };
  }, [currentUser?.id, users]);

  const toggleFollow = (targetId: string) => {
    if (!currentUser || currentUser.id === targetId) return;
    const isFollowing = (currentUser.following || []).includes(targetId);
    const myFollowingRef = ref(db, `users/${currentUser.id}/following/${targetId}`);
    const theirFollowersRef = ref(db, `users/${targetId}/followers/${currentUser.id}`);
    if (isFollowing) {
      set(myFollowingRef, null);
      set(theirFollowersRef, null);
    } else {
      set(myFollowingRef, true);
      set(theirFollowersRef, true);
      push(ref(db, `notifications/${targetId}`), {
        senderId: currentUser.id,
        senderName: currentUser.name || 'Shadow',
        senderPhoto: currentUser.photoURL,
        type: 'follow',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  const toggleLike = (postId: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const hasLiked = (post.likes || []).includes(currentUser.id);
    const likeRef = ref(db, `posts/${postId}/likes/${currentUser.id}`);
    set(likeRef, hasLiked ? null : true);
    if (!hasLiked && post.userId !== currentUser.id) {
      push(ref(db, `notifications/${post.userId}`), {
        senderId: currentUser.id,
        senderName: currentUser.name || 'Shadow',
        senderPhoto: currentUser.photoURL,
        type: 'like',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  const toggleDislike = (postId: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const hasDisliked = (post.dislikes || []).includes(currentUser.id);
    const dislikeRef = ref(db, `posts/${postId}/dislikes/${currentUser.id}`);
    set(dislikeRef, hasDisliked ? null : true);
    if (!hasDisliked) {
      set(ref(db, `posts/${postId}/likes/${currentUser.id}`), null);
    }
  };

  const addComment = (postId: string, text: string) => {
    if (!currentUser || !text.trim()) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const commentsRef = ref(db, `posts/${postId}/comments`);
    push(commentsRef, {
      userId: currentUser.id,
      userName: currentUser.name || 'Shadow',
      text: text.trim(),
      timestamp: Date.now()
    });
    if (post.userId !== currentUser.id) {
      push(ref(db, `notifications/${post.userId}`), {
        senderId: currentUser.id,
        senderName: currentUser.name || 'Shadow',
        senderPhoto: currentUser.photoURL,
        type: 'comment',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  const addStory = (text: string, photoURL: string) => {
    if (!currentUser) return;
    push(ref(db, 'stories'), {
      userId: currentUser.id,
      userName: currentUser.name || 'Anonymous Shadow',
      userPhoto: currentUser.photoURL || '',
      createdAt: Date.now(),
      text,
      photoURL: photoURL || null
    });
  };

  const startCall = (type: 'private' | 'collective', mediaType: 'audio' | 'video', targetId: string, name?: string) => {
    if (!currentUser) return;
    const callId = type === 'private' ? `private_${[currentUser.id, targetId].sort().join('_')}` : `group_${targetId}`;
    const callRef = ref(db, `calls/${callId}`);
    const newCall: any = {
      type,
      mediaType,
      callerId: currentUser.id,
      callerName: currentUser.name || 'Anonymous Shadow',
      callerPhoto: currentUser.photoURL || '',
      status: 'calling',
      timestamp: Date.now(),
      activeParticipants: { [currentUser.id]: true }
    };
    if (type === 'private') {
      newCall.receiverId = targetId;
    } else {
      newCall.groupId = targetId;
      newCall.groupName = name || 'Collective';
    }
    set(callRef, newCall);
  };

  const acceptCall = () => {
    if (!currentCall || !currentUser) return;
    const callRef = ref(db, `calls/${currentCall.id}`);
    update(callRef, {
      status: 'connected',
      [`activeParticipants/${currentUser.id}`]: true
    });
  };

  const declineCall = () => {
    if (!currentCall) return;
    const callRef = ref(db, `calls/${currentCall.id}`);
    update(callRef, { status: 'ended' });
  };

  const endCall = () => {
    if (!currentCall || !currentUser) return;
    const callRef = ref(db, `calls/${currentCall.id}`);
    
    if (currentCall.type === 'private') {
      update(callRef, { status: 'ended' });
    } else {
      const participants = { ...currentCall.activeParticipants };
      delete participants[currentUser.id];
      
      if (Object.keys(participants).length === 0) {
        update(callRef, { status: 'ended' });
      } else {
        set(ref(db, `calls/${currentCall.id}/activeParticipants/${currentUser.id}`), null);
      }
    }
  };

  const joinCall = (callId: string) => {
    if (!currentUser) return;
    set(ref(db, `calls/${callId}/activeParticipants/${currentUser.id}`), true);
  };

  const createPost = (data: { text: string; photoURL?: string; videoURL?: string; musicURL?: string }) => {
    if (!currentUser) return;
    push(ref(db, 'posts'), {
      userId: currentUser.id,
      userName: currentUser.name || 'Anonymous Shadow',
      userPhoto: currentUser.photoURL || '',
      timestamp: Date.now(),
      text: data.text,
      photoURL: data.photoURL || null,
      videoURL: data.videoURL || null,
      musicURL: data.musicURL || null,
      likes: {},
      dislikes: {},
      comments: {}
    });
    setCurrentView(View.FEED);
  };

  const addAnnouncement = (text: string) => {
    if (!currentUser?.isAdmin) return;
    push(ref(db, 'announcements'), {
      text,
      timestamp: Date.now(),
      authorId: currentUser.id
    });
  };

  const updateAnnouncement = (id: string, text: string) => {
    if (!currentUser?.isAdmin) return;
    update(ref(db, `announcements/${id}`), { text });
  };

  const deleteAnnouncement = (id: string) => {
    if (!currentUser?.isAdmin) return;
    remove(ref(db, `announcements/${id}`));
  };

  const deletePost = (id: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === id);
    if (!post) return;
    if (post.userId === currentUser.id || currentUser.isAdmin) {
      remove(ref(db, `posts/${id}`));
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredPosts = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return posts
      .filter(p => !p.isTakenDown || currentUser?.isAdmin)
      .filter(p => 
        (p.text || '').toLowerCase().includes(term) ||
        (p.userName || '').toLowerCase().includes(term)
      );
  }, [posts, searchTerm, currentUser]);

  const profileToDisplay = useMemo(() => {
    if (selectedProfileId) return users.find(u => u.id === selectedProfileId) || null;
    return currentUser;
  }, [selectedProfileId, users, currentUser]);

  if (authLoading && !currentUser) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white animate-fade-in">
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-black/5 animate-ping" style={{ animationDuration: '2s' }}></div>
        <div className="w-16 h-16 rounded-3xl bg-black flex items-center justify-center relative z-10 shadow-lg">
          <i className="fas fa-circle-notch text-white text-2xl animate-spin"></i>
        </div>
      </div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 animate-pulse">
        CONNECTING...
      </p>
    </div>
  );

  if (!currentUser) return <AuthScreen bannedMessage={bannedMessage} />;

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-xl mx-auto border-x border-gray-100 shadow-sm relative overflow-hidden">
      <Header 
        onSearch={setSearchTerm} 
        users={users} 
        onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }} 
        onLeaderboardClick={() => setCurrentView(View.LEADERBOARD)}
        onShopClick={() => setCurrentView(View.SHOP)}
        userCoins={currentUser.coins ?? 500}
        isAdmin={currentUser.isAdmin}
        onAdminClick={() => setCurrentView(View.ADMIN)}
        onLiveClick={() => {
          setCurrentView(View.LIVESTREAM);
        }}
        activeLiveCount={activeStreams.length}
      />

      <main className="flex-1 pb-20 overflow-y-auto scroll-smooth">
        {currentView === View.FEED && (
          <Feed 
            posts={filteredPosts} 
            stories={stories}
            onAddStory={addStory}
            announcements={announcements}
            onLike={toggleLike} 
            onDislike={toggleDislike}
            onComment={addComment}
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }}
            currentUser={currentUser}
            onFollow={toggleFollow}
            onTakeDownPost={(id) => {
              const post = posts.find(p => p.id === id);
              update(ref(db, `posts/${id}`), { isTakenDown: !post?.isTakenDown });
            }}
            onDeletePost={deletePost}
            users={users}
            isLoading={loadingPosts}
            activeStreams={activeStreams}
            onGoLiveClick={() => {
              setLiveModalMode('create');
              setSelectedLiveStreamId(null);
              setIsLiveModalOpen(true);
            }}
            onStreamClick={(streamId) => {
              setSelectedLiveStreamId(streamId);
              setLiveModalMode('watch');
              setIsLiveModalOpen(true);
            }}
          />
        )}
        {currentView === View.REELS && (
          <Reels 
            posts={posts.filter(p => p.videoURL && (!p.isTakenDown || currentUser?.isAdmin))} 
            onLike={toggleLike} 
            onComment={addComment} 
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }} 
            currentUser={currentUser}
            onTakeDownPost={(id) => {
              const post = posts.find(p => p.id === id);
              update(ref(db, `posts/${id}`), { isTakenDown: !post?.isTakenDown });
            }}
            onDeletePost={deletePost}
            users={users}
          />
        )}
        {currentView === View.POST && <PostCreator onPost={createPost} />}
        {currentView === View.LEADERBOARD && (
          <Leaderboard 
            users={users} 
            posts={posts} 
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }} 
            onStreamClick={(streamId) => {
              setSelectedLiveStreamId(streamId);
              setLiveModalMode('watch');
              setIsLiveModalOpen(true);
            }}
          />
        )}
        {currentView === View.LIVESTREAM && (
          <LiveHub
            activeStreams={activeStreams}
            users={users}
            currentUser={currentUser}
            onGoLiveClick={() => {
              setLiveModalMode('create');
              setSelectedLiveStreamId(null);
              setIsLiveModalOpen(true);
            }}
            onStreamClick={(streamId) => {
              setSelectedLiveStreamId(streamId);
              setLiveModalMode('watch');
              setIsLiveModalOpen(true);
            }}
            onUserClick={(id) => {
              setSelectedProfileId(id);
              setCurrentView(View.PROFILE);
            }}
            onFollow={toggleFollow}
          />
        )}
        {currentView === View.NOTIFICATIONS && (
          <Notifications 
            notifications={notifications} 
            currentUser={currentUser} 
            onFollow={toggleFollow}
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }}
            onClearAll={() => {
              const updates: any = {};
              notifications.forEach(n => updates[`notifications/${currentUser.id}/${n.id}/read`] = true);
              update(ref(db), updates);
            }}
            users={users}
          />
        )}
        {currentView === View.CHAT && (
          <Chat 
            users={users} 
            currentUser={currentUser} 
            activeCalls={activeCalls}
            onStartCall={startCall}
            onJoinCall={joinCall}
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }} 
            onFollow={toggleFollow}
            targetUserId={targetChatUserId}
            targetGroupId={targetChatGroupId}
            initialChatMessage={initialChatMessage}
            onClearInitialChat={() => {
              setTargetChatUserId(null);
              setTargetChatGroupId(null);
              setInitialChatMessage(null);
            }}
            permissionStatus={notifPermission}
            onRequestPermission={requestNotifPermission}
          />
        )}
        {currentView === View.PROFILE && profileToDisplay && (
          <Profile 
            user={profileToDisplay} 
            users={users}
            posts={posts}
            currentUser={currentUser}
            onToggleFollow={toggleFollow}
            onLike={toggleLike}
            onDislike={toggleDislike}
            onComment={addComment}
            onTakeDownPost={(id) => {
              const post = posts.find(p => p.id === id);
              update(ref(db, `posts/${id}`), { isTakenDown: !post?.isTakenDown });
            }}
            onDeletePost={deletePost}
            onUpdateProfile={(data) => update(ref(db, `users/${currentUser.id}`), data)}
            onAddCapture={(url) => push(ref(db, `users/${currentUser.id}/recentCaptures`), url)}
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }}
            onLogout={handleLogout}
            onBanUser={(id) => {
              const user = users.find(u => u.id === id);
              update(ref(db, `users/${id}`), { isBanned: !user?.isBanned });
            }}
            onSetRole={(id, role, color) => update(ref(db, `users/${id}`), { role, roleColor: color })}
          />
        )}
        {currentView === View.SHOP && (
          <Shop 
            currentUser={currentUser}
            onUpdateUser={(updatedData) => {
              setCurrentUser(prev => prev ? { ...prev, ...updatedData } : null);
            }}
            onNavigateToChat={(targetUserId, initialMessage) => {
              setTargetChatUserId(targetUserId);
              setInitialChatMessage(initialMessage || null);
              setCurrentView(View.CHAT);
            }}
          />
        )}
        {currentView === View.ADMIN && currentUser.isAdmin && (
          <AdminPanel 
            users={users} 
            announcements={announcements}
            onAddAnnouncement={addAnnouncement}
            onUpdateAnnouncement={updateAnnouncement}
            onDeleteAnnouncement={deleteAnnouncement}
            onSetRole={(id, role, color) => update(ref(db, `users/${id}`), { role, roleColor: color })} 
            onBanUser={(id) => {
              const user = users.find(u => u.id === id);
              update(ref(db, `users/${id}`), { isBanned: !user?.isBanned });
            }}
            onUserClick={(id) => { setSelectedProfileId(id); setCurrentView(View.PROFILE); }}
          />
        )}
      </main>

      <Navbar 
        activeView={currentView} 
        onViewChange={(view) => {
          if (view === View.PROFILE) setSelectedProfileId(currentUser.id);
          setCurrentView(view);
          setSearchTerm('');
        }} 
        unreadCount={notifications.filter(n => !n.read).length}
      />

      {currentCall && currentUser && (
        <CallingOverlay
          activeCall={currentCall}
          currentUser={currentUser}
          users={users}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
        />
      )}

      {isLiveModalOpen && currentUser && (
        <LiveStreamModal
          currentUser={currentUser}
          users={users}
          activeStreamId={selectedLiveStreamId}
          initialMode={liveModalMode}
          onClose={() => setIsLiveModalOpen(false)}
          onFollow={toggleFollow}
        />
      )}

      {/* HEADS-UP POPUP CHAT NOTIFICATION */}
      <HeadsUpNotification
        payload={incomingChatPayload}
        onClose={() => setIncomingChatPayload(null)}
        onOpenChat={(targetId, type) => {
          if (type === 'group') {
            setTargetChatGroupId(targetId);
            setTargetChatUserId(null);
          } else {
            setTargetChatUserId(targetId);
            setTargetChatGroupId(null);
          }
          setCurrentView(View.CHAT);
        }}
        permissionStatus={notifPermission}
        onRequestPermission={requestNotifPermission}
      />
    </div>
  );
}
