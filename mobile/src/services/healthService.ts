import { Platform } from 'react-native';

export type HealthSummary = {
  steps: number;
  distanceKm: number;
  activeCalories: number;
  weightKg?: number;
  heightCm?: number;
  source: 'health_connect' | 'healthkit' | 'unavailable';
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

const androidPermissions = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Height' },
];

function getHealthConnect() {
  return require('react-native-health-connect');
}

function getAppleHealthKit() {
  const health = require('react-native-health');
  return health.default || health;
}

async function requestAndroidHealth() {
  const HealthConnect = getHealthConnect();

  await HealthConnect.initialize();

  const granted = await HealthConnect.requestPermission(androidPermissions);

  return Array.isArray(granted) && granted.length > 0;
}

async function readAndroidRecords(recordType: string) {
  const HealthConnect = getHealthConnect();
  const { startTime, endTime } = todayRange();

  const result = await HealthConnect.readRecords(recordType, {
    timeRangeFilter: {
      operator: 'between',
      startTime,
      endTime,
    },
  });

  return result?.records || [];
}

async function getAndroidSteps() {
  const records = await readAndroidRecords('Steps');

  return records.reduce((total: number, item: any) => {
    return total + Number(item.count || 0);
  }, 0);
}

async function getAndroidDistanceKm() {
  const records = await readAndroidRecords('Distance');

  const meters = records.reduce((total: number, item: any) => {
    const value =
      item.distance?.inMeters ||
      item.distance?.meters ||
      item.distance ||
      0;

    return total + Number(value);
  }, 0);

  return Number((meters / 1000).toFixed(2));
}

async function getAndroidActiveCalories() {
  const records = await readAndroidRecords('ActiveCaloriesBurned');

  return records.reduce((total: number, item: any) => {
    const value =
      item.energy?.inCalories ||
      item.energy?.calories ||
      item.energy ||
      0;

    return total + Number(value);
  }, 0);
}

async function getAndroidLatestWeight() {
  const HealthConnect = getHealthConnect();

  const result = await HealthConnect.readRecords('Weight', {
    timeRangeFilter: {
      operator: 'after',
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  const records = result?.records || [];
  const latest = records[records.length - 1];

  if (!latest) return undefined;

  return Number(
    latest.weight?.inKilograms ||
      latest.weight?.kilograms ||
      latest.weight ||
      undefined,
  );
}

async function getAndroidLatestHeight() {
  const HealthConnect = getHealthConnect();

  const result = await HealthConnect.readRecords('Height', {
    timeRangeFilter: {
      operator: 'after',
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  const records = result?.records || [];
  const latest = records[records.length - 1];

  if (!latest) return undefined;

  const meters =
    latest.height?.inMeters ||
    latest.height?.meters ||
    latest.height ||
    undefined;

  if (!meters) return undefined;

  return Number((Number(meters) * 100).toFixed(1));
}

function requestIosHealth(): Promise<boolean> {
  return new Promise(resolve => {
    const AppleHealthKit = getAppleHealthKit();

    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.Weight,
          AppleHealthKit.Constants.Permissions.Height,
        ],
        write: [],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      resolve(!error);
    });
  });
}

export async function requestHealthPermissions() {
  try {
    if (Platform.OS === 'android') {
      return await requestAndroidHealth();
    }

    if (Platform.OS === 'ios') {
      return await requestIosHealth();
    }

    return false;
  } catch {
    return false;
  }
}

export async function getTodayHealthSummary(): Promise<HealthSummary> {
  try {
    if (Platform.OS === 'android') {
      return {
        steps: await getAndroidSteps(),
        distanceKm: await getAndroidDistanceKm(),
        activeCalories: await getAndroidActiveCalories(),
        weightKg: await getAndroidLatestWeight(),
        heightCm: await getAndroidLatestHeight(),
        source: 'health_connect',
      };
    }

    if (Platform.OS === 'ios') {
      return {
        steps: 0,
        distanceKm: 0,
        activeCalories: 0,
        source: 'healthkit',
      };
    }

    return {
      steps: 0,
      distanceKm: 0,
      activeCalories: 0,
      source: 'unavailable',
    };
  } catch {
    return {
      steps: 0,
      distanceKm: 0,
      activeCalories: 0,
      source: 'unavailable',
    };
  }
}