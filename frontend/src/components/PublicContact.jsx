// beacon2026/frontend/src/components/PublicContact.jsx
// Small footer block showing a u3a's public contact details (phone / email /
// home page) on unauthenticated pages (Members Portal sign-in, online joining).
// Renders nothing when none of the details are configured.

export default function PublicContact({ phone, email, homePage, className = '' }) {
  if (!phone && !email && !homePage) return null;

  return (
    <div className={`text-center text-xs text-slate-500 ${className}`}>
      <p className="mb-1 font-medium text-slate-600">Need help? Contact us</p>
      <ul className="space-y-0.5">
        {phone && (
          <li>
            <a href={`tel:${phone}`} className="text-blue-700 hover:underline">
              {phone}
            </a>
          </li>
        )}
        {email && (
          <li>
            <a href={`mailto:${email}`} className="text-blue-700 hover:underline">
              {email}
            </a>
          </li>
        )}
        {homePage && (
          <li>
            <a
              href={homePage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              Visit our website
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
