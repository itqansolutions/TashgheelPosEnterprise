// license-check.js
// DISABLED: User requested "No License Key" mode.
// The system now relies on Server-Side Subscription/Trial dates (SaaS Model).

function isLicenseValid() {
  return true; // Always valid, rely on subscription status from DB
}

function activateLicense(inputKey) {
  return true;
}

function generateLicenseKeyForCurrentPC() {
  return "LICENSE-NOT-REQUIRED-SAAS-MODE";
}

window.License = {
  isLicenseValid,
  activateLicense,
  generateLicenseKeyForCurrentPC,
  getMachineFingerprint: () => "BROWSER-FINGERPRINT"
};
