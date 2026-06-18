import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const SE7ENFIT_URL = 'https://se7enfit-prime-coach.base44.app';

function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <WebView
        source={{ uri: SE7ENFIT_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures
        originWhitelist={['*']}
        renderLoading={() => (
          <View style={styles.loading}>
            <Text style={styles.logo}>SE7EN FIT</Text>
            <ActivityIndicator size="large" color="#D4FF00" />
            <Text style={styles.loadingText}>Loading your fitness app...</Text>
          </View>
        )}
        renderError={() => (
          <View style={styles.loading}>
            <Text style={styles.logo}>SE7EN FIT</Text>
            <Text style={styles.errorText}>
              Unable to load app. Check your internet connection and try again.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050505',
  },
  webview: {
    flex: 1,
    backgroundColor: '#050505',
  },
  loading: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    color: '#D4FF00',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 18,
    letterSpacing: 1,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 14,
    fontSize: 15,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;