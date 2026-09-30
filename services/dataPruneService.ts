import { ref, get, remove } from 'firebase/database';
import { db } from '../firebase.ts';

// 30 days retention policy in milliseconds
export const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export const ADMIN_PROTECTED_EMAILS = [
  'nwaystore68@gmail.com',
  'nwaystore78@gmail.com',
  'nocteos609@gmail.com',
  'hasbullahbeloh27@gmail.com',
  'nocteos60@gmail.com'
];

export interface PruneStats {
  deletedPosts: number;
  deletedMessages: number;
  deletedChats: number;
  deletedUsers: number;
  timestamp: number;
}

export interface PrunePreview {
  expiredPostsCount: number;
  expiredMessagesCount: number;
  expiredChatsCount: number;
  expiredUsersCount: number;
}

/**
 * Check if a user is protected from deletion (Admins, Staff, and TOKO / Merchant accounts)
 */
export const isProtectedUser = (
  email?: string, 
  isAdmin?: boolean, 
  role?: string, 
  currentUserId?: string, 
  targetUserId?: string,
  userVal?: any,
  shopOwnerIds?: Set<string>
): boolean => {
  if (currentUserId && targetUserId && currentUserId === targetUserId) {
    return true; // Never delete current active user
  }
  if (isAdmin === true) return true;
  if (role && (role.toLowerCase().includes('admin') || role.toLowerCase().includes('staff') || role.toLowerCase().includes('creator'))) {
    return true;
  }
  if (email && ADMIN_PROTECTED_EMAILS.some(adminEmail => adminEmail.toLowerCase() === email.toLowerCase())) {
    return true;
  }
  
  // EXCEPTION FOR TOKO: Protect shop owners, verified sellers, and seller applicants
  if (targetUserId && shopOwnerIds && shopOwnerIds.has(targetUserId)) {
    return true; // Owner of a shop or seller item
  }
  if (userVal?.isVerifiedSeller === true || userVal?.sellerStatus === 'approved' || userVal?.sellerStatus === 'pending') {
    return true; // Approved or pending seller account
  }
  if (userVal?.shopId || userVal?.hasShop) {
    return true;
  }

  return false;
};

/**
 * Helper to determine if a chat message or thread is related to Toko / Shop
 */
export const isShopMessageOrThread = (msg: any, chatVal?: any): boolean => {
  if (chatVal?.isShopChat === true || chatVal?.isShop === true) return true;
  if (msg?.isShop === true || msg?.isShopChat === true) return true;
  if (typeof msg?.text === 'string') {
    const textLower = msg.text.toLowerCase();
    if (
      textLower.includes('tertarik untuk membeli') ||
      textLower.includes('membeli produk') ||
      textLower.includes('dari toko anda') ||
      textLower.includes('harga: rp') ||
      textLower.includes('pesanan toko') ||
      textLower.includes('order id') ||
      textLower.includes('produk:') ||
      textLower.includes('#toko') ||
      textLower.includes('[toko]')
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Helper to determine if a post is related to Toko / Shop
 */
export const isShopPost = (post: any, shopOwnerIds?: Set<string>): boolean => {
  if (post?.isShop === true || post?.isShopPost === true) return true;
  if (post?.shopId || post?.itemId || post?.itemPrice) return true;
  if (post?.category === 'shop' || post?.category === 'toko') return true;
  if (post?.userId && shopOwnerIds && shopOwnerIds.has(post.userId)) return true;
  if (typeof post?.text === 'string') {
    const textLower = post.text.toLowerCase();
    if (textLower.includes('#toko') || textLower.includes('[toko]') || textLower.includes('katalog toko') || textLower.includes('produk toko')) {
      return true;
    }
  }
  return false;
};

/**
 * Retrieve all user IDs associated with Toko (shops, shop items, seller applications)
 */
export const getShopOwnerIds = async (): Promise<Set<string>> => {
  const shopOwnerIds = new Set<string>();

  try {
    // 1. Check shops
    const shopsSnap = await get(ref(db, 'shops'));
    if (shopsSnap.exists()) {
      const shopsData = shopsSnap.val();
      Object.values(shopsData).forEach((shop: any) => {
        if (shop?.ownerId) shopOwnerIds.add(shop.ownerId);
      });
    }

    // 2. Check shopItems
    const itemsSnap = await get(ref(db, 'shopItems'));
    if (itemsSnap.exists()) {
      const itemsData = itemsSnap.val();
      Object.values(itemsData).forEach((item: any) => {
        if (item?.ownerId) shopOwnerIds.add(item.ownerId);
      });
    }

    // 3. Check sellerApplications (approved & pending)
    const appsSnap = await get(ref(db, 'sellerApplications'));
    if (appsSnap.exists()) {
      const appsData = appsSnap.val();
      Object.entries(appsData).forEach(([uid, appVal]: [string, any]) => {
        if (appVal?.status === 'approved' || appVal?.status === 'pending' || uid) {
          shopOwnerIds.add(appVal.userId || uid);
        }
      });
    }
  } catch (err) {
    console.warn('Error fetching shop owners:', err);
  }

  return shopOwnerIds;
};

/**
 * Scan Firebase RTDB to find candidate records older than 1 month (30 days),
 * EXCLUDING all Toko / Shop items, accounts, chats, and posts.
 */
export const scanExpiredData = async (currentUserId?: string): Promise<PrunePreview> => {
  const cutoffTime = Date.now() - RETENTION_PERIOD_MS;
  let expiredPostsCount = 0;
  let expiredMessagesCount = 0;
  let expiredChatsCount = 0;
  let expiredUsersCount = 0;

  try {
    const shopOwnerIds = await getShopOwnerIds();

    // 1. Scan Posts (EXCEPT Toko posts)
    const postsSnap = await get(ref(db, 'posts'));
    if (postsSnap.exists()) {
      const postsData = postsSnap.val();
      Object.values(postsData).forEach((post: any) => {
        // Toko posts are preserved
        if (isShopPost(post, shopOwnerIds)) {
          return;
        }
        if (post && post.timestamp && post.timestamp < cutoffTime) {
          expiredPostsCount++;
        }
      });
    }

    // 2. Scan Chats & Messages (EXCEPT Toko chats & orders)
    const chatsSnap = await get(ref(db, 'chats'));
    if (chatsSnap.exists()) {
      const chatsData = chatsSnap.val();
      Object.entries(chatsData).forEach(([_, chatVal]: [string, any]) => {
        // Entire Toko chats are preserved
        if (chatVal?.isShopChat === true || chatVal?.isShop === true) {
          return;
        }

        const messages = chatVal?.messages;
        let allMessagesExpired = true;
        let msgCountInChat = 0;
        let hasShopMessage = false;

        if (messages && typeof messages === 'object') {
          Object.values(messages).forEach((msg: any) => {
            msgCountInChat++;
            if (isShopMessageOrThread(msg, chatVal)) {
              hasShopMessage = true;
              allMessagesExpired = false;
              return;
            }

            if (msg && msg.timestamp && msg.timestamp < cutoffTime) {
              expiredMessagesCount++;
            } else {
              allMessagesExpired = false;
            }
          });
        }

        // If chat has shop inquiries, never delete the chat room
        if (hasShopMessage) {
          return;
        }

        if (msgCountInChat > 0 && allMessagesExpired) {
          expiredChatsCount++;
        } else if (chatVal?.lastMessageTimestamp && chatVal.lastMessageTimestamp < cutoffTime) {
          expiredChatsCount++;
        }
      });
    }

    // 3. Scan Users (EXCEPT Toko / Seller accounts)
    const usersSnap = await get(ref(db, 'users'));
    const statusSnap = await get(ref(db, 'status'));
    const statusData = statusSnap.exists() ? statusSnap.val() : {};

    if (usersSnap.exists()) {
      const usersData = usersSnap.val();
      Object.entries(usersData).forEach(([uid, userVal]: [string, any]) => {
        if (isProtectedUser(userVal.email, userVal.isAdmin, userVal.role, currentUserId, uid, userVal, shopOwnerIds)) {
          return; // Skip protected users and Toko accounts
        }

        const userStatus = statusData[uid];
        const lastActivity = userStatus?.last_changed || userVal.lastSeen || userVal.lastLogin || userVal.createdAt || 0;
        
        // If account has had zero activity or last activity is older than 30 days
        if (lastActivity > 0 && lastActivity < cutoffTime) {
          expiredUsersCount++;
        }
      });
    }
  } catch (err) {
    console.warn('Error during scanExpiredData:', err);
  }

  return {
    expiredPostsCount,
    expiredMessagesCount,
    expiredChatsCount,
    expiredUsersCount
  };
};

/**
 * Execute real deletion from Firebase Realtime Database
 * EXCEPT all Toko / Shop items, accounts, chats, and posts.
 */
export const executeDataPrune = async (currentUserId?: string): Promise<PruneStats> => {
  const cutoffTime = Date.now() - RETENTION_PERIOD_MS;
  let deletedPosts = 0;
  let deletedMessages = 0;
  let deletedChats = 0;
  let deletedUsers = 0;

  try {
    const shopOwnerIds = await getShopOwnerIds();

    // 1. Purge Posts > 1 month (EXCEPT Toko posts)
    const postsSnap = await get(ref(db, 'posts'));
    if (postsSnap.exists()) {
      const postsData = postsSnap.val();
      const deletePromises: Promise<any>[] = [];

      Object.entries(postsData).forEach(([postId, postVal]: [string, any]) => {
        // Toko posts are preserved
        if (isShopPost(postVal, shopOwnerIds)) {
          return;
        }

        if (postVal && postVal.timestamp && postVal.timestamp < cutoffTime) {
          deletePromises.push(remove(ref(db, `posts/${postId}`)));
          deletedPosts++;
        }
      });

      await Promise.allSettled(deletePromises);
    }

    // 2. Purge Chats > 1 month (direct chats & messages, EXCEPT Toko chats)
    const chatsSnap = await get(ref(db, 'chats'));
    if (chatsSnap.exists()) {
      const chatsData = chatsSnap.val();
      const chatPromises: Promise<any>[] = [];

      Object.entries(chatsData).forEach(([chatId, chatVal]: [string, any]) => {
        // Entire Toko chats are preserved
        if (chatVal?.isShopChat === true || chatVal?.isShop === true) {
          return;
        }

        const messages = chatVal?.messages;
        let remainingActiveMessages = 0;
        let hasShopMessage = false;

        if (messages && typeof messages === 'object') {
          Object.entries(messages).forEach(([msgId, msgVal]: [string, any]) => {
            // Keep Toko messages intact
            if (isShopMessageOrThread(msgVal, chatVal)) {
              hasShopMessage = true;
              remainingActiveMessages++;
              return;
            }

            if (msgVal && msgVal.timestamp && msgVal.timestamp < cutoffTime) {
              chatPromises.push(remove(ref(db, `chats/${chatId}/messages/${msgId}`)));
              deletedMessages++;
            } else {
              remainingActiveMessages++;
            }
          });
        }

        // Never delete chat room if it contains shop messages or orders
        if (hasShopMessage) {
          return;
        }

        // If no active messages left or last message timestamp is older than 30 days, purge entire non-shop chat room
        if (remainingActiveMessages === 0 || (chatVal?.lastMessageTimestamp && chatVal.lastMessageTimestamp < cutoffTime)) {
          chatPromises.push(remove(ref(db, `chats/${chatId}`)));
          deletedChats++;
        }
      });

      await Promise.allSettled(chatPromises);
    }

    // 2.1 Purge Group messages > 1 month (non-shop)
    try {
      const groupsSnap = await get(ref(db, 'groups'));
      if (groupsSnap.exists()) {
        const groupsData = groupsSnap.val();
        const groupMsgPromises: Promise<any>[] = [];

        Object.entries(groupsData).forEach(([groupId, groupVal]: [string, any]) => {
          const groupMessages = groupVal?.messages;
          if (groupMessages && typeof groupMessages === 'object') {
            Object.entries(groupMessages).forEach(([msgId, msgVal]: [string, any]) => {
              if (isShopMessageOrThread(msgVal, groupVal)) {
                return;
              }
              if (msgVal && msgVal.timestamp && msgVal.timestamp < cutoffTime) {
                groupMsgPromises.push(remove(ref(db, `groups/${groupId}/messages/${msgId}`)));
                deletedMessages++;
              }
            });
          }
        });

        await Promise.allSettled(groupMsgPromises);
      }
    } catch {}

    // 3. Purge Inactive Accounts > 1 month (EXCEPT Toko / Seller accounts)
    const usersSnap = await get(ref(db, 'users'));
    const statusSnap = await get(ref(db, 'status'));
    const statusData = statusSnap.exists() ? statusSnap.val() : {};

    if (usersSnap.exists()) {
      const usersData = usersSnap.val();
      const userDeletePromises: Promise<any>[] = [];

      Object.entries(usersData).forEach(([uid, userVal]: [string, any]) => {
        // Protect admins, creators, staff, current active user, and ALL TOKO / SELLER accounts
        if (isProtectedUser(userVal.email, userVal.isAdmin, userVal.role, currentUserId, uid, userVal, shopOwnerIds)) {
          return;
        }

        const userStatus = statusData[uid];
        const lastActivity = userStatus?.last_changed || userVal.lastSeen || userVal.lastLogin || userVal.createdAt || 0;

        // If last active timestamp is older than 30 days (or non-existent older account)
        if (lastActivity > 0 && lastActivity < cutoffTime) {
          userDeletePromises.push(remove(ref(db, `users/${uid}`)));
          userDeletePromises.push(remove(ref(db, `status/${uid}`)));
          userDeletePromises.push(remove(ref(db, `notifications/${uid}`)));
          deletedUsers++;
        }
      });

      await Promise.allSettled(userDeletePromises);
    }

    // Record last prune execution time in localStorage
    try {
      localStorage.setItem('vimos_last_prune_time', String(Date.now()));
      localStorage.setItem('vimos_last_prune_stats', JSON.stringify({
        deletedPosts,
        deletedMessages,
        deletedChats,
        deletedUsers,
        timestamp: Date.now()
      }));
    } catch {}

  } catch (error) {
    console.error('Error executing data prune:', error);
  }

  return {
    deletedPosts,
    deletedMessages,
    deletedChats,
    deletedUsers,
    timestamp: Date.now()
  };
};
