// beacon2026/frontend/src/components/DemoUnavailableBanner.jsx
// Warns that a piece of functionality isn't wired up in this demo
// environment (e.g. no SendGrid/PayPal credentials configured).

export default function DemoUnavailableBanner({ feature }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      <strong>Not available in this demo:</strong> {feature} is not yet configured.
    </div>
  );
}
