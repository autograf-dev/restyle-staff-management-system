export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enter your email and well send you a reset link.
            </p>
          </div>
          <form>
            <div className="grid gap-3">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                className="border-input bg-background text-foreground ring-ring placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Send reset link
            </button>
            <div className="mt-4 text-center text-sm">
              <a href="/login" className="underline underline-offset-4">
                Back to login
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


