// beacon2/frontend/src/components/BeaconLogo.jsx
// Approximate recreation of the u3a Beacon logo using styled text.
// Expects light.jpg in frontend/public/ for the page background,
// but the logo itself is pure CSS.

const BLUE = '#1d5da8';

export default function BeaconLogo({ large = false }) {
  return (
    <div style={{ display: 'inline-block', textAlign: 'center', lineHeight: 1 }}>
      <div style={{
        fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
        fontWeight: 900,
        fontSize: large ? 72 : 52,
        color: BLUE,
        letterSpacing: -2,
        lineHeight: 1,
        userSelect: 'none',
      }}>
        u3a
      </div>
      <div style={{
        fontFamily: 'Arial, sans-serif',
        fontWeight: 700,
        fontSize: large ? 24 : 17,
        color: BLUE,
        letterSpacing: 3,
        textAlign: 'center',
        marginTop: large ? 4 : 2,
        userSelect: 'none',
      }}>
        Beacon
      </div>
    </div>
  );
}
