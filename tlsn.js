import axios from 'axios';
import https from 'https';
import tls from 'tls';
import dotenv from 'dotenv';
dotenv.config();

// Create a custom HTTPS Agent with a checkServerIdentity callback.
const httpsAgent = new https.Agent({
  rejectUnauthorized: true, // This ensures that unauthorized certificates are rejected.
  checkServerIdentity: (host, cert) => {
    console.log('checkServerIdentity callback invoked for host:', host);
    
    // Perform the default hostname verification.
    const err = tls.checkServerIdentity(host, cert);
    if (err) {
      console.error('Default validation error:', err);
      throw err;
    }
    
    // Log certificate details.
    console.log('Certificate Subject:', cert.subject);
    console.log('Certificate Fingerprint:', cert.fingerprint);
    
    // Define the expected fingerprint for certificate pinning.
    const expectedFingerprint = 'A5:24:53:ED:DD:73:D0:F8:C3:53:F6:DB:77:B1:32:43:9B:D3:78:6E';
    
    // Compare the server certificate's fingerprint to the expected fingerprint.
    if (cert.fingerprint !== expectedFingerprint) {
      throw new Error('Certificate fingerprint does not match!');
    }
  }
});

// Make an Axios request with the custom HTTPS agent.
axios.get('https://api.openai.com/v1/models', {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  httpsAgent
})
.then(response => {
//   console.log('Response data:', response.data);
})
.catch(error => {
  console.error('Request error:', error);
});
