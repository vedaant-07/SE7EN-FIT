import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getTodayHealthSummary,
  requestHealthPermissions,
  type HealthSummary,
} from './src/services/healthService';

function App() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [message, setMessage] = useState('Connect Health to start sync.');

  async function connectHealth() {
    setLoading(true);
    setMessage('Requesting Health permission...');

    const granted = await requestHealthPermissions();

    if (!granted) {
      setMessage('Health permission denied or Health Connect unavailable.');
      setLoading(false);
      return;
    }

    const data = await getTodayHealthSummary();
    setSummary(data);
    setMessage('Health data loaded.');
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>SE7EN FIT</Text>
        <Text style={styles.title}>Health Sync</Text>

        <Text style={styles.info}>
          Your health data is read only after your permission. You can revoke
          access anytime from your device health settings.
        </Text>

        <TouchableOpacity style={styles.button} onPress={connectHealth}>
          <Text style={styles.buttonText}>Connect Health</Text>
        </TouchableOpacity>

        <Text style={styles.message}>{message}</Text>

        {loading && <ActivityIndicator size="large" color="#D4FF00" />}

        {summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.row}>Source: {summary.source}</Text>
            <Text style={styles.row}>Steps: {summary.steps}</Text>
            <Text style={styles.row}>Distance: {summary.distanceKm} km</Text>
            <Text style={styles.row}>
              Active Calories: {Math.round(summary.activeCalories)}
            </Text>
            <Text style={styles.row}>
              Weight: {summary.weightKg ? `${summary.weightKg} kg` : 'Not found'}
            </Text>
            <Text style={styles.row}>
              Height: {summary.heightCm ? `${summary.heightCm} cm` : 'Not found'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050505' },
  container: { padding: 22, paddingTop: 52 },
  logo: {
    color: '#D4FF00',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 18,
  },
  info: {
    color: '#A3A3A3',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
  },
  button: {
    backgroundColor: '#D4FF00',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonText: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '900',
  },
  message: {
    color: '#FFFFFF',
    marginVertical: 18,
    fontSize: 15,
  },
  card: {
    backgroundColor: '#111111',
    borderColor: '#242424',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginTop: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 12,
  },
  row: {
    color: '#A3A3A3',
    fontSize: 16,
    marginTop: 8,
  },
});

export default App;
