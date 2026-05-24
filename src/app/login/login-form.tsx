'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { login } from './actions'

import Image from 'next/image'
import logoArka from '@/components/logo/logo arkahygiene.png'

export function LoginForm({ errorMessage }: { errorMessage?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleFormSubmit = () => {
    setIsLoading(true)
  }

  return (
    <div className="w-full max-w-[390px] p-7 md:p-8 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-md shadow-2xl text-zinc-200 relative overflow-hidden">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-4 mb-7">
        <div className="flex h-12 w-12 items-center justify-center shrink-0 overflow-hidden p-1">
          <Image src={logoArka} alt="ArkaHygiene" className="w-full h-full object-contain mix-blend-screen invert opacity-90" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white">
            ArkaHygiene Admin
          </h2>
          <p className="text-xs text-zinc-500 leading-normal">
            Masukkan kredensial Anda untuk mengakses dashboard AIoT.
          </p>
        </div>
      </div>

      {/* Form Section */}
      <form
        onSubmit={handleFormSubmit}
        className="space-y-4.5"
      >
        {/* Email input */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            required
            className="h-9.5 px-3 border-zinc-900 focus-visible:border-zinc-700 bg-zinc-900/40 text-sm w-full text-white placeholder-zinc-700 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
            suppressHydrationWarning
          />
        </div>

        {/* Password input */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Password
          </Label>
          <div className="relative rounded-lg overflow-hidden border border-zinc-900 focus-within:border-zinc-700 bg-zinc-900/40 transition-colors">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              className="h-9.5 pl-3 pr-10 border-0 bg-transparent text-sm w-full focus-visible:ring-0 focus-visible:ring-offset-0 text-white rounded-lg"
              suppressHydrationWarning
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="flex gap-2 items-start text-xs text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 mt-1">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-normal">
              <p className="font-semibold text-rose-300">Login Gagal</p>
              <p className="opacity-70">Email atau password salah.</p>
            </div>
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          formAction={login}
          disabled={isLoading}
          className="w-full h-10 mt-4 font-semibold text-xs text-black bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 flex items-center justify-center gap-1.5 transition-colors rounded-lg shadow-sm"
          suppressHydrationWarning
        >
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isLoading ? 'Masuk...' : 'Masuk'}
        </Button>
      </form>

      {/* Subtle brand footer */}
      <div className="mt-7 text-center text-[9px] text-zinc-700 font-mono tracking-widest uppercase">
        AIOT KITCHEN SYSTEM &bull; v1.0.0
      </div>
    </div>
  )
}
