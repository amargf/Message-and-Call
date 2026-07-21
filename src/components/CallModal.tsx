import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface CallModalProps {
  chatId: string;
  recipientId: string;
  callType: 'audio' | 'video';
  onClose: () => void;
}

export default function CallModal({ chatId, recipientId, callType, onClose }: CallModalProps) {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<'calling' | 'incoming' | 'connected'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);

  const servers = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  };

  useEffect(() => {
    startCallSetup();
    return () => {
      cleanup();
    };
  }, []);

  const startCallSetup = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection(servers);

      stream.getTracks().forEach((track) => {
        peerConnection.current?.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // إعداد قناة الاستماع للإشارات عبر Supabase Realtime
      const channel = supabase.channel(`call_${chatId}`);

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `chat_id=eq.${chatId}` }, async (payload) => {
          const data = payload.new as any;
          if (!data || data.caller_id === user?.id) return;

          if (data.status === 'accepted' && peerConnection.current?.signalingState === 'have-local-offer') {
            if (data.answer) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              setCallStatus('connected');
            }
          } else if (data.status === 'ended') {
            onClose();
          }
        })
        .subscribe();

      // إنشاء دعوة اتصال جديدة (Offer)
      const pc = peerConnection.current;
      pc.onicecandidate = async (event) => {
        if (event.candidate && callIdRef.current) {
          // حفظ المرشحين
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { data: callData, error } = await supabase.from('calls').insert({
        chat_id: chatId,
        caller_id: user?.id,
        receiver_id: recipientId,
        type: callType,
        status: 'pending',
        offer: { type: offer.type, sdp: offer.sdp },
      }).select().single();

      if (!error && callData) {
        callIdRef.current = callData.id;
      }

    } catch (err) {
      console.error('Error starting call:', err);
      onClose();
    }
  };

  const cleanup = () => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    if (callIdRef.current) {
      supabase.from('calls').update({ status: 'ended' }).eq('id', callIdRef.current);
    }
  };

  const toggleMic = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current && callType === 'video') {
      localStream.current.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/90 flex flex-col items-center justify-between p-6">
      <div className="text-white text-center mt-6">
        <h2 className="text-xl font-bold">
          {callStatus === 'calling' ? 'جاري الاتصال...' : callStatus === 'connected' ? 'مكالمة جارية' : 'اتصال وارد'}
        </h2>
        <p className="text-gray-400 text-sm mt-1">{callType === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'}</p>
      </div>

      <div className="flex-1 w-full max-w-4xl flex items-center justify-center gap-4 relative overflow-hidden my-4">
        {callType === 'video' && (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-2xl bg-black" />
        )}
        <video ref={localVideoRef} autoPlay playsInline muted className={`absolute bottom-4 right-4 rounded-xl object-cover bg-gray-800 ${callType === 'video' ? 'w-32 h-48 border-2 border-white' : 'hidden'}`} />
      </div>

      <div className="flex items-center gap-6 mb-6">
        <button onClick={toggleMic} className={`p-4 rounded-full text-white ${isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {callType === 'video' && (
          <button onClick={toggleVideo} className={`p-4 rounded-full text-white ${isVideoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
        <button onClick={onClose} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg">
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
