const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Custom Expo config plugin for B2B Communication app
 * Adds necessary Android permissions and configurations for P2P networking
 */
module.exports = function withCustomAndroidConfig(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Add uses-permission for networking
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.CHANGE_NETWORK_STATE',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.INTERNET',
      'android.permission.WRITE_SETTINGS',
      'android.permission.NEARBY_WIFI_DEVICES',
    ];

    permissions.forEach((permission) => {
      const exists = androidManifest['uses-permission'].find(
        (p) => p.$?.['android:name'] === permission
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // Add uses-feature for WiFi
    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const features = [
      { name: 'android.hardware.wifi', required: 'true' },
      { name: 'android.hardware.wifi.direct', required: 'false' },
    ];

    features.forEach((feature) => {
      const exists = androidManifest['uses-feature'].find(
        (f) => f.$?.['android:name'] === feature.name
      );
      if (!exists) {
        androidManifest['uses-feature'].push({
          $: {
            'android:name': feature.name,
            'android:required': feature.required,
          },
        });
      }
    });

    // Add application attributes for networking
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    const application = androidManifest.application[0];
    if (!application.$) {
      application.$ = {};
    }

    // Enable cleartext traffic for local networking
    application.$['android:usesCleartextTraffic'] = 'true';
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    return config;
  });
};
