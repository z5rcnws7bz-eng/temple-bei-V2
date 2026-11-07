import {PiArrowRight, PiHeart} from 'react-icons/pi';

const chapterUrl = 'https://linktr.ee/templeuni.bei';

function getDonationUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const donationUrl = getDonationUrl(import.meta.env.VITE_BEI_DONATION_URL);

export function Donations({onViewShifts}) {
  return (
    <div className="donations">
      <section className="panel donation-panel" aria-labelledby="donation-heading">
        <h2 id="donation-heading">Give to Temple BEI</h2>
        <p>Temple University volunteers spend time with older adults doing activities like reading aloud, writing, and simple math. Support could help the chapter print activity materials, stock session supplies, and prepare volunteers.</p>
        <a className="primary donation-action" href={donationUrl || chapterUrl} target="_blank" rel="noopener noreferrer">
          <PiHeart aria-hidden="true"/>
          {donationUrl ? 'Donate now' : 'Ask about giving'}
        </a>
        <p className="muted">
          {donationUrl
            ? 'The giving page opens in a new tab and handles your payment.'
            : 'Online giving is currently unavailable. The chapter’s contact links open in a new tab.'}
        </p>
      </section>
      <div className="overview-grid">
        <section className="panel donation-panel" aria-labelledby="donation-questions">
          <h2 id="donation-questions">Giving questions</h2>
          <p>Ask the chapter about current needs, donating supplies, or whether a receipt is available for your gift.</p>
          <a className="text-link" href={chapterUrl}>Temple BEI contact links <PiArrowRight aria-hidden="true"/></a>
        </section>
        <section className="panel donation-panel" aria-labelledby="donation-volunteer">
          <h2 id="donation-volunteer">Give your time</h2>
          <p>Join a volunteer session and spend time doing brain exercises with older adults.</p>
          <button type="button" className="text-link" onClick={onViewShifts}>View volunteer shifts <PiArrowRight aria-hidden="true"/></button>
        </section>
      </div>
    </div>
  );
}
