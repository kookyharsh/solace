import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ScreenBackground } from '../src/components/ui';
import { useTheme, useThemeMode } from '../src/theme';
import { googleSignInConfigured, useGoogleSignIn } from '../src/googleAuth';
import {
  ClockTimePickerModal,
  TimePickerButton,
  format12Hour,
} from '../src/components/ClockTimePicker';
import {
  requestNotifications,
  scheduleCustomReminder,
  scheduleDefaultDailyReminders,
  scheduleGentleReminder,
} from '../src/notifications';
import {
  createReminder,
  deleteAccount,
  deleteMemory,
  deleteReminder,
  exportAccount,
  getHabitPreferences,
  getMemories,
  getProfile,
  getReminders,
  signOut,
  updateHabitPreference,
  updateProfile,
} from '../src/api';

const topics = [
  ['water', 'Drink water'],
  ['stretch', 'Stretch'],
  ['walk', 'Short walk'],
  ['screen_break', 'Screen break'],
  ['wind_down', 'Wind down'],
  ['gratitude', 'Gratitude'],
] as const;

function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text
      style={{ color: t.colors.ink, fontSize: 18, fontFamily: 'Nunito_700Bold' }}
    >
      {children}
    </Text>
  );
}

function SettingSwitch({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: t.spacing.md,
        paddingVertical: t.spacing.xs,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 16 }}>
          {label}
        </Text>
        {!!detail && <Text style={{ color: t.colors.muted, lineHeight: 20 }}>{detail}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={detail}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: t.colors.divider, true: t.colors.accent }}
        thumbColor={value ? t.colors.onAccent : t.colors.muted}
        ios_backgroundColor={t.colors.border}
        style={{ transform: [{ scaleX: 1.08 }, { scaleY: 1.08 }] }}
      />
    </View>
  );
}

function GoogleAccountSection() {
  const [googleBusy, setGoogleBusy] = useState(false);

  const beginGoogleLink = useCallback(() => {
    if (googleBusy) return false;
    setGoogleBusy(true);
    return true;
  }, [googleBusy]);

  const completeGoogleLink = useCallback(() => {
    setGoogleBusy(false);
    Alert.alert('Google connected', 'Your guest account is now connected to Google.');
  }, []);

  const failGoogleLink = useCallback((errorMessage?: string) => {
    setGoogleBusy(false);
    if (errorMessage) {
      Alert.alert('Google connection', errorMessage);
    }
  }, []);

  const google = useGoogleSignIn(beginGoogleLink, completeGoogleLink, failGoogleLink);

  return (
    <Button
      label={googleBusy ? 'Connecting Google…' : 'Connect Google account'}
      variant="outline"
      disabled={googleBusy || !google.ready}
      onPress={() => void google.signIn().catch(failGoogleLink)}
    />
  );
}

export default function Settings() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; text: string; category: string }>>(
    [],
  );
  const [reminders, setReminders] = useState<
    Array<{ id: string; title: string; time: string; enabled: boolean }>
  >([]);
  const [habits, setHabits] = useState<Array<{ key: string; enabled: boolean }>>([]);
  const [reminderTitle, setReminderTitle] = useState('A gentle moment');
  const [reminderTime, setReminderTime] = useState('20:00');
  const [clockModalVisible, setClockModalVisible] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [memoryConsent, setMemoryConsent] = useState(false);
  const [notificationConsent, setNotificationConsent] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (!raw) return;
      const value = JSON.parse(raw);
      setName(value.companionName ?? '');
      setNickname(value.nickname ?? '');
    });
    getMemories()
      .then(setMemories)
      .catch(() => undefined);
    getReminders()
      .then((items) => {
        setReminders(items);
        void AsyncStorage.setItem('solace.local_reminders', JSON.stringify(items));
      })
      .catch(() => {
        AsyncStorage.getItem('solace.local_reminders').then((raw) => {
          if (raw) setReminders(JSON.parse(raw));
        }).catch(() => undefined);
      });
    getHabitPreferences()
      .then(setHabits)
      .catch(() => undefined);
    getProfile()
      .then((profile) => {
        setMemoryConsent(profile.memoryConsent);
        setNotificationConsent(profile.notificationConsent);
      })
      .catch(() => undefined);
  }, []);

  const inputStyle = {
    color: t.colors.ink,
    backgroundColor: t.colors.input,
    borderRadius: 12,
    padding: t.spacing.md,
  } as const;

  const save = async () => {
    setSaving(true);
    try {
      const existing = await AsyncStorage.getItem('solace.profile');
      const value = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(
        'solace.profile',
        JSON.stringify({ ...value, companionName: name.trim() || null, nickname: nickname.trim() }),
      );
      try {
        await updateProfile({
          companionName: name.trim() || null,
          nickname: nickname.trim() || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        Alert.alert('Saved', 'Your profile is up to date.');
      } catch {
        Alert.alert('Saved locally', 'Your profile was updated on this device.');
      }
    } catch {
      Alert.alert('Could not save', 'An error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };
  const setHabit = (key: string, enabled: boolean) => {
    const previous = habits;
    const updated = [...previous.filter((item) => item.key !== key), { key, enabled }];
    setHabits(updated);
    void updateHabitPreference(key, enabled).catch(() => {
      // Retained in optimistic local state
    });
  };
  const setMemory = (value: boolean) => {
    setMemoryConsent(value);
    if (!value) setMemories([]);
    void updateProfile({ memoryConsent: value }).catch(() => {
      // Retained in optimistic local state
    });
  };
  const setNotifications = (value: boolean) => {
    if (!value) {
      setNotificationConsent(false);
      void updateProfile({ notificationConsent: false });
      return;
    }
    void requestNotifications()
      .then((granted) => {
        setNotificationConsent(granted);
        return updateProfile({ notificationConsent: granted });
      })
      .catch(() =>
        Alert.alert(
          'Notifications unavailable',
          'You can enable permission in your device settings.',
        ),
      );
  };

  const handleAddReminder = async () => {
    const title = reminderTitle.trim();
    if (!title) {
      Alert.alert('Missing title', 'Please enter a title for your reminder.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      Alert.alert('Invalid time', 'Please choose a valid time using the clock.');
      return;
    }

    setAddingReminder(true);
    const localId = `local-${Date.now()}`;
    const newReminder = {
      id: localId,
      title,
      time: reminderTime,
      enabled: true,
    };

    // 1. Schedule local notification on device first
    try {
      await scheduleCustomReminder(title, reminderTime, [0, 1, 2, 3, 4, 5, 6]);
    } catch {
      // Non-fatal if permission wasn't granted yet
    }

    // 2. Persist to server / local storage
    try {
      const serverReminder = await createReminder({
        type: 'custom',
        title,
        time: reminderTime,
        days: [0, 1, 2, 3, 4, 5, 6],
      });
      const updated = [...reminders, (serverReminder as typeof newReminder) || newReminder];
      setReminders(updated);
      await AsyncStorage.setItem('solace.local_reminders', JSON.stringify(updated));
      Alert.alert('Reminder saved', `Solace will remind you at ${format12Hour(reminderTime)}.`);
    } catch {
      // Server unreachable: fallback to local reminder
      const updated = [...reminders, newReminder];
      setReminders(updated);
      await AsyncStorage.setItem('solace.local_reminders', JSON.stringify(updated));
      Alert.alert(
        'Reminder scheduled',
        `Scheduled on this device for ${format12Hour(reminderTime)}.`,
      );
    } finally {
      setAddingReminder(false);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const updated = reminders.filter((item) => item.id !== id);
    setReminders(updated);
    await AsyncStorage.setItem('solace.local_reminders', JSON.stringify(updated));
    if (!id.startsWith('local-')) {
      void deleteReminder(id).catch(() => undefined);
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              width: '100%',
              maxWidth: 720,
              alignSelf: 'center',
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: t.spacing.xxl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.divider }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(tabs)/wellness')
                }
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: t.radii.pill,
                  backgroundColor: t.colors.bg,
                }}
              >
                <Text style={{ color: t.colors.ink, fontSize: 24 }}>‹</Text>
              </Pressable>
              <View>
                <Text style={{ color: t.colors.muted, fontSize: t.typography.caption }}>
                  A little space for you
                </Text>
                <Text
                  style={{
                    color: t.colors.ink,
                    fontSize: t.typography.display,
                    fontFamily: 'Nunito_700Bold',
                  }}
                >
                  Settings
                </Text>
              </View>
            </View>

            <Card style={{ gap: 12 }}>
              <SectionTitle>Your profile</SectionTitle>
              <Text style={{ color: t.colors.muted }}>
                Name the people in this little corner of the world.
              </Text>
              <View style={{ gap: t.spacing.xs }}>
                <Text style={{ color: t.colors.muted }}>Companion name</Text>
                <TextInput
                  accessibilityLabel="Companion name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Solace"
                  placeholderTextColor={t.colors.muted}
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: t.spacing.xs }}>
                <Text style={{ color: t.colors.muted }}>Your name</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="Your name"
                  placeholderTextColor={t.colors.muted}
                  style={inputStyle}
                />
              </View>
              <Button
                label={saving ? 'Saving…' : 'Save changes'}
                disabled={saving}
                onPress={() => void save()}
              />
            </Card>

            <Card style={{ gap: 8 }}>
              <SectionTitle>Check-in topics</SectionTitle>
              <Text style={{ color: t.colors.muted }}>
                Choose the gentle nudges your companion may suggest.
              </Text>
              <View style={{ marginTop: t.spacing.xs }}>
                {topics.map(([key, label], index) => (
                  <View
                    key={key}
                    style={{ borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderColor: t.colors.divider }}
                  >
                    <SettingSwitch
                      label={label}
                      value={habits.find((item) => item.key === key)?.enabled ?? false}
                      onValueChange={(value) => setHabit(key, value)}
                    />
                  </View>
                ))}
              </View>
            </Card>

            <Card style={{ gap: 8 }}>
              <SectionTitle>Privacy and notifications</SectionTitle>
              <SettingSwitch
                label="Helpful memories"
                detail="Let your companion remember useful facts you share."
                value={memoryConsent}
                onValueChange={setMemory}
              />
              <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.divider }}>
                <SettingSwitch
                  label="Gentle notifications"
                  detail="Allow check-ins and reminders from your companion."
                  value={notificationConsent}
                  onValueChange={setNotifications}
                />
              </View>
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionTitle>Appearance</SectionTitle>
              <Text style={{ color: t.colors.muted }}>Choose what feels easiest on your eyes.</Text>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                {(['system', 'light', 'dark'] as const).map((option) => {
                  const selected = mode === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setMode(option)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        borderRadius: t.radii.pill,
                        paddingVertical: t.spacing.sm,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: selected ? t.colors.accent : t.colors.divider,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? t.colors.accent : t.colors.ink,
                          fontFamily: 'Nunito_700Bold',
                        }}
                      >
                        {option[0].toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionTitle>Reminders and check-ins</SectionTitle>
              <Button
                label="Schedule a gentle reminder"
                variant="secondary"
                onPress={() =>
                  void scheduleGentleReminder().then((res) => {
                    if (res) Alert.alert('Gentle reminder scheduled', 'Solace will check in with you every 4 hours.');
                    else Alert.alert('Notifications disabled', 'Please enable notifications in your device settings.');
                  })
                }
              />
              <Button
                label="Enable morning + night check-ins"
                variant="outline"
                onPress={() =>
                  void scheduleDefaultDailyReminders(name.trim() || 'Your companion').then((res) => {
                    if (res && res.length)
                      Alert.alert('Check-ins enabled', 'Morning check-in at 9:00 AM and night reflection at 8:00 PM.');
                    else Alert.alert('Notifications disabled', 'Please enable notifications in your device settings.');
                  })
                }
              />
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.divider }} />
              <TextInput
                accessibilityLabel="Reminder title"
                value={reminderTitle}
                onChangeText={setReminderTitle}
                placeholder="Reminder title"
                placeholderTextColor={t.colors.muted}
                style={inputStyle}
              />
              <View style={{ gap: t.spacing.xs }}>
                <Text style={{ color: t.colors.muted, fontSize: 13, fontFamily: 'Nunito_700Bold' }}>
                  Reminder time (12-hour AM/PM)
                </Text>
                <TimePickerButton
                  value={reminderTime}
                  label="Reminder time"
                  onPress={() => setClockModalVisible(true)}
                />
              </View>
              <ClockTimePickerModal
                visible={clockModalVisible}
                value={reminderTime}
                title="Select reminder time"
                onClose={() => setClockModalVisible(false)}
                onSave={setReminderTime}
              />
              <Button
                label={addingReminder ? 'Scheduling…' : 'Add reminder'}
                variant="outline"
                disabled={addingReminder}
                onPress={() => void handleAddReminder()}
              />
              {reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: t.spacing.sm,
                  }}
                >
                  <Text style={{ color: t.colors.ink, flex: 1, fontFamily: 'Nunito_700Bold' }}>
                    {format12Hour(reminder.time || '08:00')} · {reminder.title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={'Delete ' + reminder.title}
                    onPress={() => void handleDeleteReminder(reminder.id)}
                  >
                    <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionTitle>What your companion remembers</SectionTitle>
              {memories.length ? (
                memories.map((memory) => (
                  <View
                    key={memory.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: t.spacing.sm,
                    }}
                  >
                    <Text style={{ color: t.colors.muted, flex: 1 }}>{memory.text}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={'Delete memory: ' + memory.text}
                      onPress={() =>
                        void deleteMemory(memory.id).then(() =>
                          setMemories((current) => current.filter((item) => item.id !== memory.id)),
                        )
                      }
                    >
                      <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={{ color: t.colors.muted }}>No saved memories yet.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionTitle>Account and about</SectionTitle>
              <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
                Solace is a companion, not a replacement for professional care. If you may be in
                danger, contact local emergency services or a trusted person.
              </Text>
              {googleSignInConfigured ? (
                <GoogleAccountSection />
              ) : (
                <Text style={{ color: t.colors.muted }}>
                  Google connection is unavailable in this build.
                </Text>
              )}
              <Button
                label="Export my data"
                variant="outline"
                onPress={() =>
                  void exportAccount()
                    .then(() =>
                      Alert.alert('Export ready', 'Your Solace data was prepared successfully.'),
                    )
                    .catch(() =>
                      Alert.alert('Export unavailable', 'Please try again when you are online.'),
                    )
                }
              />
              <Button
                label="Sign out"
                variant="outline"
                onPress={() => {
                  Alert.alert('Sign out', 'Are you sure you want to sign out of Solace?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      onPress: () => void signOut().then(() => router.replace('/onboarding')),
                    },
                  ]);
                }}
              />
              <Button
                label="Delete account and all data"
                variant="destructive"
                onPress={() =>
                  Alert.alert(
                    'Delete everything?',
                    'This permanently removes your conversations, moods, memories, and account.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          void deleteAccount()
                            .then(() => router.replace('/onboarding'))
                            .catch(() =>
                              Alert.alert(
                                'Could not delete',
                                'Please try again when you are online.',
                              ),
                            ),
                      },
                    ],
                  )
                }
              />
              <Text
                style={{ color: t.colors.muted, lineHeight: 20, fontSize: t.typography.caption }}
              >
                Companion animation engine adapted from Bloub, under the MIT License.
              </Text>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
