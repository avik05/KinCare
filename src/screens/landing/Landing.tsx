import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HOME, useAuth } from '../../lib/auth';
import Icon from '../../components/Icon';
import { Avatar, BrandMark, DoorPhoto } from '../../components/ui';
import './landing.css';

/** The public front page: what KinCare does, for sons and daughters arranging care for a parent in another city. */
export default function Landing() {
  const { session, profile } = useAuth();
  const signedIn = !!(session && profile);
  const [scrolled, setScrolled] = useState(false);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    document.title = 'KinCare: verified caregivers and proof of every visit';
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    const t = requestAnimationFrame(() => setPlay(true));
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(t); };
  }, []);

  const primary = signedIn
    ? <Link className="btn" to={HOME[profile!.role]}>Open my KinCare</Link>
    : <Link className="btn" to="/signup">Create a family account</Link>;

  return (
    <div className="lp">
      <header className={'lp-nav' + (scrolled ? ' scrolled' : '')}>
        <div className="lp-wrap">
          <Link className="logo" to="/" aria-label="KinCare home"><BrandMark /><b>KinCare</b></Link>
          <nav className="lp-links" aria-label="On this page">
            <a href="#how">How it works</a><a href="#proof">Visit records</a><a href="#pricing">Pricing</a><a href="#questions">Questions</a>
          </nav>
          <div className="lp-nav-cta">
            {signedIn
              ? <Link className="btn" to={HOME[profile!.role]}>Open my KinCare</Link>
              : <><Link className="btn quiet" to="/login">Sign in</Link><Link className="btn lp-hide-xs" to="/signup">Get started</Link></>}
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-where"><i />Now caring for families in Chennai and Kolkata</span>
              <h1 className="lp-display">Know Amma is cared for, even from another city.</h1>
              <p className="lp-lede">KinCare books verified caregivers for your parents and shows you every visit as it happens: the time, the place and a photo at the door. If no one turns up, you hear from us within 30 minutes, and a replacement is on the way.</p>
              <div className="lp-ctas">
                {primary}
                <a className="btn secondary" href="#how">See how it works</a>
              </div>
              <div className="lp-trust">
                <span><Icon name="shield" size="sm" />ID, police and training checked</span>
                <span><Icon name="door" size="sm" />Proof of every visit</span>
                <span><Icon name="clock" size="sm" />Replacement within 4 hours</span>
              </div>
            </div>
            <Phone play={play} />
          </div>
        </section>

        {/* why */}
        <section className="lp-sec" aria-labelledby="why-h">
          <div className="lp-wrap">
            <h2 id="why-h" className="sr">Why families need this</h2>
            <p className="lp-quote">“Something happens to them and I am informed too late.”</p>
            <p className="lp-quote-by">A survey respondent whose parents live in another city</p>
            <div className="lp-facts">
              <div className="lp-fact"><b>9<small>of 14</small></b><p>families heard about a problem with a helper only when their parent or a neighbour called.</p></div>
              <div className="lp-fact"><b>8<small>of 14</small></b><p>waited three days or more for a replacement, or never got one.</p></div>
              <div className="lp-fact"><b>7<small>of 15</small></b><p>had their helper’s background checked with documents. The rest took someone on trust.</p></div>
            </div>
            <p className="lp-source">From our survey of 26 families whose parents live in another city, October 2026.</p>
          </div>
        </section>

        {/* how */}
        <section className="lp-sec lp-bg" id="how" aria-labelledby="how-h">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <h2 id="how-h" className="lp-h2">Four steps, and then you can stop worrying about the gate.</h2>
              <p className="lp-lede">You set things up once from your phone. After that, KinCare runs the day: who comes, when they arrive, and what happens if they do not.</p>
            </div>
            <ol className="lp-steps">
              <li className="lp-step"><span className="n">1</span><h3>Add your parent</h3><p>Their address, care needs and a nearby emergency contact. Nothing is saved until you give consent on their behalf.</p></li>
              <li className="lp-step"><span className="n">2</span><h3>Choose a caregiver</h3><p>Only fully verified caregivers near their pin code are shown. Book 12-hour day shifts or 24-hour live-in care, 14 days at a time.</p></li>
              <li className="lp-step"><span className="n">3</span><h3>See every visit</h3><p>The caregiver checks in at the door with location and a photo, ticks off the care plan and records blood pressure and sugar.</p></li>
              <li className="lp-step"><span className="n">4</span><h3>Rate and renew</h3><p>At the end of each block, rate the care and renew with the same caregiver, so your parent sees a familiar face.</p></li>
            </ol>
          </div>
        </section>

        {/* proof */}
        <section className="lp-sec lp-dark" id="proof" aria-labelledby="proof-h">
          <div className="lp-wrap lp-proof-grid">
            <div>
              <h2 id="proof-h" className="lp-h2">Every visit, on the record.</h2>
              <p className="lp-lede" style={{ marginTop: 20 }}>Not a phone call to ask if someone came. A record that builds through the day, which you can open from anywhere.</p>
              <ul className="lp-points">
                <li><span className="pi"><Icon name="pin" /></span><div><b>Checked in at the door</b><p>The time, how close to the home it was taken, and a photo, all recorded the moment the caregiver arrives.</p></div></li>
                <li><span className="pi"><Icon name="check" /></span><div><b>The care plan, ticked off</b><p>Medicines, meals and walks appear with the time each was done, so nothing is left to memory.</p></div></li>
                <li><span className="pi"><Icon name="lock" /></span><div><b>Readings only you should see</b><p>Blood pressure and sugar are visible to you, your coordinator and the caregiver on shift. No one else.</p></div></li>
              </ul>
            </div>
            <div className="lp-record" aria-label="Example visit record">
              <div className="lp-record-h">Amma’s visits<span>Today</span></div>
              <ol className="tl">
                <li className="ev"><span className="ev-time">8:04 am</span><span className="ev-node"><Icon name="door" size="sm" /></span>
                  <div className="ev-body"><h3>Lakshmi checked in</h3><p>At the front door, with location and photo.</p>
                    <figure className="proof" style={{ margin: '10px 0 0' }}><div className="proof-img"><DoorPhoto /><div className="proof-tags"><span><Icon name="clock" size="sm" />8:04 am</span><span><Icon name="pin" size="sm" />Within 12 m</span></div></div></figure></div></li>
                <li className="ev small"><span className="ev-time">9:00 am</span><span className="ev-node"><Icon name="check" size="sm" /></span><div className="ev-body"><h3>Morning medicines</h3></div></li>
                <li className="ev small"><span className="ev-time">9:30 am</span><span className="ev-node"><Icon name="check" size="sm" /></span><div className="ev-body"><h3>Breakfast</h3></div></li>
                <li className="ev"><span className="ev-time">10:30 am</span><span className="ev-node"><Icon name="pulse" size="sm" /></span>
                  <div className="ev-body"><h3>Readings recorded</h3><div className="readings"><div className="vital"><b>128/82</b><span>Blood pressure</span></div><div className="vital"><b>140</b><span>Sugar, mg/dL</span></div></div></div></li>
              </ol>
            </div>
          </div>
        </section>

        {/* missed visit */}
        <section className="lp-sec" aria-labelledby="miss-h">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <h2 id="miss-h" className="lp-h2">If no one turns up, we act. You do not have to.</h2>
              <p className="lp-lede">Today, a missed visit usually means a worried call from a neighbour hours later. With KinCare, the clock starts the moment a shift begins.</p>
            </div>
            <div className="lp-clock">
              <div className="lp-tick-row"><span className="k" /><time>8:00 am</time><h3>The shift starts</h3><p>The caregiver is due at your parent’s door.</p></div>
              <div className="lp-tick-row bad"><span className="k" /><time>8:30 am</time><h3>No check-in, so you are alerted</h3><p>You and your coordinator are told at the same moment, on your phone.</p></div>
              <div className="lp-tick-row ok"><span className="k" /><time>12:30 pm</time><h3>A replacement is at the door</h3><p>A verified caregiver nearby is sent within 4 hours of the alert.</p></div>
              <div className="lp-tick-row warn"><span className="k" /><time>If not</time><h3>It goes to the top</h3><p>If the replacement misses too, the head of care operations takes it over.</p></div>
            </div>
          </div>
        </section>

        {/* checks + parent */}
        <section className="lp-sec lp-bg" aria-labelledby="who-h">
          <div className="lp-wrap">
            <h2 id="who-h" className="sr">Who comes to the door, and what your parent sees</h2>
            <div className="lp-two">
              <article className="lp-panel">
                <h3>Only people we have checked come to the door.</h3>
                <p>Every caregiver passes three checks before you can see them. If even one is missing, they stay hidden from families.</p>
                <div className="lp-checklist">
                  <div className="lp-check"><span className="ci"><Icon name="check" size="sm" /></span><div><b>ID document</b><span>Seen and matched to the person</span></div></div>
                  <div className="lp-check"><span className="ci"><Icon name="check" size="sm" /></span><div><b>Police verification</b><span>Cleared before the first booking</span></div></div>
                  <div className="lp-check"><span className="ci"><Icon name="check" size="sm" /></span><div><b>Elder-care training</b><span>Completed with KinCare</span></div></div>
                  <div className="lp-check"><span className="ci wait"><Icon name="clock" size="sm" /></span><div><b>Police check still pending?</b><span>Then they are not shown to you. Simple as that.</span></div></div>
                </div>
              </article>
              <article className="lp-panel">
                <h3>A screen your parent can actually use.</h3>
                <p>Large type, who is coming today, and one button for help. Hold it for two seconds and you and KinCare know at once.</p>
                <div className="lp-elder" aria-hidden="true">
                  <Avatar text="LR" tone="brand" size="lg" />
                  <div className="who" style={{ marginTop: 12 }}>Lakshmi is coming today</div>
                  <div className="when">8:00 am to 8:00 pm</div>
                  <div className="lp-sos">SOS<small>Press and hold</small></div>
                  <p className="hint2">Your coordinator calls the nearby contact first, then you.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* pricing */}
        <section className="lp-sec" id="pricing" aria-labelledby="price-h">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <h2 id="price-h" className="lp-h2">One membership. The caregiver’s day rate. Nothing hidden.</h2>
              <p className="lp-lede">You see the full price for the whole block before you confirm. Bookings start at 14 days, so the caregiver can plan around your parent.</p>
            </div>
            <div className="lp-price">
              <article className="lp-plan lp-feature">
                <span className="what">KinCare membership</span>
                <div className="lp-amount"><b>₹1,999</b><span>a month, per family</span></div>
                <ul className="lp-incl">
                  <li><Icon name="check" size="sm" />Caregivers with ID, police and training checks</li>
                  <li><Icon name="check" size="sm" />A visit record with check-in time, location and photo, every day</li>
                  <li><Icon name="check" size="sm" />Missed-visit alerts within 30 minutes</li>
                  <li><Icon name="check" size="sm" />A verified replacement within 4 hours</li>
                  <li><Icon name="check" size="sm" />A coordinator in your parent’s city, and an SOS screen for them</li>
                </ul>
              </article>
              <article className="lp-plan">
                <span className="what">Caregiver’s day rate</span>
                <p className="muted" style={{ marginTop: 10 }}>Each caregiver sets their rate based on experience. You see it on their profile before you choose.</p>
                <div className="lp-rates">
                  <div className="lp-rate"><span>12-hour day shift, 8 am to 8 pm</span><b>₹850 to ₹1,200</b></div>
                  <div className="lp-rate"><span>24-hour live-in care</span><b>₹1,500 to ₹1,900</b></div>
                </div>
                <div className="lp-example">For example: 14 day shifts at ₹1,100 come to ₹15,400. With the membership, the total is <b>₹17,399</b> for two weeks of care.</div>
              </article>
            </div>
          </div>
        </section>

        {/* privacy */}
        <section className="lp-sec lp-bg" aria-labelledby="priv-h">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <h2 id="priv-h" className="lp-h2">Your parent’s details stay theirs.</h2>
              <p className="lp-lede">Health information is sensitive, so we collect only what care needs, after you consent, and show it to as few people as possible.</p>
            </div>
            <div className="lp-priv">
              <div><span className="pi"><Icon name="lock" /></span><h3>Few eyes on readings</h3><p>You, your coordinator and the caregiver on shift. The caregiver sees the address only while their shift is on.</p></div>
              <div><span className="pi"><Icon name="pin" /></span><h3>No tracking</h3><p>Location is recorded once, at check-in, as proof of the visit. Never during the day, never off shift.</p></div>
              <div><span className="pi"><Icon name="trash" /></span><h3>Delete everything</h3><p>Close your account and your parent’s profile, readings and photos are deleted. We never keep copies of ID documents.</p></div>
            </div>
          </div>
        </section>

        {/* questions */}
        <section className="lp-sec" id="questions" aria-labelledby="faq-h">
          <div className="lp-wrap">
            <h2 id="faq-h" className="lp-h2" style={{ marginBottom: 32 }}>Questions families ask</h2>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}<Icon name="plus" /></summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap" style={{ paddingBottom: 24 }} aria-labelledby="close-h">
          <div className="lp-close">
            <div>
              <h2 id="close-h">Start with one parent and two weeks.</h2>
              <p>Add them in a few minutes, see verified caregivers near them, and watch the first visit come in.</p>
            </div>
            <div className="lp-ctas">
              {signedIn
                ? <Link className="btn" to={HOME[profile!.role]}>Open my KinCare</Link>
                : <><Link className="btn" to="/signup">Create a family account</Link><Link className="btn ghost" to="/login">Sign in</Link></>}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <Link className="logo" to="/" aria-label="KinCare home"><BrandMark size={28} /><b style={{ fontSize: 17 }}>KinCare</b></Link>
          <nav aria-label="Footer">
            <a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#questions">Questions</a>
            {signedIn ? <Link to={HOME[profile!.role]}>Open my KinCare</Link> : <><Link to="/login">Sign in</Link><Link to="/signup">Create an account</Link></>}
          </nav>
          <p style={{ margin: 0, width: '100%' }}>IT for Managers capstone, GLIM Chennai, Section 4, Group 5.</p>
        </div>
      </footer>
    </div>
  );
}

const FAQ: [string, string][] = [
  ['Which cities do you cover?', 'Chennai and Kolkata today. When you add your parent, we show only caregivers close to their pin code. If there is no one nearby yet, your coordinator calls you within a day.'],
  ['What happens if the caregiver is ill or late?', 'If there is no check-in 30 minutes after the shift starts, you and your coordinator are alerted together. The coordinator sends a verified caregiver from nearby within 4 hours, and you can follow each step in the app.'],
  ['Why is the minimum booking 14 days?', 'Good care depends on the same person coming back. Two-week blocks let the caregiver plan around your parent and get to know their routine. At the end of a block you can renew or stop.'],
  ['Does my parent need a smartphone?', 'No. The caregiver’s check-in and visit record work without them. If they have a phone or tablet, we set up a simple screen that shows who is coming today and has a large SOS button.'],
  ['How do I know the photo was taken at the house?', 'Check-in records the caregiver’s location at that moment and shows you how close it was to your parent’s home, next to the door photo. A check-in without both is not accepted.'],
  ['Can I see the care from more than one phone?', 'Yes. Sign in on any phone or computer. You can also add KinCare to your home screen and turn on alert notifications on each device.'],
];

/** The hero phone: the family's home screen, with a check-in arriving and the care plan filling in. */
function Phone({ play }: { play: boolean }) {
  return (
    <div className={'lp-stage' + (play ? ' lp-play' : '')} aria-label="KinCare on a phone: Lakshmi checks in at 8:04 am and the care plan fills in" role="img">
      <div className="lp-phone-wrap">
      <div className="lp-float f1"><span className="av brand">LR</span><div><b>Police check cleared</b><span>Lakshmi R., 6 years of home care</span></div></div>
      <div className="lp-float f2"><Icon name="lock" /><div><b>Only you see readings</b><span>And the caregiver on shift</span></div></div>
      <div className="lp-phone">
        <div className="lp-screen">
          <span className="lp-notch" />
          <div className="lp-sb"><span>8:04</span><span>5G</span></div>
          <div className="lp-toast"><span className="lp-ti"><BrandMark size={22} /></span><div><b>KinCare</b><span>Lakshmi checked in at Amma’s door</span></div></div>
          <div className="lp-app">
            <div className="lp-app-h">Good morning, Meera</div>
            <div className="lp-app-sub">Thursday, 5 November</div>
            <div className="lp-card">
              <div style={{ position: 'relative', margin: 12 }}>
                <div className="lp-now lp-now-a" style={{ margin: 0 }}><span className="lp-dot" /><div><b>Lakshmi is due at 8:00 am</b><span>Amma’s home, Adyar</span></div></div>
                <div className="lp-now ok lp-now-b"><span className="lp-dot" /><div><b>Lakshmi checked in at 8:04 am</b><span>Location and door photo recorded</span></div></div>
              </div>
              <div className="lp-photo"><DoorPhoto /><div className="proof-tags"><span><Icon name="clock" size="sm" />8:04 am</span><span><Icon name="pin" size="sm" />Within 12 m</span></div></div>
              <ul className="lp-tasks">
                {[['Morning medicines', '9:00 am'], ['Breakfast', '9:30 am'], ['Short walk', '10:15 am']].map(([t, at]) => (
                  <li key={t}><span className="lp-tick"><Icon name="check" className="" /></span>{t}<time>{at}</time></li>
                ))}
              </ul>
              <div className="lp-vitals"><div><b>128/82</b><span>BP, 10:30 am</span></div><div><b>140</b><span>Sugar, 10:30 am</span></div></div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
