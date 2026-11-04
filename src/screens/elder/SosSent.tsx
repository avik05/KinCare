import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';

export default function SosSent() {
  return (
    <div className="shell white"><main className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="sent-wave" aria-hidden="true"><i /><i /><i /><span><Icon name="check" className="" /></span></div>
      <div className="elder-today" style={{ marginTop: 24 }} role="status">
        <h1>Your family has been told</h1>
        <p>KinCare will call you now. Stay where you are.</p>
      </div>
      <Link className="btn ghost" style={{ marginTop: 'auto', fontSize: 19, padding: 16 }} to="/e">Back</Link>
    </main></div>
  );
}
