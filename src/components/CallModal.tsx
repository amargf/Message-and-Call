import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
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

  // استخدام خوادم STUN متعددة لضمان نجاح الاتصال بين الأجهزة المختلفة (هاتف وتلفاز)
  const servers = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
      { urls: ['stun:stun.services.mozilla.com'] },
    ],
  };

  useEffect(() => {
    initializeCall();
    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    if (!user) return;

    try {
      const { data: existingCalls } = await supabase
        .from('calls')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .eq('receiver_id', user.id)
        .limit(1);

      if (existingCalls && existingCalls.length > 0) {
        const call = existingCalls[0];
        callIdRef.current = call.id;
        setCallStatus('incoming');
      } else {
        await startCall();
      }

      const channel = supabase.channel(`call_room_${chatId}`);
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'calls', filter: `chat_id=eq.${chatId}` },
          async (payload) => {
            const data = payload.new as any;
            if (!data) return;

            if (data.status === 'ended') {
              onClose();
            } else if (data.status === 'accepted' && peerConnection.current && data.answer) {
              if (peerConnection.current.signalingState === 'have-local-offer') {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setCallStatus('connected');
              }
            }
          }
        )
        .subscribe();

    } catch (err) {
      console.error('Error initializing call:', err);
    }
  };

  const setupPeerConnection = (stream: MediaStream) => {
    const pc = new RTCPeerConnection(servers);
    peerConnection.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        // ضمان تشغيل الصوت تلقائياً وتجاوز القيود
        remoteVideoRef.current.play().catch((e) => console.log('Audio autoplay blocked:', e));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // يمكن إضافة معالجة مرشحي ICE إذا لزم الأمر، لكن الـ STUN الافتراضي يكفي للربط المباشر
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = setupPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { data, error } = await supabase.from('calls').insert({
        chat_id: chatId,
        caller_id: user?.id,
        receiver_id: recipientId,
        type: callType,
        status: 'pending',
        offer: { type: offer.type, sdp: offer.sdp },
      }).select().single();

      if (!error && data) {
        callIdRef.current = data.id;
      }
    } catch (err) {
      console.error('Error starting call:', err);
      onClose();
    }
  };

  const acceptCall = async () => {
    try {
      setCallStatus('connected');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = setupPeerConnection(stream);

      const { data: callData } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callIdRef.current)
        .single();

      if (callData && callData.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await supabase
          .from('calls')
          .update({
            status: 'accepted',
            answer: { type: answer.type, sdp: answer.sdp },
          })
          .eq('id', callIdRef.current);
      }
    } catch (err) {
      console.error('Error accepting call:', err);
      onClose();
    }
  };

  const cleanup = () => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    if (callIdRef.current) {
      supabase.from('calls').update({ status: 'ended' }).eq('id', callIdRef.current).then();
    }
  };

  const toggleMic = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream.current && callType === 'video') {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-between p-6">
      <div className="text-white text-center mt-6">
        <h2 className="text-2xl font-bold">
          {callStatus === 'calling' && 'جاري الاتصال...'}
          {callStatus === 'incoming' && 'اتصال وارد...'}
          {callStatus === 'connected' && 'مكالمة جارية'}
        </h2>
        <p className="text-gray-400 text-sm mt-1">{callType === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'}</p>
      </div>

      <div className="flex-1 w-full max-w-4xl flex items-center justify-center gap-4 relative overflow-hidden my-4">
        {/* عنصر الصوت المخفي أو مرئي للفيديو لضمان تشغيل تدفق الطرف الآخر */}
        <video ref={remoteVideoRef} autoPlay playsInline className={callType === 'video' ? "w-full h-full object-cover rounded-2xl bg-black" : "hidden"} />
        <video ref={localVideoRef} autoPlay playsInline muted className={`absolute bottom-4 right-4 rounded-xl object-cover bg-gray-800 ${callType === 'video' ? 'w-32 h-48 border-2 border-white' : 'hidden'}`} />
      </div>

      <div className="flex items-center gap-6 mb-6">
        {callStatus === 'incoming' ? (
          <>
            <button onClick={acceptCall} className="p-4 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center gap-2 px-6">
              <Phone size={24} /> قبول
            </button>
            <button onClick={onClose} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center gap-2 px-6">
              <PhoneOff size={24} /> رفض
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
