import React, { useState, useEffect } from 'react';
import { PiShieldCheckFill, PiCookieFill, PiFileTextFill, PiPrinterFill, PiX, PiCheck, PiArrowRight } from 'react-icons/pi';

export function getStoredCookieConsent() {
  try {
    const raw = localStorage.getItem('bei_cookie_consent');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCookieConsent(level) {
  const data = {
    level, // 'all' | 'essential'
    essential: true,
    preferences: level === 'all',
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem('bei_cookie_consent', JSON.stringify(data));
  } catch {}
  return data;
}

export function CookieBanner({ onOpenSettings, onOpenPrivacy }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredCookieConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie and Privacy Consent">
      <div className="cookie-banner-content">
        <div className="cookie-banner-icon">
          <PiCookieFill />
        </div>
        <div className="cookie-banner-text">
          <strong>Data Privacy, Cookies &amp; Research Consent</strong>
          <p>
            Temple BEI uses cookies and browser storage to keep you securely signed in, maintain chapter scheduling, and process legally permitted volunteer and member data for chapter operations, informatics, and academic studies. By continuing to use this website, you grant permission for this data access and agree to our{' '}
            <button type="button" className="inline-link" onClick={onOpenPrivacy}>
              Privacy Policy
            </button>{' '}
            and{' '}
            <button type="button" className="inline-link" onClick={onOpenSettings}>
              Terms of Service
            </button>
            .
          </p>
        </div>
      </div>
      <div className="cookie-banner-actions">
        <button
          type="button"
          className="secondary sm-btn"
          onClick={() => {
            saveCookieConsent('essential');
            setVisible(false);
          }}
        >
          Essential Only
        </button>
        <button
          type="button"
          className="secondary sm-btn"
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
          }}
        >
          Customize
        </button>
        <button
          type="button"
          className="primary sm-btn"
          onClick={() => {
            saveCookieConsent('all');
            setVisible(false);
          }}
        >
          <PiCheck /> Accept All &amp; Consent
        </button>
      </div>
    </div>
  );
}

export function PrivacyPolicyContent() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="legal-document">
      <div className="legal-header">
        <div className="legal-badge">
          <PiShieldCheckFill /> Legal Compliance & Data Protection
        </div>
        <h3>Temple BEI Volunteer Hub Privacy Policy</h3>
        <p className="legal-meta">
          Brain Exercise Initiative at Temple University · Recognized Student Organization
          <br />
          Effective Date: October 2026 · Version 2.5
        </p>
        <button type="button" className="secondary sm-btn print-btn no-print" onClick={handlePrint}>
          <PiPrinterFill /> Print / Save PDF
        </button>
      </div>

      <div className="legal-body">
        <section>
          <h4>1. Purpose and Scope</h4>
          <p>
            The Brain Exercise Initiative at Temple University (&quot;Temple BEI,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;the Chapter&quot;) operates the Temple BEI Volunteer Hub (&quot;the Hub&quot;). This Privacy Policy explains how we collect, use, store, and safeguard student volunteer data when you access our member services, log service hours, or schedule volunteer shifts.
          </p>
          <p>
            By using this Hub, creating an account, or submitting service records, you acknowledge and explicitly grant Temple BEI, its student coordinators, faculty advisors, and authorized researchers permission to collect, store, process, and analyze all legally permissible Personally Identifiable Information (PII) and volunteer operational records for chapter administration, educational informatics, and academic or scientific studies.
          </p>
        </section>

        <section>
          <h4>2. Information We Collect</h4>
          <p>We collect information necessary to administer chapter operations, verify volunteer hours, and support chapter informatics and academic studies:</p>
          <ul>
            <li>
              <strong>Personally Identifiable Information (PII) &amp; Profile Data:</strong> Full name, university email address (<code>@temple.edu</code> or approved account), academic major, expected graduation year, and self-provided member biography.
            </li>
            <li>
              <strong>Volunteer Service Records:</strong> Dates of service, logged volunteer hours, description of memory/cognitive exercises conducted, senior living facilities visited, and feedback submitted to coordinators.
            </li>
            <li>
              <strong>Scheduling, Availability &amp; Attendance Metrics:</strong> Volunteer shift reservations, attendance check-ins, spot pickups and drops, swap history, availability schedules, and roster records.
            </li>
            <li>
              <strong>Coordinator Reviews &amp; Operational Audits:</strong> Verification timestamps, feedback reasons, and approval statuses recorded by authorized Chapter Executive Board members.
            </li>
            <li>
              <strong>Authentication &amp; Technical Security Data:</strong> Cryptographic password hashes (salted and stored via Supabase Auth), IP/browser headers, and session tokens from authorized identity providers (Apple Sign-In JS, OpenAI/ChatGPT SSO).
            </li>
          </ul>
        </section>

        <section>
          <h4>3. How We Use Your Information</h4>
          <p>Your data is utilized for non-profit educational, chapter operational, and academic research purposes:</p>
          <ul>
            <li>To certify and verify volunteer hours for academic honors, graduation cords, medical school applications, and university recognition.</li>
            <li>To coordinate student volunteer coverage at partner nursing homes and senior living communities in the Philadelphia area.</li>
            <li>To dispatch critical shift updates, emergency coverage requests, and chapter newsletters.</li>
            <li>To provide an authenticated member directory allowing signed-in Temple BEI members to connect with chapter peers.</li>
            <li>To conduct institutional informatics, evaluating volunteer engagement trends, attendance consistency, and scheduling models.</li>
            <li>To support academic research and scientific studies evaluating student service-learning, cognitive stimulation interventions, and community health outcomes.</li>
          </ul>
        </section>

        <section>
          <h4>4. Authorization for Informatics, Analytics, and Academic Studies</h4>
          <div className="legal-highlight">
            <strong>Permission for Informatics &amp; Research Studies:</strong> By using this website, you grant Temple BEI and authorized investigators permission to access, analyze, and model your volunteer and platform data for educational informatics, health service analytics, and scientific studies.
          </div>
          <p>
            This permission allows the chapter to analyze volunteer participation, session reliability, and cognitive exercise intervention trends over time. Findings may be utilized in university symposiums, academic papers, scientific presentations, conference abstracts, or non-profit grant applications.
          </p>
          <p>
            <strong>Commitment to De-Identification in Publications:</strong> To safeguard individual volunteer privacy, any data published in academic journals, public research presentations, or external grant reports will be strictly de-identified, aggregated, or anonymized in compliance with scientific research ethics, institutional review board (IRB) principles, and FERPA standards. Individual volunteer names and personal contact information will not be publicly identified in published research without prior written consent.
          </p>
        </section>

        <section>
          <h4>5. Non-Commercial Data Commitment</h4>
          <p>
            Temple BEI does NOT sell, rent, monetize, trade, or distribute your personal information or student records to any third-party commercial marketing companies, advertisers, or commercial data brokers under any circumstances. All data utilization is confined to non-profit, educational, operational, and research purposes.
          </p>
        </section>

        <section>
          <h4>6. Third-Party Service Providers and Infrastructure</h4>
          <p>To safely host and operate this portal, we partner with industry-standard cloud providers:</p>
          <ul>
            <li>
              <strong>Supabase Inc.:</strong> Secure PostgreSQL database storage encrypted at rest (AES-256) and in transit (TLS 1.3), managing access through row-level security policies.
            </li>
            <li>
              <strong>Cloudflare / OpenAI Sites:</strong> Secure Content Delivery Network (CDN) and edge compute hosting protecting against DDoS and unauthorized network tampering.
            </li>
            <li>
              <strong>Apple Inc.:</strong> Secure single sign-on credential verification via Apple ID authentication servers.
            </li>
          </ul>
        </section>

        <section>
          <h4>7. FERPA &amp; Student Privacy Notice</h4>
          <p>
            Temple BEI is an independent recognized student organization at Temple University. The Hub is managed by chapter officers and faculty advisors. Volunteer records are kept confidential within the chapter and are only disclosed to university officials or external institutions upon the student volunteer&apos;s explicit request or verification authorization.
          </p>
        </section>

        <section>
          <h4>8. Data Security and Access Controls</h4>
          <p>
            We implement strict technical and organizational measures to prevent unauthorized data access. Only the designated Chapter Administrator and authorized Executive Board members can review pending hours, modify rosters, or publish newsletters. Individual volunteers can only edit or view their own private submissions and publicly shared directory profiles.
          </p>
        </section>

        <section>
          <h4>9. Your Rights &amp; Data Deletion</h4>
          <p>
            Under applicable state, federal, and university standards, you have the right to inspect, download (via CSV export), update, or permanently delete your profile and activity records. To request account deletion or data anonymization, contact the Executive Board at <code>templebei@gmail.com</code>.
          </p>
        </section>

        <section>
          <h4>10. Inquiries and Contact Information</h4>
          <p>
            For any questions regarding this Privacy Policy or chapter data practices, please contact:
            <br />
            <strong>Executive Board · Brain Exercise Initiative at Temple University</strong>
            <br />
            Temple University, Philadelphia, PA 19122
            <br />
            Email: <a href="mailto:templebei@gmail.com">templebei@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsOfServiceContent() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="legal-document">
      <div className="legal-header">
        <div className="legal-badge">
          <PiFileTextFill /> Terms of Service & Liability Disclaimer
        </div>
        <h3>Temple BEI Volunteer Hub Terms of Service</h3>
        <p className="legal-meta">
          Brain Exercise Initiative at Temple University · Volunteer Agreement & Release
          <br />
          Effective Date: October 2026 · Version 2.5
        </p>
        <button type="button" className="secondary sm-btn print-btn no-print" onClick={handlePrint}>
          <PiPrinterFill /> Print / Save PDF
        </button>
      </div>

      <div className="legal-body">
        <section>
          <h4>1. Acceptance of Terms &amp; Data Permission Grant</h4>
          <p>
            By accessing, creating an account on, or logging hours through the Temple BEI Volunteer Hub (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please discontinue use of the portal immediately.
          </p>
          <div className="legal-highlight">
            <strong>EXPRESS DATA ACCESS &amp; RESEARCH PERMISSION GRANT:</strong> BY USING THIS WEBSITE, REGISTERING AN ACCOUNT, OR SUBMITTING VOLUNTEER HOURS, YOU EXPLICITLY GRANT TEMPLE BEI, ITS STUDENT OFFICERS, EXECUTIVE BOARD, FACULTY ADVISORS, AND AFFILIATED RESEARCH INVESTIGATORS FULL PERMISSION AND A WORLDWIDE, NON-EXCLUSIVE, ROYALTY-FREE, PERPETUAL LICENSE TO ACCESS, COLLECT, STORE, COMBINE, AND PROCESS ANY LEGALLY PERMISSIBLE PERSONALLY IDENTIFIABLE INFORMATION (PII), VOLUNTEER METRICS, ATTENDANCE RECORDS, AND PROFILE DATA FOR CHAPTER OPERATIONS, EDUCATIONAL INFORMATICS, COMPUTATIONAL MODELING, AND ACADEMIC OR SCIENTIFIC RESEARCH STUDIES.
          </div>
        </section>

        <section>
          <h4>2. Scope of Informatics, Analytics &amp; Research Studies</h4>
          <p>
            You acknowledge and agree that your participation and platform activity data may be utilized to evaluate volunteer engagement, scheduling dynamics, retention rates, and community cognitive stimulation impact. Temple BEI may include findings derived from this data in academic journals, scientific symposiums, conference abstracts, and non-profit grant proposals.
          </p>
          <p>
            <strong>De-Identification &amp; Waiver of Royalties:</strong> Temple BEI agrees that any public scientific or academic presentation will present volunteer data in an aggregated, anonymized, or de-identified format in compliance with scientific ethics, institutional review board (IRB) principles, and FERPA. You acknowledge and agree that you waive any claim to financial compensation, royalties, or proprietary rights arising from any research models, publications, or informatics developments.
          </p>
        </section>

        <section>
          <h4>3. Complete Disclaimer of Warranties (&quot;As-Is&quot; Basis)</h4>
          <div className="legal-highlight warning">
            <strong>DISCLAIMER OF WARRANTIES:</strong> THIS SERVICE AND ALL CHAPTER INFORMATION, SCHEDULING, AND HOURS TRACKING ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. TEMPLE BEI MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, SYSTEM AVAILABILITY, OR FREEDOM FROM TECHNICAL ERRORS OR SYSTEM OUTAGES.
          </div>
        </section>

        <section>
          <h4>4. Limitation of Liability and Release</h4>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER THE BRAIN EXERCISE INITIATIVE, ITS TEMPLE UNIVERSITY CHAPTER, STUDENT OFFICERS, EXECUTIVE BOARD MEMBERS, SYSTEM ADMINISTRATORS, VOLUNTEER COORDINATORS, FACULTY ADVISORS, NOR TEMPLE UNIVERSITY SHALL BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM:
          </p>
          <ul>
            <li>Any technical malfunction, service downtime, loss of data, or scheduling discrepancies;</li>
            <li>Any personal injury, illness, property damage, loss, or incident occurring during, travelling to, or returning from volunteer shifts at external partner facilities;</li>
            <li>Any cancellation, rescheduling, or policy enforcement enacted by third-party senior care homes, clinics, or nursing facilities;</li>
            <li>Unauthorized access, account compromise, or security breaches resulting from third-party actions.</li>
          </ul>
        </section>

        <section>
          <h4>5. Independent Student Organization Disclaimer</h4>
          <p>
            The Brain Exercise Initiative at Temple University is an independent recognized student organization. The organization is student-directed and does not represent the official policies, administrative actions, or legal obligations of Temple University. Temple University assumes no responsibility or liability for the organization&apos;s contracts, events, or volunteer operations.
          </p>
        </section>

        <section>
          <h4>6. Senior Resident Privacy and HIPAA / Care Facility Confidentiality</h4>
          <div className="legal-highlight">
            <strong>Strict Confidentiality of Senior Care Residents:</strong> Volunteers work with elderly individuals suffering from Alzheimer&apos;s disease, dementia, or cognitive impairment. You agree to strictly respect and maintain resident privacy at all times:
            <ul>
              <li><strong>NO Unauthorized Photography or Recording:</strong> You may not photograph, film, or record any resident, patient, or medical room under any circumstances.</li>
              <li><strong>NO Social Media Disclosures:</strong> Posting resident names, medical conditions, photos, or identifying characteristics on personal social media platforms (Instagram, TikTok, LinkedIn, etc.) is strictly prohibited.</li>
              <li><strong>Mandatory Facility Protocol:</strong> Volunteers must comply with all health, safety, background clearance, and hygiene rules mandated by partner facilities.</li>
            </ul>
            Violation of resident privacy constitutes a severe breach of ethics and will result in immediate termination of chapter membership and potential referral to University Student Conduct.
          </div>
        </section>

        <section>
          <h4>7. Academic Integrity &amp; Honest Hour Logging</h4>
          <p>
            All volunteer hours submitted through the Hub must accurately reflect service time actually completed. Falsifying volunteer hours, claiming unearned service, submitting fraudulent entries, or attempting to forge coordinator approvals is a direct violation of Temple University&apos;s Student Code of Conduct and will result in permanent disqualification from graduation honors and referral to the Office of Student Conduct and Community Standards.
          </p>
        </section>

        <section>
          <h4>8. Shift Commitment and 4-Hour Drop Lock Rule</h4>
          <p>
            Partner senior care facilities depend on our scheduled volunteers for vital cognitive stimulation programs. Volunteers agree to arrive on time for all booked shifts. In accordance with Chapter Rules, volunteer shifts cannot be dropped online within four (4) hours of the scheduled start time; any emergency cancellations must be reported directly to an Executive Board coordinator to arrange substitute coverage.
          </p>
        </section>

        <section>
          <h4>9. Termination and Account Suspension</h4>
          <p>
            The Chapter Administrator reserves the right to suspend, restrict, or terminate any member account that violates these Terms of Service, engages in disruptive behavior, or fails to uphold the community standards of Temple BEI.
          </p>
        </section>

        <section>
          <h4>10. Governing Law</h4>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Pennsylvania, without giving effect to any principles of conflicts of law.
          </p>
        </section>
      </div>
    </div>
  );
}

export function CookieSettingsContent({ onSave, onClose }) {
  const current = getStoredCookieConsent() || { essential: true, preferences: true };
  const [preferences, setPreferences] = useState(current.preferences ?? true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveCookieConsent(preferences ? 'all' : 'essential');
    setSaved(true);
    if (onSave) onSave();
    setTimeout(() => {
      if (onClose) onClose();
    }, 1200);
  };

  return (
    <div className="legal-document">
      <div className="legal-header">
        <div className="legal-badge">
          <PiCookieFill /> Cookie & Local Storage Preferences
        </div>
        <h3>Cookie Policy & Privacy Preferences</h3>
        <p className="legal-meta">
          Temple BEI Volunteer Hub · Transparency in Data Storage
        </p>
      </div>

      <div className="legal-body">
        <p>
          We believe in transparent, ethical software. Below is a complete disclosure of every cookie and browser storage key used by this application:
        </p>

        <div className="cookie-group">
          <div className="cookie-group-header">
            <div>
              <strong>1. Strictly Necessary Storage (Always Active)</strong>
              <small>Required for the web application to function securely.</small>
            </div>
            <span className="badge approved">Always Active</span>
          </div>
          <p className="cookie-desc">
            These storage items maintain your secure sign-in session, cryptographic authentication tokens, CSRF protection, and your cookie consent choice. Disabling these would prevent the website from functioning.
          </p>
          <table className="cookie-table">
            <thead>
              <tr>
                <th>Key / Name</th>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>bei_sb_session</code></td>
                <td>Temple BEI / Supabase</td>
                <td>Maintains authenticated user session and authorization state.</td>
                <td>Session / 30 Days</td>
              </tr>
              <tr>
                <td><code>bei_cookie_consent</code></td>
                <td>Temple BEI</td>
                <td>Remembers your cookie preferences so the banner is not shown repeatedly.</td>
                <td>1 Year</td>
              </tr>
              <tr>
                <td><code>oai-*</code></td>
                <td>Sites Platform</td>
                <td>Secure authentication headers for university chapter identity.</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="cookie-group">
          <div className="cookie-group-header">
            <div>
              <strong>2. Functional & UI Preferences (Optional)</strong>
              <small>Stores navigation choices and active filters.</small>
            </div>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={preferences}
                onChange={e => setPreferences(e.target.checked)}
              />
              <span className="switch-text">{preferences ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <p className="cookie-desc">
            Remembers user interface states (such as active shift filter tabs, recent search queries, and view preferences) and assists in aggregating chapter coordination analytics and volunteer informatics for educational studies.
          </p>
        </div>

        <div className="cookie-group disabled-group">
          <div className="cookie-group-header">
            <div>
              <strong>3. Third-Party Advertising & Cross-Site Tracking</strong>
              <small>Marketing, advertising pixels, and profiling.</small>
            </div>
            <span className="badge returned">Not Used / Blocked</span>
          </div>
          <p className="cookie-desc">
            Temple BEI strictly refuses commercial trackers, behavioral ad pixels, and surveillance marketing. No data is ever shared with advertising exchanges.
          </p>
        </div>

        {saved && (
          <div className="notice" style={{ background: '#e7f7e9', borderColor: '#b6e2bb', color: '#1a5928', marginTop: 15 }}>
            <PiCheck /> Your cookie preferences have been successfully saved.
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            <PiCheck /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

