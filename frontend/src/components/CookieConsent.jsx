// beacon2/frontend/src/components/CookieConsent.jsx
// Cookie consent dialog matching the original Beacon's Cookie Control panel.
// Shows on first visit; gear icon allows reopening after dismissal.

import { useState, useEffect } from 'react';
import { getConsentValue, setConsent } from '../hooks/useCookieConsent.js';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show dialog if user hasn't made a choice yet
    if (getConsentValue() === null) setVisible(true);

    const handler = () => setVisible(false);
    window.addEventListener('beacon2-consent-changed', handler);
    return () => window.removeEventListener('beacon2-consent-changed', handler);
  }, []);

  const handleAccept = () => {
    setConsent(true);
    setVisible(false);
  };

  const handleDecline = () => {
    setConsent(false);
    setVisible(false);
  };

  const handleReopen = () => {
    setShowDetails(false);
    setVisible(true);
  };

  return (
    <>
      {/* Gear icon — always visible when dialog is closed */}
      {!visible && (
        <button
          onClick={handleReopen}
          className="fixed bottom-4 left-4 z-50 w-10 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          title="Cookie settings"
          aria-label="Open cookie settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Cookie consent dialog */}
      {visible && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4"
          role="dialog" aria-modal="true" aria-label="Cookie consent">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40" />

          {/* Panel */}
          <div className="relative bg-slate-800 text-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
            {/* Close button */}
            <button
              onClick={handleDecline}
              className="absolute top-3 right-3 text-slate-300 hover:text-white text-sm"
              aria-label="Close cookie control"
            >
              Close Cookie Control &times;
            </button>

            <h2 className="text-lg font-bold mb-4 pr-40">
              This site uses cookies to store information on your computer.
            </h2>

            <p className="text-sm text-slate-300 mb-3">
              As well as essential cookies, Beacon2 has optional cookies that save
              your preferences for future visits in order to improve your experience.
              These optional cookies are described below.
            </p>

            <p className="text-sm text-slate-300 mb-3">
              Beacon2 does not use third party, tracking or statistics cookies.
            </p>

            <p className="text-sm text-slate-300 mb-5">
              Only accept optional cookies if you are using a private computer.
            </p>

            {/* Action buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleAccept}
                className="px-4 py-2 border border-white rounded text-sm font-medium hover:bg-white hover:text-slate-800 transition-colors"
              >
                I Accept optional cookies
              </button>
              <button
                onClick={handleDecline}
                className="px-4 py-2 border border-white rounded text-sm font-medium hover:bg-white hover:text-slate-800 transition-colors"
              >
                I Do Not Accept
              </button>
            </div>

            <hr className="border-slate-600 mb-4" />

            {/* Optional cookies details — collapsible */}
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="text-sm font-bold mb-3 hover:underline cursor-pointer"
            >
              Optional Cookies {showDetails ? '\u25B2' : '\u25BC'}
            </button>

            {showDetails && (
              <div className="text-sm text-slate-300">
                <p className="mb-2">
                  Beacon2 uses cookies to retain preferences between visits.
                </p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>The name of the u3a site you login to</li>
                  <li>The timeout period of inactivity after which you will be logged out</li>
                  <li>How forenames and surnames appear and are sorted on Drop-Down lists</li>
                  <li>Text size and colour theme preferences</li>
                  <li>Last membership class used for exporting addresses and labels</li>
                  <li>Label printing settings (labels per sheet and positioning)</li>
                  <li>Third Age Matters (TAM) submission status and class</li>
                  <li>Email compose 'From' address and copy selection</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
