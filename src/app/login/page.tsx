import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
        <div className="mt-6 text-center text-xs text-muted-foreground">
          By logging in you agree to our terms.
        </div>
      </div>
    </div>
  )
}
