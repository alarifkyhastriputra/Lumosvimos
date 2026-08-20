
import React from 'react';
import { Post, User, Announcement, Story, LiveStream } from '../types.ts';
import PostCard from './PostCard.tsx';
import Stories from './Stories.tsx';
import { useLanguage } from '../LanguageContext.tsx';

interface FeedProps {
  posts: Post[];
  stories?: Story[];
  onAddStory?: (text: string, photoURL: string) => void;
  announcements?: Announcement[];
  onLike: (postId: string) => void;
  onDislike: (postId: string) => void;
  onComment: (postId: string, text: string, replyTo?: { commentId?: string; userName?: string; userId?: string }) => void;
  onUserClick: (userId: string) => void;
  currentUser: User;
  onFollow: (userId: string) => void;
  onTakeDownPost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  users: User[];
  isLoading?: boolean;
  activeStreams?: LiveStream[];
  onStreamClick?: (streamId: string) => void;
  onGoLiveClick?: () => void;
}

const PostCardSkeleton: React.FC = () => {
  return (
    <div className="border border-black/5 rounded-3xl p-5 bg-white space-y-4 animate-pulse shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gray-100"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-gray-100 rounded-lg w-1/3"></div>
          <div className="h-3 bg-gray-100 rounded-lg w-1/4"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-100 rounded-lg"></div>
        <div className="h-4 bg-gray-100 rounded-lg w-5/6"></div>
      </div>
      <div className="h-44 bg-gray-50 rounded-2xl w-full"></div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-8 bg-gray-100 rounded-full w-20"></div>
        <div className="h-8 bg-gray-100 rounded-full w-20"></div>
        <div className="h-8 bg-gray-100 rounded-full w-20"></div>
      </div>
    </div>
  );
};

const StoriesSkeleton: React.FC = () => {
  return (
    <div className="flex space-x-4 overflow-x-auto pb-4 px-4 hide-scrollbar">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col items-center space-y-2 flex-shrink-0 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-50"></div>
          <div className="h-3 bg-gray-100 rounded w-12"></div>
        </div>
      ))}
    </div>
  );
};

const Feed: React.FC<FeedProps> = ({ 
  posts, 
  stories = [], 
  onAddStory, 
  announcements = [], 
  onLike, 
  onDislike, 
  onComment, 
  onUserClick, 
  currentUser, 
  onFollow, 
  onTakeDownPost, 
  onDeletePost, 
  users, 
  isLoading = false,
  activeStreams = [],
  onStreamClick,
  onGoLiveClick
}) => {
  const { t } = useLanguage();

  if (isLoading && posts.length === 0) {
    return (
      <div className="p-4 flex flex-col space-y-6">
        <StoriesSkeleton />
        <div className="space-y-6">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col space-y-6">
      {/* Stories Section */}
      {onAddStory && (
        <Stories 
          stories={stories} 
          currentUser={currentUser} 
          onAddStory={onAddStory} 
          users={users}
          activeStreams={activeStreams}
          onStreamClick={onStreamClick}
          onGoLiveClick={onGoLiveClick}
        />
      )}

      {/* King's Proclamation Section */}
      {announcements.length > 0 && (
        <div className="space-y-3 mb-2">
          {announcements.map((ann) => (
            <div 
              key={ann.id} 
              className="bg-black border-4 border-black rounded-2xl p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden group animate-fade-in"
            >
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="fas fa-crown text-4xl text-white"></i>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-[0.2em] flex items-center">
                  <i className="fas fa-crown text-[6px] mr-1"></i>
                  King's Broadcast
                </span>
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                  {new Date(ann.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-white text-sm font-bold leading-relaxed">
                {ann.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {isLoading && posts.length === 0 ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <i className="fas fa-ghost text-4xl mb-4"></i>
          <p className="font-medium">{t('nothing_here')}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard 
            key={post.id} 
            post={post} 
            onLike={onLike} 
            onDislike={onDislike}
            onComment={onComment}
            onUserClick={onUserClick}
            currentUser={currentUser}
            onFollow={onFollow}
            onTakeDownPost={onTakeDownPost}
            onDeletePost={onDeletePost}
            users={users}
          />
        ))
      )}
    </div>
  );
};

export default React.memo(Feed);
