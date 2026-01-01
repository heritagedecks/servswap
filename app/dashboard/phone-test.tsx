import { useState } from 'react';
import { getAuth, signInWithPhoneNumber } from 'firebase/auth';
import { app } from '../lib/firebase';

export default function PhoneTestPage() {
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState('');

  const sendCode = async () => {
    setError(null);
    setSuccess('');
    try {
      const auth = getAuth(app);
      // Force test mode
      // @ts-ignore
      auth.settings.appVerificationDisabledForTesting = true;
      const phone = '+16505550000'; // Firebase test number
      const confirmationResult = await signInWithPhoneNumber(auth, phone, undefined);
      setConfirmation(confirmationResult);
      setSuccess('Code sent! Use 123456 as the code.');
    } catch (err: any) {
      setError(err.message || 'Failed to send code.');
    }
  };

  const verifyCode = async () => {
    setError(null);
    setSuccess('');
    if (!confirmation) {
      setError('Please send the code first.');
      return;
    }
    try {
      await confirmation.confirm(code);
      setSuccess('Phone number verified!');
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Minimal Firebase Phone Auth Test</h2>
      <button onClick={sendCode} style={{ padding: '8px 16px', marginBottom: 16 }}>Send Test Code</button>
      <div>
        <input
          type="text"
          placeholder="Enter code (123456)"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ padding: 8, width: '100%', marginBottom: 8 }}
        />
        <button onClick={verifyCode} style={{ padding: '8px 16px' }}>Verify Code</button>
      </div>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: 12 }}>{success}</div>}
      <div style={{ marginTop: 24, fontSize: 12, color: '#888' }}>
        This page uses Firebase test mode. Phone: <b>+16505550000</b>, Code: <b>123456</b>.<br />
        Make sure this test number is registered in your Firebase Console for your current project.
      </div>
    </div>
  );
} 