import React, { useState, useEffect } from 'react';
import { User, ChatMessage, Group } from '../types.ts';
import { db } from '../firebase.ts';
import { ref, onValue, push, serverTimestamp, set, update, remove, get } from 'firebase/database';
import { ActiveCall } from './CallingOverlay.tsx';
import { useLanguage } from '../LanguageContext.tsx';

interface ChatProps {
  users: User[];
  currentUser: User | null;
  onUserClick: (userId: string) => void;
  activeCalls?: ActiveCall[];
  onStartCall?: (type: 'private' | 'collective', mediaType: 'audio' | 'video', targetId: string, name?: string) => void;
  onJoinCall?: (callId: string) => void;
  onFollow?: (userId: string) => void;
  targetUserId?: string | null;
  targetGroupId?: string | null;
  initialChatMessage?: string | null;
  onClearInitialChat?: () => void;
  permissionStatus?: NotificationPermission | 'unsupported';
  onRequestPermission?: () => void;
}

const Chat: React.FC<ChatProps> = ({ 
  users, 
  currentUser, 
  onUserClick, 
  activeCalls = [], 
  onStartCall, 
  onJoinCall,
  onFollow,
  targetUserId,
  targetGroupId,
  initialChatMessage,
  onClearInitialChat,
  permissionStatus,
  onRequestPermission
}) => {
  const { t } = useLanguage();
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'user' | 'group', data: User | Group } | null>(null);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isViewingGroupSettings, setIsViewingGroupSettings] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'direct' | 'shop' | 'groups' | 'anonymous'>('direct');
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);

  // Custom Confirmation Modal Pop-Up State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
  } | null>(null);

  // Shop Chat Threads state
  interface ShopChatThread {
    chatId: string;
    otherUser: User;
    lastMessage: string;
    lastMessageSenderId: string;
    timestamp: number;
  }
  const [shopChatThreads, setShopChatThreads] = useState<ShopChatThread[]>([]);

  // Anonymous Chat States
  const [isSearchingAnon, setIsSearchingAnon] = useState(false);
  const [activeAnonRoomId, setActiveAnonRoomId] = useState<string | null>(null);
  const [activeAnonRoom, setActiveAnonRoom] = useState<any | null>(null);
  const [anonMessages, setAnonMessages] = useState<{ id: string; senderId: string; text: string; timestamp: number }[]>([]);
  const [anonInputMsg, setAnonInputMsg] = useState('');

  const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  // Logic to identify MUTUAL FOLLOWERS (Saling Follow Balik)
  const isMutual = (uid: string) => {
    if (!currentUser) return false;
    const following = currentUser.following || [];
    const followers = currentUser.followers || [];
    return following.includes(uid) && followers.includes(uid);
  };

  const mutualFollowers = users.filter(u => u.id !== currentUser?.id && isMutual(u.id));

  // Target User Auto-Selection for Jual Beli / Direct Chat
  useEffect(() => {
    if (targetUserId && users.length > 0) {
      const targetUser = users.find(u => u.id === targetUserId);
      if (targetUser) {
        setSelectedRecipient({ type: 'user', data: targetUser });
        setActiveTab('shop');
        if (initialChatMessage) {
          setMsg(initialChatMessage);
        }
        if (onClearInitialChat) {
          onClearInitialChat();
        }
      }
    }
  }, [targetUserId, users, initialChatMessage]);

  // Target Group Auto-Selection
  useEffect(() => {
    if (targetGroupId && groups.length > 0) {
      const targetGroup = groups.find(g => g.id === targetGroupId);
      if (targetGroup) {
        setSelectedRecipient({ type: 'group', data: targetGroup });
        setActiveTab('groups');
        if (onClearInitialChat) {
          onClearInitialChat();
        }
      }
    }
  }, [targetGroupId, groups]);

  // Sync groups user is part of
  useEffect(() => {
    if (!currentUser) return;
    const groupsRef = ref(db, 'groups');
    const unsubscribe = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userGroups = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ 
            id, 
            ...val, 
            participants: val.participants ? Object.keys(val.participants) : [],
            admins: val.admins ? Object.keys(val.admins) : []
          }))
          .filter((g: Group) => g.participants.includes(currentUser.id));
        setGroups(userGroups);
        
        if (selectedRecipient?.type === 'group') {
          const updated = userGroups.find(g => g.id === (selectedRecipient.data as Group).id);
          if (updated) setSelectedRecipient({ type: 'group', data: updated });
          else setSelectedRecipient(null);
        }
      } else {
        setGroups([]);
      }
    });
    return () => unsubscribe();
  }, [currentUser, selectedRecipient?.type]);

  // Helper to sanitize Firebase path keys and check deletion status
  const getSafeKey = (id: string) => id.replace(/[.#$\[\]]/g, '_');

  const isMsgDeletedForUser = (deletedForObj: any, uid?: string) => {
    if (!deletedForObj || !uid) return false;
    const safeId = getSafeKey(uid);
    return Boolean(deletedForObj[uid] || deletedForObj[safeId]);
  };

  // Sync active Shop Chats from Firebase RTDB
  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = ref(db, 'chats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && users.length > 0) {
        const threads: ShopChatThread[] = [];

        Object.entries(data).forEach(([chatId, chatVal]: [string, any]) => {
          if (!chatId.includes(currentUser.id)) return;

          const parts = chatId.split('_');
          if (parts.length !== 2) return;
          const otherUserId = parts.find(id => id !== currentUser.id);
          if (!otherUserId) return;

          const otherUser = users.find(u => u.id === otherUserId);
          if (!otherUser) return;

          const messagesObj = chatVal?.messages;
          if (!messagesObj) return;

          const msgList = Object.entries(messagesObj)
            .map(([mId, mVal]: [string, any]) => ({
              id: mId,
              ...mVal
            }))
            .filter((m: any) => !isMsgDeletedForUser(m.deletedFor, currentUser.id))
            .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

          if (msgList.length === 0) return;

          // Check if thread is a shop chat (explicit flag OR contains purchase/item inquiry text)
          const isShopThread = chatVal?.isShopChat === true || msgList.some((m: any) => 
            m.isShop === true ||
            (m.text && (
              m.text.includes('tertarik untuk membeli') || 
              m.text.includes('membeli produk') || 
              m.text.includes('dari toko Anda') ||
              m.text.includes('Harga:')
            ))
          );

          if (isShopThread) {
            const lastMsg = msgList[msgList.length - 1];
            threads.push({
              chatId,
              otherUser,
              lastMessage: lastMsg.text || '',
              lastMessageSenderId: lastMsg.senderId || '',
              timestamp: lastMsg.timestamp || 0
            });
          }
        });

        threads.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setShopChatThreads(threads);
      } else {
        setShopChatThreads([]);
      }
    });

    return () => unsubscribe();
  }, [currentUser, users]);

  // Sync messages for selectedRecipient (direct / group)
  useEffect(() => {
    if (!currentUser || !selectedRecipient) return;

    let chatPath = '';
    if (selectedRecipient.type === 'user') {
      const chatId = getChatId(currentUser.id, (selectedRecipient.data as User).id);
      chatPath = `chats/${chatId}/messages`;
    } else {
      chatPath = `groups/${(selectedRecipient.data as Group).id}/messages`;
    }

    const chatRef = ref(db, chatPath);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, any]) => ({
            id,
            ...val
          }))
          .filter((m: any) => !isMsgDeletedForUser(m.deletedFor, currentUser.id))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(list);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [selectedRecipient, currentUser]);

  // Message Deletion Handlers
  const handleDeleteMessageForMe = async (msgId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || !selectedRecipient) return;

    setActiveMenuMsgId(null);
    setMessages(prev => prev.filter(m => m.id !== msgId));

    try {
      let msgPath = '';
      if (selectedRecipient.type === 'user') {
        const chatId = getChatId(currentUser.id, (selectedRecipient.data as User).id);
        msgPath = `chats/${chatId}/messages/${msgId}`;
      } else {
        msgPath = `groups/${(selectedRecipient.data as Group).id}/messages/${msgId}`;
      }
      
      const safeUserId = getSafeKey(currentUser.id);
      await set(ref(db, `${msgPath}/deletedFor/${safeUserId}`), true);
    } catch (err) {
      console.error('Failed to delete message for me:', err);
    }
  };

  const handleDeleteMessageForEveryone = (msgId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || !selectedRecipient) return;
    setActiveMenuMsgId(null);

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pesan untuk Semua?',
      message: 'Apakah Anda yakin ingin menghapus pesan ini secara permanen untuk semua orang?',
      confirmText: 'Ya, Hapus untuk Semua',
      onConfirm: async () => {
        setConfirmModal(null);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        try {
          let msgPath = '';
          if (selectedRecipient.type === 'user') {
            const chatId = getChatId(currentUser.id, (selectedRecipient.data as User).id);
            msgPath = `chats/${chatId}/messages/${msgId}`;
          } else {
            msgPath = `groups/${(selectedRecipient.data as Group).id}/messages/${msgId}`;
          }
          await remove(ref(db, msgPath));
        } catch (err) {
          console.error('Failed to delete message for everyone:', err);
        }
      }
    });
  };

  const handleClearChatForMe = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || !selectedRecipient) return;

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Obrolan Ini?',
      message: 'Apakah Anda yakin ingin menghapus seluruh obrolan ini dari tampilan Anda?',
      confirmText: 'Ya, Hapus Obrolan',
      onConfirm: async () => {
        setConfirmModal(null);
        setMessages([]);
        try {
          let chatPath = '';
          if (selectedRecipient.type === 'user') {
            const chatId = getChatId(currentUser.id, (selectedRecipient.data as User).id);
            chatPath = `chats/${chatId}/messages`;
          } else {
            chatPath = `groups/${(selectedRecipient.data as Group).id}/messages`;
          }

          const snapshot = await get(ref(db, chatPath));
          const data = snapshot.val();
          if (data) {
            const safeUserId = getSafeKey(currentUser.id);
            const updates: Record<string, any> = {};
            Object.keys(data).forEach((mId) => {
              updates[`${chatPath}/${mId}/deletedFor/${safeUserId}`] = true;
            });
            await update(ref(db), updates);
          }
        } catch (err) {
          console.error('Failed to clear chat:', err);
        }
      }
    });
  };

  const handleDeleteShopChatThread = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Obrolan Toko?',
      message: 'Apakah Anda yakin ingin menghapus obrolan toko ini dari daftar Anda?',
      confirmText: 'Ya, Hapus Obrolan Toko',
      onConfirm: async () => {
        setConfirmModal(null);
        setShopChatThreads(prev => prev.filter(t => t.chatId !== chatId));
        try {
          const chatMessagesRef = ref(db, `chats/${chatId}/messages`);
          const snapshot = await get(chatMessagesRef);
          const data = snapshot.val();
          if (data) {
            const safeUserId = getSafeKey(currentUser.id);
            const updates: Record<string, any> = {};
            Object.keys(data).forEach((mId) => {
              updates[`chats/${chatId}/messages/${mId}/deletedFor/${safeUserId}`] = true;
            });
            await update(ref(db), updates);
          }
        } catch (err) {
          console.error('Failed to delete shop chat thread:', err);
        }
      }
    });
  };

  const handleClearDirectUserChat = (targetUserId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Riwayat Obrolan?',
      message: 'Apakah Anda yakin ingin menghapus seluruh riwayat obrolan dengan pengguna ini?',
      confirmText: 'Ya, Hapus Riwayat',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const chatId = getChatId(currentUser.id, targetUserId);
          const chatPath = `chats/${chatId}/messages`;
          const snapshot = await get(ref(db, chatPath));
          const data = snapshot.val();
          if (data) {
            const safeUserId = getSafeKey(currentUser.id);
            const updates: Record<string, any> = {};
            Object.keys(data).forEach((mId) => {
              updates[`${chatPath}/${mId}/deletedFor/${safeUserId}`] = true;
            });
            await update(ref(db), updates);
          }
          if (selectedRecipient?.type === 'user' && (selectedRecipient.data as User).id === targetUserId) {
            setMessages([]);
          }
        } catch (err) {
          console.error('Failed to clear direct user chat:', err);
        }
      }
    });
  };

  const handleDeleteAnonMessageForMe = async (msgId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || !activeAnonRoomId) return;

    setAnonMessages(prev => prev.filter(m => m.id !== msgId));

    try {
      const safeUserId = getSafeKey(currentUser.id);
      await set(ref(db, `anonymous_rooms/${activeAnonRoomId}/messages/${msgId}/deletedFor/${safeUserId}`), true);
    } catch (err) {
      console.error('Failed to delete anon message:', err);
    }
  };

  // Sync Anonymous Rooms & Matches
  useEffect(() => {
    if (!currentUser) return;

    const roomsRef = ref(db, 'anonymous_rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const foundEntry = Object.entries(data).find(([id, roomVal]: [string, any]) => {
          return (
            roomVal &&
            roomVal.status === 'active' &&
            roomVal.participants &&
            roomVal.participants[currentUser.id] === true
          );
        });

        if (foundEntry) {
          const [roomId, roomVal] = foundEntry;
          setActiveAnonRoomId(roomId);
          setActiveAnonRoom({ id: roomId, ...(roomVal as Record<string, any>) });
          setIsSearchingAnon(false);
          remove(ref(db, `anonymous_queue/${currentUser.id}`));
        } else {
          setActiveAnonRoomId(null);
          setActiveAnonRoom(null);
        }
      } else {
        setActiveAnonRoomId(null);
        setActiveAnonRoom(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync Anonymous Messages
  useEffect(() => {
    if (!activeAnonRoomId) {
      setAnonMessages([]);
      return;
    }

    const messagesRef = ref(db, `anonymous_rooms/${activeAnonRoomId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.entries(data)
          .map(([id, val]: [string, any]) => ({
            id,
            ...val
          }))
          .filter((m: any) => !m.deletedFor || !m.deletedFor[currentUser?.id || ''])
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setAnonMessages(msgList);
      } else {
        setAnonMessages([]);
      }
    });

    return () => unsubscribe();
  }, [activeAnonRoomId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || !currentUser || !selectedRecipient) return;

    let chatPath = '';
    if (selectedRecipient.type === 'user') {
      const chatId = getChatId(currentUser.id, (selectedRecipient.data as User).id);
      chatPath = `chats/${chatId}/messages`;

      if (activeTab === 'shop') {
        update(ref(db, `chats/${chatId}`), {
          isShopChat: true,
          lastMessage: msg.trim(),
          lastUpdated: serverTimestamp()
        });
      }
    } else {
      chatPath = `groups/${(selectedRecipient.data as Group).id}/messages`;
    }

    const chatRef = ref(db, chatPath);
    push(chatRef, {
      senderId: currentUser.id,
      text: msg,
      timestamp: serverTimestamp(),
      ...(activeTab === 'shop' ? { isShop: true } : {})
    });
    
    setMsg('');
  };

  const handleCreateGroup = () => {
    if (!currentUser || !groupName.trim() || selectedForGroup.length === 0) return;
    
    const groupsRef = ref(db, 'groups');
    const newGroupRef = push(groupsRef);
    const newGroupId = newGroupRef.key;
    
    const participants: Record<string, boolean> = { [currentUser.id]: true };
    const admins: Record<string, boolean> = { [currentUser.id]: true };
    selectedForGroup.forEach(id => participants[id] = true);

    const createdGroupObj: Group = {
      id: newGroupId || Date.now().toString(),
      name: groupName,
      bio: 'New collective space.',
      creatorId: currentUser.id,
      participants: Object.keys(participants),
      admins: Object.keys(admins),
      timestamp: Date.now()
    };

    set(newGroupRef, {
      name: groupName,
      bio: 'New collective space.',
      creatorId: currentUser.id,
      participants,
      admins,
      timestamp: serverTimestamp()
    });

    setGroupName('');
    setSelectedForGroup([]);
    setIsCreatingGroup(false);
    setSelectedRecipient({ type: 'group', data: createdGroupObj });
    setActiveTab('groups');
  };

  const updateGroupInfo = (groupId: string, data: any) => {
    update(ref(db, `groups/${groupId}`), data);
  };

  const handleAddMember = (groupId: string, userId: string) => {
    set(ref(db, `groups/${groupId}/participants/${userId}`), true);
  };

  const handleRemoveMember = (groupId: string, userId: string) => {
    const memberObj = users.find(u => u.id === userId);
    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan Anggota?',
      message: `Apakah Anda yakin ingin mengeluarkan ${memberObj?.name || 'pengguna ini'} dari grup?`,
      confirmText: 'Keluarkan',
      onConfirm: async () => {
        setConfirmModal(null);
        await set(ref(db, `groups/${groupId}/participants/${userId}`), null);
        await set(ref(db, `groups/${groupId}/admins/${userId}`), null);
      }
    });
  };

  const handleLeaveGroup = (groupId: string) => {
    if (!currentUser) return;
    setConfirmModal({
      isOpen: true,
      title: 'Keluar dari Grup?',
      message: 'Apakah Anda yakin ingin keluar dari obrolan grup ini?',
      confirmText: 'Keluar Grup',
      onConfirm: async () => {
        setConfirmModal(null);
        await set(ref(db, `groups/${groupId}/participants/${currentUser.id}`), null);
        await set(ref(db, `groups/${groupId}/admins/${currentUser.id}`), null);
        setSelectedRecipient(null);
        setIsViewingGroupSettings(false);
      }
    });
  };

  const handleGroupPhotoChange = (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateGroupInfo(groupId, { photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleParticipantSelection = (uid: string) => {
    setSelectedForGroup(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Anonymous Handlers
  const handleFindAnonMatch = async () => {
    if (!currentUser) return;
    setIsSearchingAnon(true);

    try {
      const queueRef = ref(db, 'anonymous_queue');
      const snapshot = await get(queueRef);
      const queueData = snapshot.val();

      let matchedUserId: string | null = null;
      if (queueData) {
        const candidateKeys = Object.keys(queueData).filter((uid) => uid !== currentUser.id);
        if (candidateKeys.length > 0) {
          matchedUserId = candidateKeys[0];
        }
      }

      if (matchedUserId) {
        const newRoomRef = push(ref(db, 'anonymous_rooms'));
        const newRoomId = newRoomRef.key;
        if (newRoomId) {
          await set(newRoomRef, {
            id: newRoomId,
            status: 'active',
            createdAt: Date.now(),
            participants: {
              [currentUser.id]: true,
              [matchedUserId]: true
            },
            revealed: {
              [currentUser.id]: false,
              [matchedUserId]: false
            }
          });

          await remove(ref(db, `anonymous_queue/${matchedUserId}`));
          await remove(ref(db, `anonymous_queue/${currentUser.id}`));

          setActiveAnonRoomId(newRoomId);
          setIsSearchingAnon(false);
        }
      } else {
        await set(ref(db, `anonymous_queue/${currentUser.id}`), {
          uid: currentUser.id,
          joinedAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Error finding match:", err);
      setIsSearchingAnon(false);
    }
  };

  const handleCancelSearch = async () => {
    if (!currentUser) return;
    setIsSearchingAnon(false);
    await remove(ref(db, `anonymous_queue/${currentUser.id}`));
  };

  const handleSendAnonMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anonInputMsg.trim() || !activeAnonRoomId || !currentUser) return;

    const messagesRef = ref(db, `anonymous_rooms/${activeAnonRoomId}/messages`);
    await push(messagesRef, {
      senderId: currentUser.id,
      text: anonInputMsg.trim(),
      timestamp: Date.now()
    });

    setAnonInputMsg('');
  };

  const handleLeaveAnonRoom = async () => {
    if (!activeAnonRoomId) return;
    await update(ref(db, `anonymous_rooms/${activeAnonRoomId}`), {
      status: 'ended'
    });
    setActiveAnonRoomId(null);
    setActiveAnonRoom(null);
  };

  const handleNextMatch = async () => {
    await handleLeaveAnonRoom();
    await handleFindAnonMatch();
  };

  const handleFollowAndReveal = async (partnerId: string) => {
    if (!currentUser || !activeAnonRoomId) return;

    if (onFollow) {
      onFollow(partnerId);
    }

    await update(ref(db, `anonymous_rooms/${activeAnonRoomId}/revealed`), {
      [currentUser.id]: true
    });
  };

  // Helper to render custom confirmation modal for all view states
  const renderConfirmModal = () => {
    if (!confirmModal || !confirmModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 text-center space-y-4 animate-scale-up">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-inner">
            <i className="fas fa-trash-can"></i>
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-gray-900">{confirmModal.title}</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{confirmModal.message}</p>
          </div>
          <div className="flex space-x-2 pt-2">
            <button
              onClick={() => setConfirmModal(null)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                confirmModal.onConfirm();
              }}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all active:scale-95"
            >
              {confirmModal.confirmText || 'Hapus'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // If currently inside an active Anonymous Room
  if (activeAnonRoomId && activeAnonRoom) {
    const partnerUid = Object.keys(activeAnonRoom.participants || {}).find(id => id !== currentUser?.id);
    const partnerUser = partnerUid ? users.find(u => u.id === partnerUid) : null;

    const isSelfRevealed = activeAnonRoom.revealed?.[currentUser?.id || ''] === true;
    const isPartnerSelfRevealed = partnerUid ? activeAnonRoom.revealed?.[partnerUid] === true : false;
    const isFollowingPartner = currentUser?.following?.includes(partnerUid || '');

    const isPartnerRevealed = isSelfRevealed || isPartnerSelfRevealed || isFollowingPartner;

    const maskedAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerUid || 'anon'}`;
    const displayName = isPartnerRevealed
      ? (partnerUser?.name || 'Partner')
      : `Pengguna Anonim #${partnerUid ? partnerUid.substring(0, 4).toUpperCase() : '????'}`;
    const displayPhoto = isPartnerRevealed
      ? (partnerUser?.photoURL || maskedAvatar)
      : maskedAvatar;

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] bg-zinc-950 text-white animate-fade-in rounded-3xl overflow-hidden border-2 border-red-900/40 shadow-2xl">
        {/* Top Header */}
        <div className="p-4 bg-zinc-900 border-b border-white/10 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleLeaveAnonRoom}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="Keluar Chat"
            >
              <i className="fas fa-arrow-left text-sm"></i>
            </button>
            <div 
              className={`relative ${isPartnerRevealed ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (isPartnerRevealed && partnerUid) {
                  onUserClick(partnerUid);
                }
              }}
            >
              <img
                src={displayPhoto}
                alt={displayName}
                className="w-11 h-11 rounded-full border-2 border-red-600 object-cover shadow-lg"
              />
              {!isPartnerRevealed && (
                <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 text-[8px]">
                  <i className="fas fa-user-ninja"></i>
                </div>
              )}
            </div>
            <div>
              <h3 
                className={`font-black text-sm uppercase tracking-tight ${isPartnerRevealed ? 'hover:underline cursor-pointer text-white' : 'text-red-400'}`}
                onClick={() => {
                  if (isPartnerRevealed && partnerUid) {
                    onUserClick(partnerUid);
                  }
                }}
              >
                {displayName}
              </h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {isPartnerRevealed ? '🔓 Profil Terungkap' : '🕵️ Identitas Disembunyikan'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isPartnerRevealed && partnerUid && (
              <button
                onClick={() => handleFollowAndReveal(partnerUid)}
                className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center space-x-1.5 animate-pulse active:scale-95 transition-all"
              >
                <i className="fas fa-user-plus text-[9px]"></i>
                <span>Follow & Ungkap</span>
              </button>
            )}
            <button
              onClick={handleNextMatch}
              className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full border border-white/10 transition-all flex items-center space-x-1"
              title="Cari Partner Lain"
            >
              <i className="fas fa-rotate"></i>
              <span className="hidden sm:inline">Cari Lain</span>
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/90 scroll-smooth">
          <div className="text-center py-3 px-4 bg-zinc-900/80 border border-white/10 rounded-2xl text-[11px] font-bold text-zinc-400 max-w-sm mx-auto space-y-1 shadow-inner">
            <p className="text-red-400 uppercase font-black tracking-wider">🔒 Obrolan Anonim Aktif</p>
            <p>Saling berkirim pesan secara bebas! Tekan <span className="text-white font-black">Follow & Ungkap</span> jika Anda ingin saling melihat foto dan nama profil asli.</p>
          </div>

          {anonMessages.map((m) => {
            const isMe = m.senderId === currentUser?.id;
            return (
              <div key={m.id} className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start animate-fade-in'}`}>
                <span className="text-[8px] font-black uppercase tracking-widest mb-1 px-1 text-zinc-500">
                  {isMe ? 'Anda' : displayName}
                </span>
                <div className="flex items-center space-x-1.5 max-w-[85%]">
                  {isMe && (
                    <button
                      onClick={(e) => handleDeleteAnonMessageForMe(m.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 p-1 text-[11px]"
                      title="Hapus untuk Saya"
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  )}
                  <div className={`p-4 rounded-3xl text-sm font-medium shadow-md ${
                    isMe 
                      ? 'bg-red-600 text-white rounded-br-none' 
                      : 'bg-zinc-800 border border-white/10 text-white rounded-bl-none'
                  }`}>
                    {m.text}
                  </div>
                  {!isMe && (
                    <button
                      onClick={(e) => handleDeleteAnonMessageForMe(m.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 p-1 text-[11px]"
                      title="Hapus untuk Saya"
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Input */}
        <form onSubmit={handleSendAnonMessage} className="p-3 bg-zinc-900 border-t border-white/10 flex items-center space-x-2">
          <input
            type="text"
            value={anonInputMsg}
            onChange={(e) => setAnonInputMsg(e.target.value)}
            placeholder="Tulis pesan rahasia anonim..."
            className="flex-1 bg-zinc-800 border border-white/10 text-white rounded-full px-5 py-3 text-xs focus:outline-none focus:border-red-500 transition-all placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={!anonInputMsg.trim()}
            className="w-11 h-11 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-30 active:scale-95"
          >
            <i className="fas fa-paper-plane text-xs"></i>
          </button>
        </form>
      </div>
    );
  }

  if (isCreatingGroup) {
    return (
      <div className="p-4 flex flex-col h-full bg-white animate-fade-in">
        <div className="flex items-center mb-6">
          <button onClick={() => setIsCreatingGroup(false)} className="mr-4 text-black w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-black uppercase tracking-tighter">New Collective</h2>
        </div>

        <div className="space-y-4 mb-6">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50">Collective Name</label>
          <input 
            type="text" 
            placeholder="Name your Collective..." 
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="w-full p-4 border-2 border-black rounded-2xl font-bold focus:outline-none focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Add Mutual Orbit Members ({mutualFollowers.length})</p>
        
        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
          {mutualFollowers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic text-sm px-6">
              You can only create groups with people who follow you back.
            </div>
          ) : (
            mutualFollowers.map(u => (
              <div 
                key={u.id} 
                onClick={() => toggleParticipantSelection(u.id)}
                className={`flex items-center p-3 rounded-2xl border transition-all cursor-pointer ${
                  selectedForGroup.includes(u.id) ? 'border-black bg-black text-white shadow-md' : 'border-black/5 bg-gray-50'
                }`}
              >
                <img src={u.photoURL} className="w-10 h-10 rounded-full mr-3 border border-black/10" alt={u.name} />
                <div className="flex-1">
                  <p className="font-bold text-sm uppercase">{u.name}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  selectedForGroup.includes(u.id) ? 'border-white bg-white' : 'border-black/20'
                }`}>
                  {selectedForGroup.includes(u.id) && <i className="fas fa-check text-[10px] text-black"></i>}
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={handleCreateGroup}
          disabled={!groupName.trim() || selectedForGroup.length === 0}
          className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase tracking-widest disabled:opacity-20 transition-all shadow-lg active:scale-95"
        >
          Assemble
        </button>
        {renderConfirmModal()}
      </div>
    );
  }

  if (isViewingGroupSettings && selectedRecipient?.type === 'group') {
    const group = selectedRecipient.data as Group;
    const isAdmin = currentUser && group.admins.includes(currentUser.id);
    const mutualNonMembers = mutualFollowers.filter(u => !group.participants.includes(u.id));

    return (
      <div className="p-4 flex flex-col h-full bg-white overflow-y-auto pb-20 animate-fade-in relative">
        <div className="flex items-center mb-8">
          <button onClick={() => setIsViewingGroupSettings(false)} className="mr-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-black uppercase tracking-tighter">Collective Management</h2>
        </div>

        <div className="flex flex-col items-center mb-10">
          <div className="relative group mb-6">
            {group.photoURL ? (
              <img src={group.photoURL} className="w-32 h-32 rounded-full border-4 border-black object-cover shadow-xl" alt={group.name} />
            ) : (
              <div className="w-32 h-32 rounded-full bg-black text-white flex items-center justify-center text-4xl font-black border-4 border-black shadow-xl">
                {group.name.substring(0, 1).toUpperCase()}
              </div>
            )}
            {isAdmin && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                <i className="fas fa-camera text-white text-2xl"></i>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleGroupPhotoChange(group.id, e)} />
              </label>
            )}
          </div>

          {isAdmin ? (
            <div className="w-full space-y-6 px-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Group Name</label>
                <input 
                  type="text" 
                  defaultValue={group.name} 
                  onBlur={(e) => updateGroupInfo(group.id, { name: e.target.value })}
                  className="w-full p-4 border-2 border-black rounded-2xl font-bold uppercase text-center focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          ) : (
            <h3 className="text-2xl font-black uppercase tracking-tight">{group.name}</h3>
          )}
        </div>

        <div className="mb-8">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-4 px-2">Members ({group.participants.length})</h4>
          <div className="space-y-2">
            {group.participants.map(pid => {
              const u = users.find(user => user.id === pid);
              if (!u) return null;
              const isUserAdmin = group.admins.includes(u.id);

              return (
                <div key={u.id} className="flex items-center p-3 bg-gray-50 rounded-2xl border border-transparent hover:border-black transition-all">
                  <img src={u.photoURL} className="w-10 h-10 rounded-full mr-3 border border-black/10 object-cover" alt={u.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs uppercase truncate">{u.name}</p>
                    {isUserAdmin && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Admin</span>}
                  </div>
                  {isAdmin && u.id !== currentUser?.id && (
                    <div className="flex space-x-1">
                      {!isUserAdmin && (
                        <button 
                          onClick={() => handleRemoveMember(group.id, u.id)} 
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 bg-white border border-red-500/20 rounded-full transition-all"
                          title="Kick Member"
                        >
                          <i className="fas fa-user-xmark text-xs"></i>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-4 px-2">Add Mutual Orbit Members</h4>
            {mutualNonMembers.length === 0 ? (
              <p className="text-center text-[10px] text-gray-400 uppercase font-bold py-4">No more mutual orbit members to add.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {mutualNonMembers.map(u => (
                  <div key={u.id} className="flex items-center p-3 bg-gray-50 rounded-2xl border border-transparent hover:border-black transition-all">
                    <img src={u.photoURL} className="w-9 h-9 rounded-full mr-3 border border-black/10" alt={u.name} />
                    <p className="flex-1 text-xs font-bold uppercase">{u.name}</p>
                    <button 
                      onClick={() => handleAddMember(group.id, u.id)} 
                      className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white transition-all active:scale-90"
                    >
                      <i className="fas fa-plus text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button 
          onClick={() => handleLeaveGroup(group.id)}
          className="w-full py-4 border-2 border-red-500 text-red-500 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95 mb-10"
        >
          Leave Collective
        </button>
        {renderConfirmModal()}
      </div>
    );
  }

  if (!selectedRecipient) {
    return (
      <div className="p-4 h-full flex flex-col animate-fade-in relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Echoes</h2>
          <button 
            onClick={() => setIsCreatingGroup(true)}
            className="w-11 h-11 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white transition-all shadow-md active:scale-90"
            title="Create Collective"
          >
            <i className="fas fa-users-viewfinder text-base"></i>
          </button>
        </div>

        {/* NOTIFICATION PERMISSION BANNER */}
        {permissionStatus === 'default' && onRequestPermission && (
          <div className="mb-5 p-3.5 bg-gradient-to-r from-black via-gray-900 to-black text-white rounded-2xl shadow-lg border border-white/10 flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-yellow-400 text-sm flex-shrink-0 animate-bounce">
                <i className="fas fa-bell"></i>
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-white truncate">Aktifkan Notifikasi Pop-Up</p>
                <p className="text-[10px] text-gray-300 leading-tight">Dapatkan bunyi chime & pop-up saat pesan baru masuk.</p>
              </div>
            </div>
            <button
              onClick={onRequestPermission}
              className="px-3.5 py-2 bg-white text-black text-[10px] font-black rounded-xl hover:bg-gray-200 transition-all flex-shrink-0 active:scale-95 shadow-md"
            >
              Aktifkan
            </button>
          </div>
        )}
        {permissionStatus === 'granted' && (
          <div className="mb-4 px-3.5 py-2 bg-green-50 border border-green-200 text-green-700 text-[10px] font-extrabold rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-circle-check text-green-600 text-xs"></i>
              <span>Notifikasi Chat & Pop-Up Browser Aktif</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
          </div>
        )}

        {/* 4 Tabs: Direct, Obrolan Toko, Collectives, Anonymous Match */}
        <div className="flex border-b-2 border-black/5 mb-6 overflow-x-auto scrollbar-none">
          <button 
            onClick={() => setActiveTab('direct')}
            className={`flex-1 min-w-[70px] py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-all border-b-2 ${
              activeTab === 'direct' ? 'border-black text-black' : 'border-transparent text-gray-400'
            }`}
          >
            Direct
          </button>

          <button 
            onClick={() => setActiveTab('shop')}
            className={`flex-1 min-w-[110px] py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-all border-b-2 flex items-center justify-center space-x-1.5 ${
              activeTab === 'shop' ? 'border-yellow-500 text-yellow-600 font-extrabold' : 'border-transparent text-gray-400'
            }`}
          >
            <i className="fas fa-store text-yellow-500 text-xs"></i>
            <span>Obrolan Toko</span>
          </button>

          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-all border-b-2 ${
              activeTab === 'groups' ? 'border-black text-black' : 'border-transparent text-gray-400'
            }`}
          >
            Collectives
          </button>

          <button 
            onClick={() => setActiveTab('anonymous')}
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-all border-b-2 flex items-center justify-center space-x-1 ${
              activeTab === 'anonymous' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400'
            }`}
          >
            <i className="fas fa-user-ninja text-xs"></i>
            <span>{t('anon_match')}</span>
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {activeTab === 'direct' && (
            mutualFollowers.length === 0 ? (
              <div className="text-center py-20 text-gray-400 italic text-sm px-6">
                Direct whispers are only for mutual orbit members (who follow each other).
              </div>
            ) : (
              mutualFollowers.map(u => (
                <div key={u.id} className="flex items-center border border-black/5 rounded-2xl hover:border-black transition-all group p-4 bg-white shadow-sm">
                  <img 
                    src={u.photoURL} 
                    className="w-12 h-12 rounded-full mr-4 border border-black/10 bg-gray-100 cursor-pointer object-cover shadow-sm" 
                    alt={u.name} 
                    onClick={() => onUserClick(u.id)}
                  />
                  <button 
                    onClick={() => setSelectedRecipient({ type: 'user', data: u })}
                    className="flex-1 text-left"
                  >
                    <p className="font-bold text-sm uppercase">{u.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Mutual Connection</p>
                  </button>
                  <button
                    onClick={(e) => handleClearDirectUserChat(u.id, e)}
                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full text-xs transition-colors mr-2"
                    title="Hapus riwayat obrolan"
                  >
                    <i className="fas fa-trash-can"></i>
                  </button>
                  <i className="fas fa-chevron-right text-gray-200 group-hover:text-black transition-colors"></i>
                </div>
              ))
            )
          )}

          {activeTab === 'shop' && (
            <div className="space-y-4">
              {/* Banner Info Obrolan Toko */}
              <div className="bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-100 border border-yellow-300 rounded-3xl p-4 shadow-sm flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-black flex items-center justify-center text-xl shrink-0 shadow-md">
                  <i className="fas fa-comments-dollar"></i>
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase text-gray-900">Obrolan Toko & Jual Beli</h3>
                  <p className="text-[11px] text-gray-600 font-medium leading-tight mt-0.5">
                    Tanya jawab seputar barang, penawaran harga, & kesepakatan transaksi langsung dengan penjual atau pembeli!
                  </p>
                </div>
              </div>

              {/* Search Seller / Buyer */}
              <div className="relative">
                <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Cari penjual atau pembeli di Vimos..."
                  value={shopSearchQuery}
                  onChange={(e) => setShopSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:border-black shadow-sm"
                />
              </div>

              {/* List of Active Shop Chats */}
              <div className="space-y-2">
                {shopChatThreads.filter(thread => (
                  !shopSearchQuery || 
                  thread.otherUser.name.toLowerCase().includes(shopSearchQuery.toLowerCase()) || 
                  thread.lastMessage.toLowerCase().includes(shopSearchQuery.toLowerCase())
                )).length === 0 ? (
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-3 my-4">
                    <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto shadow-sm">
                      <i className="fas fa-store-slash"></i>
                    </div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase">Belum Ada Obrolan Toko</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Obrolan jual beli dengan penjual atau pembeli akan otomatis muncul di sini begitu Anda menanyakan atau membeli produk dari Toko Vimos.
                    </p>
                  </div>
                ) : (
                  shopChatThreads
                    .filter(thread => (
                      !shopSearchQuery || 
                      thread.otherUser.name.toLowerCase().includes(shopSearchQuery.toLowerCase()) || 
                      thread.lastMessage.toLowerCase().includes(shopSearchQuery.toLowerCase())
                    ))
                    .map(thread => (
                      <div 
                        key={thread.chatId} 
                        className="flex items-center border border-gray-200 rounded-2xl hover:border-black transition-all group p-3.5 bg-white shadow-sm cursor-pointer"
                        onClick={() => setSelectedRecipient({ type: 'user', data: thread.otherUser })}
                      >
                        <img 
                          src={thread.otherUser.photoURL} 
                          className="w-12 h-12 rounded-full mr-3.5 border border-black/10 bg-gray-100 object-cover shadow-sm shrink-0" 
                          alt={thread.otherUser.name} 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUserClick(thread.otherUser.id);
                          }}
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 truncate">
                              <p className="font-extrabold text-xs uppercase text-gray-900 truncate">{thread.otherUser.name}</p>
                              <span className="bg-yellow-400 text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                                <i className="fas fa-store text-[8px] mr-1"></i>Toko / Jual Beli
                              </span>
                            </div>
                            {thread.timestamp > 0 && (
                              <span className="text-[9px] text-gray-400 font-medium ml-2 shrink-0">
                                {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-600 font-medium truncate mt-1">
                            {thread.lastMessageSenderId === currentUser?.id ? 'Anda: ' : ''}{thread.lastMessage}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecipient({ type: 'user', data: thread.otherUser });
                          }}
                          className="bg-black hover:bg-gray-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full shadow-sm ml-2 shrink-0 transition-all active:scale-95 flex items-center space-x-1"
                        >
                          <i className="fas fa-comment-dots text-[10px]"></i>
                          <span>Chat</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteShopChatThread(thread.chatId, e)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full text-xs transition-colors ml-1"
                          title="Hapus obrolan toko ini"
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'groups' && (
            groups.length === 0 ? (
              <div className="text-center py-20 text-gray-400 italic text-sm">You haven't joined any collectives yet.</div>
            ) : (
              groups.map(g => (
                <div key={g.id} className="flex items-center border border-black/5 rounded-2xl hover:border-black transition-all group p-4 bg-white shadow-sm">
                  {g.photoURL ? (
                    <img src={g.photoURL} className="w-12 h-12 rounded-full mr-4 border border-black/10 object-cover shadow-sm" alt={g.name} />
                  ) : (
                    <div className="w-12 h-12 rounded-full mr-4 bg-black text-white flex items-center justify-center text-lg font-black border border-black/10">
                      {g.name.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedRecipient({ type: 'group', data: g })}
                    className="flex-1 text-left"
                  >
                    <p className="font-bold text-sm uppercase">{g.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{g.participants.length} Orbit Members</p>
                  </button>
                  <i className="fas fa-chevron-right text-gray-200 group-hover:text-black transition-colors"></i>
                </div>
              ))
            )
          )}

          {activeTab === 'anonymous' && (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 my-auto">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-red-600 via-zinc-900 to-black p-1 shadow-2xl flex items-center justify-center">
                  <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center text-4xl text-red-500 border border-red-500/30">
                    <i className={`fas ${isSearchingAnon ? 'fa-spinner fa-spin' : 'fa-user-ninja'}`}></i>
                  </div>
                </div>
                {isSearchingAnon && (
                  <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping"></span>
                )}
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-black uppercase tracking-tight text-black">
                  Obrolan Anonim Acak
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Cari teman bicara secara acak tanpa nampak foto maupun nama asli Anda. Jika Anda dan lawan bicara sama-sama tertarik, tekan tombol <span className="font-black text-red-600">Follow</span> untuk mengungkap profil masing-masing!
                </p>
              </div>

              {isSearchingAnon ? (
                <div className="space-y-4 w-full max-w-xs">
                  <div className="p-3 bg-red-50 border border-red-300 rounded-2xl text-xs font-black uppercase tracking-wider text-red-600 animate-pulse">
                    🔍 {t('anon_searching')}
                  </div>
                  <button
                    onClick={handleCancelSearch}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-black p-3.5 rounded-2xl font-black uppercase text-xs tracking-wider border border-black/10 transition-all active:scale-95"
                  >
                    {t('anon_cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleFindAnonMatch}
                  className="w-full max-w-xs bg-red-600 hover:bg-red-700 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-2"
                >
                  <i className="fas fa-dice text-base"></i>
                  <span>{t('anon_find')}</span>
                </button>
              )}
            </div>
          )}
        </div>
        {renderConfirmModal()}
      </div>
    );
  }

  const headerTitle = selectedRecipient.type === 'user' 
    ? (selectedRecipient.data as User).name 
    : (selectedRecipient.data as Group).name;

  const headerPhoto = selectedRecipient.type === 'user' 
    ? (selectedRecipient.data as User).photoURL 
    : (selectedRecipient.data as Group).photoURL;

  const activeGroupCall = selectedRecipient.type === 'group'
    ? activeCalls.find(c => 
        c.type === 'collective' && 
        c.status !== 'ended' && 
        c.groupId === selectedRecipient.data.id
      )
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      <div className="p-4 border-b border-black/5 flex items-center space-x-3 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <button onClick={() => setSelectedRecipient(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <i className="fas fa-arrow-left"></i>
        </button>
        {headerPhoto ? (
          <img 
            src={headerPhoto} 
            className="w-10 h-10 rounded-full bg-gray-100 cursor-pointer object-cover border border-black/10 shadow-sm" 
            alt={headerTitle} 
            onClick={() => selectedRecipient.type === 'user' ? onUserClick((selectedRecipient.data as User).id) : setIsViewingGroupSettings(true)}
          />
        ) : (
          <div 
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black cursor-pointer shadow-sm"
            onClick={() => setIsViewingGroupSettings(true)}
          >
            {headerTitle.substring(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 
            className="font-black text-sm uppercase tracking-tighter truncate cursor-pointer hover:underline"
            onClick={() => selectedRecipient.type === 'user' ? onUserClick((selectedRecipient.data as User).id) : setIsViewingGroupSettings(true)}
          >
            {headerTitle}
          </h3>
          {selectedRecipient.type === 'group' && (
            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Collective Frequency</p>
          )}
        </div>
        {selectedRecipient.type === 'user' ? (
          <div className="flex items-center space-x-1">
            {onStartCall && (
              <>
                <button
                  onClick={() => onStartCall('private', 'audio', (selectedRecipient.data as User).id)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-zinc-600 hover:text-black transition-colors"
                  title={t('start_voice_call')}
                >
                  <i className="fas fa-phone"></i>
                </button>
                <button
                  onClick={() => onStartCall('private', 'video', (selectedRecipient.data as User).id)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-zinc-600 hover:text-black transition-colors"
                  title={t('start_video_call')}
                >
                  <i className="fas fa-video"></i>
                </button>
              </>
            )}
            <button
              onClick={handleClearChatForMe}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors ml-1"
              title="Hapus Obrolan untuk Saya"
            >
              <i className="fas fa-trash-can"></i>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            {activeGroupCall ? (
              <button 
                onClick={() => onJoinCall && onJoinCall(activeGroupCall.id)}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 animate-pulse shadow-md"
              >
                <i className="fas fa-phone"></i>
                <span>{t('join_call')}</span>
              </button>
            ) : (
              onStartCall && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onStartCall('collective', 'audio', (selectedRecipient.data as Group).id, (selectedRecipient.data as Group).name)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-zinc-600 hover:text-black transition-colors"
                    title={t('start_voice_call')}
                  >
                    <i className="fas fa-phone"></i>
                  </button>
                  <button
                    onClick={() => onStartCall('collective', 'video', (selectedRecipient.data as Group).id, (selectedRecipient.data as Group).name)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-zinc-600 hover:text-black transition-colors"
                    title={t('start_video_call')}
                  >
                    <i className="fas fa-video"></i>
                  </button>
                </div>
              )
            )}
            <button
              onClick={handleClearChatForMe}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Hapus Obrolan untuk Saya"
            >
              <i className="fas fa-trash-can"></i>
            </button>
            <button 
              onClick={() => setIsViewingGroupSettings(true)} 
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-ellipsis-vertical"></i>
            </button>
          </div>
        )}
      </div>
      
      {/* Backdrop overlay for active message options menu */}
      {activeMenuMsgId && (
        <div 
          className="fixed inset-0 z-20 bg-transparent" 
          onClick={() => setActiveMenuMsgId(null)} 
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs italic">
            Belum ada pesan dalam obrolan ini.
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUser?.id;
            const sender = users.find(u => u.id === m.senderId);
            const isMenuOpen = activeMenuMsgId === m.id;

            return (
              <div key={m.id} className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start animate-fade-in'}`}>
                {!isMe && selectedRecipient.type === 'group' && (
                  <span className="text-[8px] font-black uppercase tracking-widest mb-1 ml-1 opacity-40">{sender?.name || 'Orbit'}</span>
                )}
                
                <div className="flex items-center space-x-2 max-w-[85%] relative">
                  {/* Action menu button for sent messages */}
                  {isMe && (
                    <div className="relative shrink-0 z-30">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMsgId(isMenuOpen ? null : m.id);
                        }}
                        className="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-black p-1.5 text-xs rounded-full hover:bg-gray-200"
                        title="Opsi Pesan"
                      >
                        <i className="fas fa-ellipsis-v"></i>
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl py-1.5 px-2 z-30 min-w-[170px] space-y-1 text-left animate-fade-in">
                          <button
                            onClick={(e) => handleDeleteMessageForMe(m.id, e)}
                            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors"
                          >
                            <i className="fas fa-trash-can text-xs"></i>
                            <span>Hapus untuk Saya</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteMessageForEveryone(m.id, e)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors"
                          >
                            <i className="fas fa-trash-arrow-up text-xs"></i>
                            <span>Hapus untuk Semua</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble - Tapping opens option menu */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMsgId(isMenuOpen ? null : m.id);
                    }}
                    className={`p-4 rounded-3xl text-sm font-medium shadow-sm transition-all cursor-pointer hover:scale-[1.01] ${
                      isMe ? 'bg-black text-white rounded-br-none' : 'bg-white border border-black/5 text-black rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Action menu button for received messages */}
                  {!isMe && (
                    <div className="relative shrink-0 z-30">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMsgId(isMenuOpen ? null : m.id);
                        }}
                        className="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-black p-1.5 text-xs rounded-full hover:bg-gray-200"
                        title="Opsi Pesan"
                      >
                        <i className="fas fa-ellipsis-v"></i>
                      </button>

                      {isMenuOpen && (
                        <div className="absolute left-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl py-1.5 px-2 z-30 min-w-[170px] text-left animate-fade-in">
                          <button
                            onClick={(e) => handleDeleteMessageForMe(m.id, e)}
                            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors"
                          >
                            <i className="fas fa-trash-can text-xs"></i>
                            <span>Hapus untuk Saya</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-black/5 bg-white flex space-x-2">
        <input 
          type="text" 
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Type a whisper..."
          className="flex-1 bg-gray-50 border-2 border-black rounded-full px-6 py-3 text-sm focus:outline-none focus:bg-white transition-all shadow-inner"
        />
        <button 
          type="submit" 
          disabled={!msg.trim()}
          className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg disabled:opacity-20"
        >
          <i className="fas fa-paper-plane text-sm"></i>
        </button>
      </form>

      {/* CUSTOM CONFIRMATION MODAL POP-UP FOR CHATS */}
      {renderConfirmModal()}
    </div>
  );
};

export default Chat;
