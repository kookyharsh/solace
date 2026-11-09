import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, GradientBackground } from '../src/components/ui';
import { useTheme, useThemeMode } from '../src/theme';
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
      style={{ color: t.colors.ink, fontSize: t.typography.title, fontFamily: 'Nunito_700Bold' }}
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
        trackColor={{ false: t.colors.border, true: t.colors.primary }}
        thumbColor={value ? '#FFFFFF' : t.colors.surface}
        ios_backgroundColor={t.colors.border}
        style={{ transform: [{ scaleX: 1.08 }, { scaleY: 1.08 }] }}
      />
    </View>
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
      .then(setReminders)
      .catch(() => undefined);
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
    backgroundColor: t.colors.background,
    borderColor: t.colors.border,
    borderWidth: 1,
    borderRadius: t.radii.md,
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
      await updateProfile({
        companionName: name.trim() || null,
        nickname: nickname.trim() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      Alert.alert('Saved', 'Your profile is up to date.');
    } catch {
      Alert.alert('Could not save', 'Please try again when you are online.');
    } finally {
      setSaving(false);
    }
  };
  const setHabit = (key: string, enabled: boolean) => {
    const previous = habits;
    setHabits((current) => [...current.filter((item) => item.key !== key), { key, enabled }]);
    void updateHabitPreference(key, enabled).catch(() => {
      setHabits(previous);
      Alert.alert('Could not update', 'Please try again when you are online.');
    });
  };
  const setMemory = (value: boolean) => {
    const previous = memoryConsent;
    setMemoryConsent(value);
    if (!value) setMemories([]);
    void updateProfile({ memoryConsent: value }).catch(() => {
      setMemoryConsent(previous);
      Alert.alert('Could not update', 'Please try again when you are online.');
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

  return (
    <GradientBackground>
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
              padding: t.spacing.lg,
              gap: t.spacing.lg,
              paddingBottom: t.spacing.xxl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
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
                  backgroundColor: t.colors.surface,
                  borderWidth: 1,
                  borderColor: t.colors.border,
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

            <Card style={{ gap: t.spacing.md }}>
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

            <Card style={{ gap: t.spacing.sm }}>
              <SectionTitle>Check-in topics</SectionTitle>
              <Text style={{ color: t.colors.muted }}>
                Choose the gentle nudges your companion may suggest.
              </Text>
              <View style={{ marginTop: t.spacing.xs }}>
                {topics.map(([key, label], index) => (
                  <View
                    key={key}
                    style={{ borderTopWidth: index ? 1 : 0, borderColor: t.colors.border }}
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

            <Card style={{ gap: t.spacing.sm }}>
              <SectionTitle>Privacy and notifications</SectionTitle>
              <SettingSwitch
                label="Helpful memories"
                detail="Let your companion remember useful facts you share."
                value={memoryConsent}
                onValueChange={setMemory}
              />
              <View style={{ borderTopWidth: 1, borderColor: t.colors.border }}>
                <SettingSwitch
                  label="Gentle notifications"
                  detail="Allow check-ins and reminders from your companion."
                  value={notificationConsent}
                  onValueChange={setNotifications}
                />
              </View>
            </Card>

            <Card style={{ gap: t.spacing.md }}>
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
                        backgroundColor: selected ? t.colors.primary : t.colors.background,
                        borderWidth: selected ? 0 : 1,
                        borderColor: t.colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? t.colors.onPrimary : t.colors.ink,
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

            <Card style={{ gap: t.spacing.md }}>
              <SectionTitle>Reminders and check-ins</SectionTitle>
              <Button
                label="Schedule a gentle reminder"
                variant="secondary"
                onPress={() => void scheduleGentleReminder()}
              />
              <Button
                label="Enable morning + night check-ins"
                variant="outline"
                onPress={() => void scheduleDefaultDailyReminders(name.trim() || 'Your companion')}
              />
              <View style={{ height: 1, backgroundColor: t.colors.border }} />
              <TextInput
                accessibilityLabel="Reminder title"
                value={reminderTitle}
                onChangeText={setReminderTitle}
                placeholder="Reminder title"
                placeholderTextColor={t.colors.muted}
                style={inputStyle}
              />
              <TextInput
                accessibilityLabel="Reminder time"
                value={reminderTime}
                onChangeText={setReminderTime}
                placeholder="HH:MM"
                placeholderTextColor={t.colors.muted}
                keyboardType="numbers-and-punctuation"
                style={inputStyle}
              />
              <Button
                label="Add reminder"
                variant="outline"
                onPress={() =>
                  void createReminder({
                    type: 'custom',
                    title: reminderTitle.trim(),
                    time: reminderTime,
                    days: [0, 1, 2, 3, 4, 5, 6],
                  })
                    .then((reminder) => {
                      setReminders((current) => [
                        ...current,
                        reminder as (typeof reminders)[number],
                      ]);
                      return scheduleCustomReminder(
                        reminderTitle.trim(),
                        reminderTime,
                        [0, 1, 2, 3, 4, 5, 6],
                      );
                    })
                    .catch(() =>
                      Alert.alert(
                        'Reminder unavailable',
                        'Check the title and time, then try again.',
                      ),
                    )
                }
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
                  <Text style={{ color: t.colors.ink, flex: 1 }}>
                    {reminder.time} · {reminder.title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={'Delete ' + reminder.title}
                    onPress={() =>
                      void deleteReminder(reminder.id).then(() =>
                        setReminders((current) =>
                          current.filter((item) => item.id !== reminder.id),
                        ),
                      )
                    }
                  >
                    <Text style={{ color: '#B94B62', fontFamily: 'Nunito_700Bold' }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </Card>

            <Card style={{ gap: t.spacing.md }}>
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
                      <Text style={{ color: '#B94B62', fontFamily: 'Nunito_700Bold' }}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={{ color: t.colors.muted }}>No saved memories yet.</Text>
              )}
            </Card>

            <Card style={{ gap: t.spacing.md }}>
              <SectionTitle>Account and about</SectionTitle>
              <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
                Solace is a companion, not a replacement for professional care. If you may be in
                danger, contact local emergency services or a trusted person.
              </Text>
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
                onPress={() => void signOut().then(() => router.replace('/onboarding'))}
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
    </GradientBackground>
  );
}
