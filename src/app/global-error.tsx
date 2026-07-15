"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#08080c", color: "white", fontFamily: "system-ui", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <title>GLS TV unavailable</title>
            <h1>GLS TV could not load</h1>
            <p>Please try again in a moment.</p>
            <button onClick={unstable_retry} style={{ padding: "10px 18px", cursor: "pointer" }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
