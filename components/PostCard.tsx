
import React, { useState } from 'react';
import { Post, User } from '../types';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onDislike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onUserClick: (userId: string) => void;
  currentUser: User;
  onFollow: (userId: string) => void;
  onTakeDownPost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  users: User[];
}

const PostCard: React.FC<PostCardProps> = ({ 
  post, onLike, onDislike, onComment, onUserClick, currentUser, onFollow, onTakeDownPost, onDeletePost, users 
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  
  const postUser = users.find(u => u.id === post.userId);
  const isFollowing = (currentUser.following || []).includes(post.userId);
  const isMe = currentUser.id === post.userId;
  const hasLiked = (post.likes || []).includes(currentUser.id);
  const hasDisliked = (post.dislikes || []).includes(currentUser.id);
  const isAdmin = currentUser.isAdmin;

  const fallbackPhoto = `https://api.dicebear.com/7.x/initials/svg?seed=${post.userName}&backgroundColor=000000&fontFamily=Inter&fontWeight=700`;

  const formattedDate = new Date(post.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  return (
    <article className={`border rounded-2xl overflow-hidden transition-all shadow-sm ${
      post.isTakenDown 
        ? 'opacity-70 grayscale border-red-500/30 bg-red-50/20' 
        : 'bg-white border-black/10 hover:border-black/30'
    }`}>
      {isZoomed && post.photoURL && (
        <div 
          className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center cursor-zoom-out backdrop-blur-md"
          onClick={() => setIsZoomed(false)}
        >
          <img src={post.photoURL} alt="Zoomed" className="max-w-[95vw] max-h-[95vh] object-contain select-none" />
          <button 
            onClick={() => setIsZoomed(false)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {post.musicURL && (
        <audio 
          src={post.musicURL} 
          loop 
          autoPlay={isPlayingMusic} 
          muted={!isPlayingMusic}
          className="hidden"
        />
      )}

      <div className="p-4 flex items-center space-x-3">
        <div className="relative">
          <img 
            src={post.userPhoto || fallbackPhoto} 
            alt={post.userName} 
            loading="lazy"
            decoding="async"
            className="w-10 h-10 rounded-full object-cover cursor-pointer border border-gray-100"
            onClick={() => onUserClick(post.userId)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <h3 className="font-bold text-sm cursor-pointer hover:underline truncate" onClick={() => onUserClick(post.userId)}>
              {post.userName || 'Anonymous'}
            </h3>
            
            {/* Custom Role Badge with color */}
            {postUser?.role && !postUser?.isAdmin && (
               <span 
                className="text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center space-x-1"
                style={{ backgroundColor: postUser.roleColor || '#000000' }}
               >
                <i className="fas fa-star text-[6px]"></i>
                <span>{postUser.role}</span>
              </span>
            )}

            {postUser?.isAdmin && (
               <span className="bg-black text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center space-x-1">
                 <i className="fas fa-crown text-[6px] text-yellow-400"></i>
                 <span>Admin King</span>
               </span>
            )}
            
            {post.isTakenDown && (
              <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center space-x-1">
                <i className="fas fa-shield-halved"></i>
                <span>Moderated</span>
              </span>
            )}

            {!isMe && (
              <button 
                onClick={() => onFollow(post.userId)}
                className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all shrink-0 ${
                  isFollowing ? 'border-gray-200 text-gray-400' : 'border-black text-black hover:bg-black hover:text-white'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{formattedDate}</p>
        </div>
        
        {post.musicURL && (
          <button 
            onClick={() => setIsPlayingMusic(!isPlayingMusic)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all border shrink-0 ${
              isPlayingMusic 
                ? 'text-white border-black bg-black animate-pulse' 
                : 'text-black border-black/10 bg-gray-50 hover:bg-gray-100'
            }`}
            title={isPlayingMusic ? "Mute Music" : "Play Music"}
          >
            <i className={`fas ${isPlayingMusic ? 'fa-music' : 'fa-volume-mute'} text-[10px]`}></i>
          </button>
        )}

        {isAdmin && (
          <button 
            onClick={() => onTakeDownPost && onTakeDownPost(post.id)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all border shrink-0 ${
              post.isTakenDown 
                ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100' 
                : 'text-red-500 border-red-100 bg-red-50 hover:bg-red-100'
            }`}
            title={post.isTakenDown ? "Restore Memory" : "Take Down Memory"}
          >
            <i className={`fas ${post.isTakenDown ? 'fa-shield-heart' : 'fa-shield-slash'} text-[10px]`}></i>
          </button>
        )}
        
        {isMe && onDeletePost && (
          <button 
            onClick={() => onDeletePost(post.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all border shrink-0 text-gray-500 border-gray-200 bg-gray-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
            title="Delete Post"
          >
            <i className="fas fa-trash text-[10px]"></i>
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${post.isTakenDown ? 'text-gray-500 italic' : 'text-gray-800'}`}>
          {post.text}
        </p>
      </div>

      {(post.photoURL || post.videoURL) && (
        <div className={`relative bg-black border-y border-black/5 overflow-hidden flex items-center justify-center min-h-[200px] ${post.isTakenDown ? 'opacity-30' : ''}`}>
          {post.photoURL && (
            <img 
              src={post.photoURL} 
              alt="Content" 
              loading="eager"
              fetchPriority="high"
              className="w-full h-auto max-h-[80vh] object-contain cursor-zoom-in animate-fade-in" 
              onClick={() => setIsZoomed(true)}
            />
          )}
          {post.videoURL && (
            <video 
              src={post.videoURL} 
              preload="auto"
              className="w-full h-auto max-h-[80vh] object-contain" 
              controls={!post.isTakenDown} 
              playsInline 
              muted 
            />
          )}
        </div>
      )}

      <div className="p-4 flex items-center space-x-6 border-t border-black/5">
        <button 
          onClick={() => !post.isTakenDown && onLike(post.id)}
          disabled={post.isTakenDown}
          className={`flex items-center space-x-1.5 transition-colors ${
            post.isTakenDown ? 'text-gray-200 pointer-events-none' : hasLiked ? 'text-red-500' : 'text-gray-500 hover:text-black'
          }`}
        >
          <i className={`${hasLiked ? 'fas fa-heart' : 'far fa-heart'}`}></i>
          <span className="text-xs font-bold">{(post.likes || []).length}</span>
        </button>

        <button 
          onClick={() => !post.isTakenDown && onDislike(post.id)}
          disabled={post.isTakenDown}
          className={`flex items-center space-x-1.5 transition-colors ${
            post.isTakenDown ? 'text-gray-200 pointer-events-none' : hasDisliked ? 'text-gray-900' : 'text-gray-400 hover:text-black'
          }`}
        >
          <i className={`${hasDisliked ? 'fas fa-thumbs-down' : 'far fa-thumbs-down'}`}></i>
          <span className="text-xs font-bold">{(post.dislikes || []).length}</span>
        </button>

        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center space-x-1.5 transition-colors ${
            showComments ? 'text-black' : 'text-gray-500 hover:text-black'
          }`}
        >
          <i className="far fa-comment"></i>
          <span className="text-xs font-bold">{(post.comments || []).length}</span>
        </button>

        <div className="ml-auto flex items-center space-x-2">
          {!post.isTakenDown && (
            <button 
              onClick={() => {
                const url = window.location.origin + '?post=' + post.id;
                if (navigator.share) {
                  navigator.share({
                    title: `Vimos Post by ${post.userName}`,
                    text: post.text || 'Check out this post on Vimos!',
                    url: url
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(url);
                  alert("Link copied to clipboard!");
                }
              }}
              className="flex items-center space-x-2 text-gray-500 hover:text-black"
            >
              <i className="far fa-paper-plane"></i>
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <div className="border-t border-black/5 bg-gray-50/50 transition-all">
          <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
            {(post.comments || []).length === 0 ? (
              <p className="text-[10px] text-gray-400 italic text-center py-2 uppercase tracking-widest">No thoughts shared yet</p>
            ) : (
              (post.comments || []).map((comment) => (
                <div key={comment.id} className="text-sm bg-white p-2 rounded-xl border border-black/5 shadow-sm">
                  <span className="font-bold text-[10px] uppercase tracking-tighter mr-2">{comment.userName}</span>
                  <span className="text-gray-700">{comment.text}</span>
                </div>
              ))
            )}
          </div>
          
          {!post.isTakenDown && (
            <form onSubmit={handleCommentSubmit} className="p-3 bg-white border-t border-black/5 flex items-center space-x-2">
              <input 
                type="text" 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a thought..."
                className="flex-1 bg-gray-50 border border-black/10 rounded-full px-4 py-1.5 text-xs focus:outline-none focus:border-black transition-all"
              />
              <button 
                type="submit" 
                disabled={!commentText.trim()}
                className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center disabled:opacity-30"
              >
                <i className="fas fa-arrow-up text-[10px]"></i>
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
};

export default React.memo(PostCard);
