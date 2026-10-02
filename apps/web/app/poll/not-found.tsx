export default function PollNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">This poll link is not valid</h1>
      <p className="mt-2 text-[#6B5B63]">
        Ask the organiser to send you a new link.
      </p>
    </main>
  );
}
