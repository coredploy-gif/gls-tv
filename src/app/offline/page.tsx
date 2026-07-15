export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div>
        <h1 className="gls-display text-4xl text-white">You’re offline</h1>
        <p className="mt-3 text-gls-body">Streaming, account changes and payments require a connection. Reconnect, then retry the action once.</p>
      </div>
    </main>
  );
}
