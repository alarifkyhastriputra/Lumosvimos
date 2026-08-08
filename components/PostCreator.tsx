
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

interface PostCreatorProps {
  onPost: (data: { text: string; photoURL?: string; videoURL?: string; musicURL?: string }) => void;
}

const PREDEFINED_MUSIC = [
  { name: 'None', url: '' },
  { name: 'Lofi Chill', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
  { name: 'Acoustic Breeze', url: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b3cb81ed.mp3?filename=acoustic-motivational-113213.mp3' },
  { name: 'Cinematic Epic', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=epic-cinematic-trailer-103890.mp3' },
];

export const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return imageSrc;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg');
};

const PostCreator: React.FC<PostCreatorProps> = ({ onPost }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  
  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [musicURL, setMusicURL] = useState('');

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFinishCrop = async () => {
    if (preview?.type === 'image' && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(preview.url, croppedAreaPixels);
        setPreview({ url: croppedImage, type: 'image' });
        setIsCropping(false);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !preview) return;
    
    onPost({ 
      text, 
      photoURL: preview?.type === 'image' ? preview.url : undefined,
      videoURL: preview?.type === 'video' ? preview.url : undefined,
      musicURL: musicURL ? musicURL : undefined
    });
    
    setText('');
    setPreview(null);
    setMusicURL('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview({ url: reader.result as string, type });
        if (type === 'image') {
          setIsCropping(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">New Memory</h2>
      
      {isCropping && preview?.type === 'image' ? (
        <div className="space-y-4">
          <div className="relative w-full h-96 bg-black rounded-2xl overflow-hidden">
            <Cropper
              image={preview.url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="flex justify-between items-center mt-4">
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-1/3"
            />
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsCropping(false)}
                className="bg-gray-200 text-black px-4 py-2 rounded-full font-bold shadow-sm hover:bg-gray-300 transition-colors"
              >
                Skip
              </button>
              <button 
                onClick={handleFinishCrop}
                className="bg-black text-white px-4 py-2 rounded-full font-bold shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Etch your thought..."
              className="w-full h-40 bg-gray-50 border-2 border-black rounded-2xl p-4 text-sm focus:outline-none focus:ring-0 resize-none transition-all placeholder:text-gray-400"
            />
          </div>

          {preview && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-black bg-black">
              {preview.type === 'image' ? (
                <img src={preview.url} alt="Preview" className="w-full max-h-96 object-contain" />
              ) : (
                <video src={preview.url} className="w-full max-h-96 object-contain" controls muted />
              )}
              <button 
                type="button"
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 bg-black text-white w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-lg"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
          
          {(preview?.type === 'image' || preview?.type === 'video') && (
             <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Add Music</label>
                <div className="flex items-center space-x-2">
                  <select 
                    value={musicURL} 
                    onChange={(e) => setMusicURL(e.target.value)}
                    className="flex-1 border-2 border-black rounded-xl p-3 focus:outline-none bg-gray-50"
                  >
                    {PREDEFINED_MUSIC.map((music, idx) => (
                      <option key={idx} value={music.url}>{music.name}</option>
                    ))}
                    {musicURL && !PREDEFINED_MUSIC.find(m => m.url === musicURL) && (
                      <option value={musicURL}>Custom Upload</option>
                    )}
                  </select>
                  <label className="bg-black text-white p-3 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors shadow-md">
                    <i className="fas fa-upload"></i>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setMusicURL(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
             </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex space-x-3">
              <label className="w-12 h-12 flex items-center justify-center border-2 border-black rounded-full cursor-pointer hover:bg-black hover:text-white transition-all shadow-md active:scale-90">
                <i className="fas fa-camera"></i>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
              </label>
              <div className="flex flex-col justify-center">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Add Visual</p>
                <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Echo</p>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={!text.trim() && !preview}
              className="bg-black text-white px-10 py-3 rounded-full font-black uppercase tracking-widest hover:opacity-80 transition-opacity shadow-lg active:scale-95 disabled:opacity-20"
            >
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PostCreator;
