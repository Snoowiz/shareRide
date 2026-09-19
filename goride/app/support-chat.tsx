import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Modal from 'react-native-modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';

export default function SupportChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useAppContext();
  const { authUser } = useAuth();
  const C = Colors[colorScheme];

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = useState<string | null>(null);
  const [ticketReferenceId, setTicketReferenceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Topic Modal State
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicType, setTopicType] = useState<'Rides' | 'Deliveries' | 'Transactions' | 'Other' | null>(null);
  const [topicItems, setTopicItems] = useState<any[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);

  useEffect(() => {
    if (authUser?.id) {
      fetchOrInitTicket();
    }
  }, [authUser]);

  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`support_chat_${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const fetchOrInitTicket = async () => {
    try {
      const { data: tickets, error: tErr } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', authUser!.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (tErr) throw tErr;

      if (tickets && tickets.length > 0) {
        const activeTicket = tickets[0];
        setTicketId(activeTicket.id);
        setTicketSubject(activeTicket.subject);

        const { data: msgs, error: mErr } = await supabase
          .from('support_messages')
          .select('*')
          .eq('ticket_id', activeTicket.id)
          .order('created_at', { ascending: true });

        if (mErr) throw mErr;
        if (msgs) setMessages(msgs);
      } else {
        setTicketId(null);
      }
    } catch (err) {
      console.log('Error fetching ticket/messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrCreateTicket = async () => {
    if (ticketId) return ticketId;
    const { data: newTicket, error: newTicketErr } = await supabase
      .from('support_tickets')
      .insert({ user_id: authUser?.id, status: 'open', subject: ticketSubject, reference_id: ticketReferenceId })
      .select()
      .single();

    if (newTicketErr) throw newTicketErr;
    setTicketId(newTicket.id);
    return newTicket.id;
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !authUser?.id) return;

    setIsSending(true);
    setInputText('');

    try {
      const activeTicketId = await getOrCreateTicket();

      const { data: insertedMsg, error: msgErr } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: activeTicketId,
          sender_id: authUser.id,
          message: text,
        })
        .select()
        .single();

      if (msgErr) throw msgErr;
      
      setMessages((prev) => {
        if (prev.find(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });
    } catch (err: any) {
      console.log('Error sending message:', err);
      Alert.alert('Delivery Failed', err?.message || 'Could not send message. Please check your connection.');
      setInputText(text);
    } finally {
      setIsSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadAttachment(result.assets[0].base64);
    }
  };

  const uploadAttachment = async (base64: string) => {
    setIsSending(true);
    try {
      const activeTicketId = await getOrCreateTicket();
      const ext = 'jpg';
      const filePath = `${authUser?.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('support_attachments')
        .upload(filePath, decode(base64), { contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('support_attachments')
        .getPublicUrl(filePath);

      const { data: insertedMsg, error: msgErr } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: activeTicketId,
          sender_id: authUser?.id,
          message: 'Shared an image',
          attachment_url: publicUrl,
        })
        .select()
        .single();

      if (msgErr) throw msgErr;

      setMessages((prev) => {
        if (prev.find(m => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });
    } catch (err: any) {
      console.log('Error uploading image', err);
      Alert.alert('Upload Failed', err?.message || 'Could not upload image.');
    } finally {
      setIsSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const loadTopicData = async (type: 'Rides' | 'Deliveries' | 'Transactions') => {
    setTopicType(type);
    setTopicLoading(true);
    try {
      if (type === 'Rides') {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .or(`rider_id.eq.${authUser?.id},driver_id.eq.${authUser?.id}`)
          .order('created_at', { ascending: false })
          .limit(10);
        setTopicItems(data || []);
      } else if (type === 'Deliveries') {
        const { data } = await supabase
          .from('deliveries')
          .select('*')
          .or(`rider_id.eq.${authUser?.id},driver_id.eq.${authUser?.id}`)
          .order('created_at', { ascending: false })
          .limit(10);
        setTopicItems(data || []);
      } else if (type === 'Transactions') {
        const { data } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', authUser?.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setTopicItems(data || []);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setTopicLoading(false);
    }
  };

  const selectTopic = async (subject: string, refId?: string) => {
    setTicketSubject(subject);
    setTicketReferenceId(refId || null);
    setShowTopicModal(false);
    
    // If ticket already exists, update its subject
    if (ticketId) {
      await supabase.from('support_tickets').update({ subject, reference_id: refId }).eq('id', ticketId);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === authUser?.id;
    return (
      <View style={[s.msgBubble, isMe ? [s.msgMe, { backgroundColor: Colors.brand.primary }] : [s.msgThem, { backgroundColor: C.surface }]]}>
        {item.attachment_url && (
          <Image source={{ uri: item.attachment_url }} style={s.attachmentImg} resizeMode="cover" />
        )}
        <Text style={[s.msgText, { color: isMe ? '#fff' : C.text }]}>{item.message}</Text>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: C.text }]}>Live Support</Text>
          <Text style={[s.headerSub, { color: C.textMuted }]}>
            {ticketId ? 'Agent connected' : 'We typically reply in minutes'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {ticketSubject && (
        <View style={[s.subjectBanner, { backgroundColor: C.surfaceAlt }]}>
          <Ionicons name="information-circle" size={16} color={C.text} />
          <Text style={[s.subjectText, { color: C.text }]} numberOfLines={1}>Topic: {ticketSubject}</Text>
          <TouchableOpacity onPress={() => setShowTopicModal(true)}>
            <Text style={{ color: Colors.brand.primary, fontSize: 13, fontWeight: '600' }}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {isLoading ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={s.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={() => (
              <View style={s.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={C.border} />
                <Text style={[s.emptyText, { color: C.textSecondary }]}>
                  Start a conversation with our support team. We're here to help!
                </Text>
                {!ticketSubject && (
                  <TouchableOpacity 
                    style={[s.topicBtn, { borderColor: Colors.brand.primary }]}
                    onPress={() => setShowTopicModal(true)}
                  >
                    <Ionicons name="list-outline" size={18} color={Colors.brand.primary} />
                    <Text style={[s.topicBtnTxt, { color: Colors.brand.primary }]}>Select Issue Topic (Optional)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}

        <View style={[s.inputWrap, { backgroundColor: C.surface, paddingBottom: insets.bottom || 16, borderColor: C.border }]}>
          <TouchableOpacity style={s.attachBtn} onPress={pickImage} disabled={isSending}>
            <Ionicons name="image-outline" size={24} color={C.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[s.input, { color: C.text, backgroundColor: C.background }]}
            placeholder="Type your message..."
            placeholderTextColor={C.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[s.sendBtn, { backgroundColor: inputText.trim() ? Colors.brand.primary : C.border }]} 
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Topic Selection Modal */}
      <Modal 
        isVisible={showTopicModal} 
        onBackdropPress={() => { setShowTopicModal(false); setTopicType(null); }}
        useNativeDriver
        style={s.bottomModal}
      >
        <View style={[s.modalSheet, { backgroundColor: C.surface, paddingBottom: insets.bottom + 20 }]}>
          <View style={[s.modalNotch, { backgroundColor: C.border }]} />
          <Text style={[s.modalTitle, { color: C.text }]}>What do you need help with?</Text>
          
          {!topicType ? (
            <View style={s.topicGrid}>
              <TouchableOpacity style={[s.topicCard, { backgroundColor: C.background }]} onPress={() => loadTopicData('Rides')}>
                <Ionicons name="car-outline" size={24} color={Colors.brand.primary} />
                <Text style={[s.topicCardTxt, { color: C.text }]}>Recent Rides</Text>
              </TouchableOpacity>
              
              {authUser?.role === 'user' && (
                <TouchableOpacity style={[s.topicCard, { backgroundColor: C.background }]} onPress={() => loadTopicData('Deliveries')}>
                  <Ionicons name="cube-outline" size={24} color={Colors.brand.primary} />
                  <Text style={[s.topicCardTxt, { color: C.text }]}>Recent Deliveries</Text>
                </TouchableOpacity>
              )}

              {authUser?.role === 'driver' && (
                <TouchableOpacity style={[s.topicCard, { backgroundColor: C.background }]} onPress={() => loadTopicData('Transactions')}>
                  <Ionicons name="wallet-outline" size={24} color={Colors.brand.primary} />
                  <Text style={[s.topicCardTxt, { color: C.text }]}>Withdrawals / Top-up</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.topicCard, { backgroundColor: C.background }]} onPress={() => selectTopic('General Inquiry')}>
                <Ionicons name="help-circle-outline" size={24} color={Colors.brand.primary} />
                <Text style={[s.topicCardTxt, { color: C.text }]}>Other Issues</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={s.backToTopics} onPress={() => setTopicType(null)}>
                <Ionicons name="arrow-back" size={20} color={C.text} />
                <Text style={{ color: C.text, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
              
              {topicLoading ? (
                <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={topicItems}
                  keyExtractor={(item, index) => item.id || index.toString()}
                  style={{ maxHeight: 300, marginTop: 10 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    let title = '';
                    let iconName = 'help-outline';
                    let topicCode = '';
                    
                    if (topicType === 'Rides') {
                      title = `Ride to ${item.destination_address || 'Destination'}`;
                      iconName = 'location-outline';
                      topicCode = 'Ride';
                    } else if (topicType === 'Deliveries') {
                      title = `Delivery to ${item.receiver_address || 'Destination'}`;
                      iconName = 'cube-outline';
                      topicCode = 'Delivery';
                    } else if (topicType === 'Transactions') {
                      title = `Amount: ₦${item.amount}`;
                      iconName = 'cash-outline';
                      topicCode = 'Transaction';
                    }

                    const timeString = new Date(item.created_at).toLocaleString('en-US', { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    });

                    return (
                      <TouchableOpacity 
                        style={[s.itemRow, { borderColor: C.border }]}
                        onPress={() => selectTopic(`${topicCode} #${item.id?.substring(0, 8)}`, item.id)}
                      >
                        <Ionicons name={iconName as any} size={20} color={C.textMuted} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={[s.itemTitle, { color: C.text }]} numberOfLines={1}>
                            {title}
                          </Text>
                          <Text style={{ color: C.textMuted, fontSize: 12 }}>
                            {timeString} • {item.status}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={C.border} />
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={() => (
                    <Text style={{ color: C.textMuted, textAlign: 'center', marginTop: 20 }}>No recent records found.</Text>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  subjectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  subjectText: { flex: 1, fontSize: 13, fontWeight: '500' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  msgBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  msgMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  msgText: { fontSize: 15, lineHeight: 22 },
  attachmentImg: { width: 220, height: 220, borderRadius: 12, marginBottom: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 100 },
  emptyText: { textAlign: 'center', marginTop: 16, fontSize: 15, lineHeight: 22 },
  topicBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginTop: 24 },
  topicBtnTxt: { fontSize: 14, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bottomModal: { justifyContent: 'flex-end', margin: 0 },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, maxHeight: '80%' },
  modalNotch: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  topicGrid: { gap: 12 },
  topicCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 16 },
  topicCardTxt: { fontSize: 16, fontWeight: '600' },
  backToTopics: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
});
