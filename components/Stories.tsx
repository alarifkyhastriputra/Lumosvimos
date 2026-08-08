import React, { useState, useRef } from 'react';
import { Story, User, LiveStream } from '../types.ts';
import { useLanguage } from '../LanguageContext.tsx';

interface StoriesProps {
  stories: Story[];
  currentUser: User;
  onAddStory: (text: string, photoURL: string) => void;
  users: User[];
  activeStreams?: LiveStream[];
  onStreamClick?: (streamId: string) => void;
  onGoLiveClick?: () => void;
}

const Stories: React.FC<StoriesProps> = ({ 
  stories, 
  currentUser, 
  onAddStory, 
  users,
  activeStreams = [],
  onStreamClick,
  onGoLiveClick
}) => {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = () => {
    if (text.trim() || photoURL) {
      onAddStory(text, photoURL);
      setText('');
      setPhotoURL('');
      setIsAdding(false);
    }
  };

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <div className="w-full mb-6">
      <div className="flex space-x-4 overflow-x-auto pb-4 px-4 hide-scrollbar">
        {/* Add Story Button */}
        <div className="flex flex-col items-center space-y-2 flex-shrink-0 cursor-pointer" onClick={() => setIsAdding(true)}>
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-black transition-colors">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="Me" className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
            ) : null}
            <i className="fas fa-plus absolute text-gray-500 group-hover:text-black transition-colors"></i>
          </div>
          <span className="text-xs font-medium text-gray-600">{t('add_story')}</span>
        </div>

        {/* Active Live Streams Circles */}
        {activeStreams.map((stream) => (
          <div 
            key={`live-${stream.id}`} 
            className="flex flex-col items-center space-y-2 flex-shrink-0 cursor-pointer animate-fade-in"
            onClick={() => onStreamClick && onStreamClick(stream.id)}
          >
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 animate-spin"></div>
              <div className="w-16 h-16 rounded-full p-[2px] bg-white relative z-10">
                <img 
                  src={stream.hostPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${stream.hostName}`} 
                  alt={stream.hostName} 
                  className="w-full h-full rounded-full object-cover" 
                />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white z-20 shadow-lg">
                LIVE
              </span>
            </div>
            <span className="text-xs font-bold text-red-600 truncate w-16 text-center">{stream.hostName.split(' ')[0]}</span>
          </div>
        ))}

        {/* Story List */}
        {stories.map((story, index) => {
          const user = users.find(u => u.id === story.userId) || { name: story.userName, photoURL: story.userPhoto };
          return (
            <div key={story.id} className="flex flex-col items-center space-y-2 flex-shrink-0 cursor-pointer" onClick={() => setActiveStoryIndex(index)}>
              <div className="w-16 h-16 rounded-full border-2 border-blue-500 p-[2px]">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}&backgroundColor=000000`} alt={user.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <span className="text-xs font-medium text-gray-800 truncate w-16 text-center">{user.name.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Add Story Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsAdding(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black">
              <i className="fas fa-times"></i>
            </button>
            <h3 className="text-xl font-bold mb-4">{t('add_story')}</h3>
            
            <textarea
              className="w-full bg-gray-50 rounded-xl p-4 mb-4 outline-none resize-none h-24 text-lg"
              placeholder={t('story_text_placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {photoURL && (
              <div className="relative mb-4 rounded-xl overflow-hidden aspect-square">
                <img src={photoURL} alt="Upload preview" className="w-full h-full object-cover" />
                <button onClick={() => setPhotoURL('')} className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <i className="fas fa-image"></i>
              </button>
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              
              <button 
                onClick={handleAdd}
                disabled={!text.trim() && !photoURL}
                className="bg-black text-white px-6 py-2 rounded-full font-bold uppercase tracking-wide text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {t('post')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Story Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* Progress Bar (Visual Only) */}
          <div className="absolute top-4 left-4 right-4 flex space-x-2 z-20">
            {stories.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-all ${i === activeStoryIndex ? 'w-full' : i < activeStoryIndex! ? 'w-full' : 'w-0'}`}></div>
              </div>
            ))}
          </div>

          {/* Close & Author */}
          <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-20">
            <div className="flex items-center space-x-3">
              <img src={activeStory.userPhoto} alt={activeStory.userName} className="w-10 h-10 rounded-full border border-white/20" />
              <div>
                <p className="text-white font-bold text-sm">{activeStory.userName}</p>
                <p className="text-white/70 text-xs">{new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <button onClick={() => setActiveStoryIndex(null)} className="text-white w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Nav Areas */}
          <div 
            className="absolute top-0 bottom-0 left-0 w-1/3 z-10 cursor-pointer"
            onClick={() => setActiveStoryIndex(Math.max(0, activeStoryIndex! - 1))}
          ></div>
          <div 
            className="absolute top-0 bottom-0 right-0 w-1/3 z-10 cursor-pointer"
            onClick={() => {
              if (activeStoryIndex! < stories.length - 1) {
                setActiveStoryIndex(activeStoryIndex! + 1);
              } else {
                setActiveStoryIndex(null);
              }
            }}
          ></div>

          {/* Story Content */}
          <div className="w-full max-w-md aspect-[9/16] relative bg-zinc-900 flex flex-col items-center justify-center rounded-2xl overflow-hidden">
            {activeStory.photoURL && (
              <img src={activeStory.photoURL} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
            )}
            {activeStory.text && (
              <div className="relative z-10 p-8 text-center">
                <p className={`text-white font-bold leading-tight ${activeStory.photoURL ? 'bg-black/50 p-4 rounded-xl backdrop-blur-sm text-xl' : 'text-3xl'}`}>
                  {activeStory.text}
                </p>
              </div>
            )}
            
            {/* Auto-advance logic could go here but omitted for brevity in a simple clone */}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stories;
