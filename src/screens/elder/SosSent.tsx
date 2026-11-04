import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';

export default function SosSent() {
  useEffect(() => { document.title = 'Help is coming | KinCare'; }, []);
  return (
    <main className="elder">
      <div className="sent-wave" aria-hidden="true"><i /><i /><i /><span><Icon name="check" className="" /></span></div>
      <div className="elder-who" style={{ marginTop: 32 }} role="status">
        <h1>Your family has been told</h1>
        <p style={{ fontVariantNumeric: 'normal' }}>KinCare will call you in a moment. Stay where you are.</p>
      </div>
      <Link className="btn secondary lg block" style={{ marginTop: 'auto', fontSize: 19 }} to="/e">Back</Link>
    </main>
  );
}
