import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator,
  Image, Linking, Modal, ScrollView, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

// ── Emoji Categories ──
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    icon: 'happy-outline',
    emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🥳','🥺','😢','😭','😤','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓']
  },
  {
    label: 'Gestures',
    icon: 'hand-left-outline',
    emojis: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','✍️','💪','🦾','🙌','👏','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','💥','💫','⭐','🌟','✨','💢','💤']
  },
  {
    label: 'Transport',
    icon: 'car-outline',
    emojis: ['🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🚏','🛣️','🗺️','🧭','⛽','🚦','🚥','📍','📌','🏠','🏢','🏪','🏥','🏫','🏭','🌍','🌎','🌏']
  },
  {
    label: 'Objects',
    icon: 'cube-outline',
    emojis: ['📦','📫','📬','📭','📮','📝','📄','📃','💰','💵','💴','💶','💷','💸','💳','🧾','💹','📱','📞','☎️','📟','⏰','🔔','🔕','🔑','🗝️','🔒','🔓','🛒','🎁','🎉','🎊','🎈','🎀','🏆','🥇','🥈','🥉']
  }
];

export default function ChatScreen() {
  const { rideId, otherUserId, type } = useLocalSearchParams<{ rideId: string, otherUserId: string, type: 'ride' | 'delivery' }>();
  const chatType = type || 'ride';
  const { authUser, selectedRole } = useAuth();
  const { colorScheme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme];
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiCat, setActiveEmojiCat] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const columnField = chatType === 'delivery' ? 'delivery_id' : 'ride_id';

  // Fetch other user profile and initial messages
  useEffect(() => {
    if (!rideId || !otherUserId || !authUser) return;

    const loadData = async () => {
      try {
        // Get other user's info with fallback for driver photo
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, phone, role, driver_profiles(profile_photo_url)')
          .eq('id', otherUserId)
          .single();
        
        if (profileErr) {
          console.error('Error fetching profile:', profileErr);
        }

        if (profile) {
          const mappedProfile = {
            ...profile,
            avatar_url: profile.avatar_url || (profile as any).driver_profiles?.profile_photo_url || null
          };
          setOtherUser(mappedProfile);
        }

        // Get ride/delivery details
        const { data: bookingData } = await supabase
          .from(chatType === 'delivery' ? 'deliveries' : 'rides')
          .select('*')
          .eq('id', rideId)
          .single();
        
        if (bookingData) setBooking(bookingData);

        // Get messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq(columnField, rideId)
          .order('created_at', { ascending: true });
        
        if (msgs) setMessages(msgs);
        
        // Mark unread messages as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq(columnField, rideId)
          .eq('receiver_id', authUser.id)
          .eq('is_read', false);

      } catch (err) {
        console.error('Error loading chat:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to new messages AND read receipt updates
    const channel = supabase
      .channel(`chat_${chatType}_${rideId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `${columnField}=eq.${rideId}`
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Auto-mark as read if we're the receiver
        if (newMsg.receiver_id === authUser?.id) {
          supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', newMsg.id)
            .then();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `${columnField}=eq.${rideId}`
      }, (payload) => {
        // Update read receipts in real-time (blue checkmarks)
        const updated = payload.new as any;
        setMessages(prev =>
          prev.map(m => m.id === updated.id ? { ...m, is_read: updated.is_read } : m)
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, otherUserId, authUser]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !authUser || !otherUserId || !rideId) return;

    setInputText('');
    setShowEmoji(false);
    
    try {
      const { data, error } = await supabase.from('messages').insert({
        [columnField]: rideId,
        sender_id: authUser.id,
        receiver_id: otherUserId,
        content: text
      }).select().single();

      if (error) throw error;
      
      if (data) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const insertEmoji = useCallback((emoji: string) => {
    setInputText(prev => prev + emoji);
  }, []);

  const handleCall = () => {
    if (otherUser?.phone) {
      Linking.openURL(`tel:${otherUser.phone}`);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === authUser?.id;
    return (
      <View style={[s.msgWrapper, isMe ? s.msgRight : s.msgLeft]}>
        <View style={[s.msgBubble, { 
          backgroundColor: isMe ? Colors.brand.primary : C.surfaceAlt,
          borderBottomRightRadius: isMe ? 4 : 16,
          borderBottomLeftRadius: isMe ? 16 : 4,
        }]}>
          <Text style={[s.msgText, { color: isMe ? '#fff' : C.text }]}>{item.content}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 4 }}>
          <Text style={[s.msgTime, { color: C.textMuted }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Ionicons 
              name={item.is_read ? "checkmark-done" : "checkmark"} 
              size={14} 
              color={item.is_read ? "#3B82F6" : C.textMuted} 
            />
          )}
        </View>
      </View>
    );
  };

  const otherName = otherUser ? `${otherUser.first_name} ${otherUser.last_name || ''}`.trim() : 'Chat';
  const isDriver = selectedRole === 'driver';
  const rolePrimary = isDriver ? Colors.driver.primary : Colors.rider.primary;

  return (
    <KeyboardAvoidingView 
      style={[s.root, { backgroundColor: C.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatarPlaceholder, { backgroundColor: C.surfaceAlt }]}>
              <Ionicons name="person" size={18} color={C.textMuted} />
            </View>
          )}
          <View>
            <Text style={[s.headerName, { color: C.text }]}>{otherName}</Text>
            <Text style={[s.roleBadge, { color: C.textMuted }]}>
              {chatType === 'delivery' ? '📦 Delivery' : '🚗 Ride'} Chat
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[s.callBtn, { backgroundColor: rolePrimary + '15' }]} 
          onPress={handleCall}
        >
          <Ionicons name="call" size={20} color={rolePrimary} />
        </TouchableOpacity>
      </View>

      {/* Booking Info Bar */}
      {booking && (
        <View style={[s.bookingInfo, { backgroundColor: C.surfaceAlt, borderBottomColor: C.border }]}>
          <View style={s.bookingRow}>
            <View style={s.bookingAddresses}>
              <View style={s.addrLine}>
                <View style={[s.addrDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[s.addrText, { color: C.textSecondary }]} numberOfLines={1}>
                  {chatType === 'delivery' ? booking.sender_address : booking.pickup_address}
                </Text>
              </View>
              <View style={s.addrLine}>
                <View style={[s.addrDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[s.addrText, { color: C.textSecondary }]} numberOfLines={1}>
                  {chatType === 'delivery' ? booking.receiver_address : booking.destination_address}
                </Text>
              </View>
            </View>
            <View style={[s.fareBadge, { backgroundColor: rolePrimary + '20' }]}>
              <Text style={[s.fareText, { color: rolePrimary }]}>
                ₦{(booking.fare || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: C.textMuted, fontSize: 15 }}>No messages yet. Say hello! 👋</Text>
            </View>
          }
        />
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <View style={[s.emojiContainer, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          {/* Category Tabs */}
          <View style={[s.emojiCatBar, { borderBottomColor: C.border }]}>
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat.label}
                style={[s.emojiCatTab, activeEmojiCat === idx && { borderBottomColor: rolePrimary, borderBottomWidth: 2 }]}
                onPress={() => setActiveEmojiCat(idx)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={20}
                  color={activeEmojiCat === idx ? rolePrimary : C.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
          {/* Emoji Grid */}
          <ScrollView style={s.emojiScroll} showsVerticalScrollIndicator={false}>
            <View style={s.emojiGrid}>
              {EMOJI_CATEGORIES[activeEmojiCat].emojis.map((emoji, idx) => (
                <Pressable
                  key={`${emoji}-${idx}`}
                  style={({ pressed }) => [s.emojiItem, pressed && { backgroundColor: C.surfaceAlt, transform: [{ scale: 1.3 }] }]}
                  onPress={() => insertEmoji(emoji)}
                >
                  <Text style={s.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Input */}
      <View style={[s.inputWrap, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.surface, borderTopColor: C.border }]}>
        <View style={[s.inputContainer, { backgroundColor: C.background }]}>
          <TouchableOpacity
            style={s.emojiBtn}
            onPress={() => setShowEmoji(!showEmoji)}
          >
            <Ionicons
              name={showEmoji ? 'keypad-outline' : 'happy-outline'}
              size={24}
              color={showEmoji ? rolePrimary : C.textMuted}
            />
          </TouchableOpacity>
          <TextInput
            style={[s.input, { color: C.text }]}
            placeholder="Type a message..."
            placeholderTextColor={C.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => setShowEmoji(false)}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[s.sendBtn, { backgroundColor: inputText.trim() ? rolePrimary : C.surfaceAlt }]} 
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={16} color={inputText.trim() ? '#fff' : C.textMuted} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '700' },
  roleBadge: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15, 52, 110, 0.1)', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  msgWrapper: { maxWidth: '80%', marginBottom: 4 },
  msgLeft: { alignSelf: 'flex-start' },
  msgRight: { alignSelf: 'flex-end' },
  msgBubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, marginHorizontal: 4 },
  inputWrap: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingRight: 6, paddingVertical: 6 },
  emojiBtn: { padding: 8, marginLeft: 4, marginBottom: 1 },
  input: { flex: 1, minHeight: 36, maxHeight: 100, fontSize: 15, paddingTop: 8, paddingBottom: 8, marginLeft: 4 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginBottom: 2 },
  
  // Booking info bar
  bookingInfo: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bookingAddresses: { flex: 1, gap: 4 },
  addrLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrDot: { width: 6, height: 6, borderRadius: 3 },
  addrText: { fontSize: 12, fontWeight: '500' },
  fareBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  fareText: { fontSize: 14, fontWeight: '800' },

  // Emoji picker
  emojiContainer: { height: 260, borderTopWidth: 1 },
  emojiCatBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8 },
  emojiCatTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  emojiScroll: { flex: 1, paddingHorizontal: 8, paddingTop: 8 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emojiItem: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  emojiText: { fontSize: 26 },
});
