import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams
  const errorMessage = resolvedSearchParams?.message

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#09090b] px-4 overflow-hidden">
      {/* Extremely subtle ambient glow in the center background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Clean centered login form */}
      <LoginForm errorMessage={errorMessage} />
    </div>
  )
}
