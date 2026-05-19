import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-2xl">Smart Kitchen Admin</CardTitle>
          <CardDescription className="text-zinc-400">
            Masukkan email dan password untuk masuk ke dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                required
                className="border-zinc-700 bg-zinc-800"
                suppressHydrationWarning
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="border-zinc-700 bg-zinc-800"
                suppressHydrationWarning
              />
            </div>
            {resolvedSearchParams?.message && (
              <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
                {resolvedSearchParams.message}
              </p>
            )}
            <Button type="submit" formAction={login} className="w-full bg-blue-600 hover:bg-blue-700" suppressHydrationWarning>
              Masuk
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
