import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/fitfuel-meal-hero.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | FitFuel Kitchen" },
      { name: "description", content: "Sign in to your FitFuel Kitchen account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [admin, setAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("Sign in is a visual preview. Account authentication is not connected yet.");
  }

  return (
    <main className="login-page min-h-screen bg-background p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] max-w-[1440px] overflow-hidden border border-border bg-card lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.04fr_.96fr]">
        <section className="login-photo relative isolate flex min-h-[370px] flex-col justify-between overflow-hidden bg-foreground p-6 text-primary-foreground sm:p-10 lg:min-h-[680px] lg:p-12 xl:p-16">
          <img
            src={heroImage}
            alt="Freshly prepared chicken, grains and vegetables ready for a nourishing meal"
            className="absolute inset-0 -z-20 size-full object-cover object-[62%_50%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-foreground/40 via-foreground/15 to-foreground/75" />
          <Link
            to="/"
            className="flex w-fit items-center gap-2.5"
            aria-label="Back to FitFuel home"
          >
            <span className="grid size-9 place-items-center rounded-sm bg-lime text-foreground">
              <Leaf size={19} />
            </span>
            <span className="font-display text-lg font-bold">
              fitfuel<span className="text-coral">.</span>
            </span>
          </Link>
          <div className="max-w-lg py-10">
            <p className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-[.2em] text-lime">
              <Sparkles size={14} /> Good food. Strong days.
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-[-.04em] sm:text-5xl xl:text-[64px]">
              Make room
              <br />
              for <span className="text-lime">feeling good.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Real ingredients, chef-made meals, and one less thing between you and your goals.
            </p>
          </div>
          <div className="flex items-center justify-between text-[14px] text-white/75">
            <span>Freshly prepared. Ready when you are.</span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="size-1.5 rounded-full bg-lime" />
              Your next great meal
            </span>
          </div>
        </section>
        <section className="flex min-h-[570px] flex-col bg-card px-6 py-7 sm:px-12 sm:py-10 lg:min-h-[680px] lg:px-12 xl:px-20">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-9 lg:py-4">
            <div className="mb-7">
              <div className="mb-4 grid size-10 place-items-center rounded-sm bg-secondary text-primary">
                <LockKeyhole size={18} />
              </div>
              <p className="mb-2 text-[14px] font-bold uppercase tracking-[.16em] text-coral">
                Welcome to FitFuel
              </p>
              <h2 className="font-display text-3xl font-bold tracking-[-.04em]">
                {admin ? "Admin sign in" : "Welcome back."}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {admin
                  ? "Administrator access requires a verified account session."
                  : "Sign in to keep your good-food routine going."}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold text-foreground">
                  Email address
                </span>
                <span className="flex h-11 items-center gap-2.5 border border-border bg-card px-3 transition-colors focus-within:border-foreground/50">
                  <Mail size={15} className="shrink-0 text-muted-foreground" />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/75"
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold text-foreground">
                  Password
                </span>
                <span className="flex h-11 items-center gap-2.5 border border-border bg-card px-3 transition-colors focus-within:border-foreground/50">
                  <LockKeyhole size={15} className="shrink-0 text-muted-foreground" />
                  <input
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    autoComplete={admin ? "current-password" : "current-password"}
                    placeholder="Enter your password"
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/75"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
              </label>
              {!admin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "Password reset will be available when account sign-in is connected.",
                      )
                    }
                    className="text-[14px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {message && (
                <p
                  role="status"
                  className="border-l-2 border-coral bg-secondary/50 px-3 py-2 text-[14px] leading-relaxed text-muted-foreground"
                >
                  {message}
                </p>
              )}
              <Button
                type="submit"
                className="h-11 w-full justify-center gap-2 rounded-sm bg-lime text-sm font-bold text-foreground hover:bg-lime/90"
              >
                {admin ? "Sign in" : "Sign in"}
                <ArrowRight size={15} />
              </Button>
            </form>
            <div className="my-6 flex items-center gap-3 text-[13px] uppercase tracking-[.12em] text-muted-foreground/75">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              aria-pressed={admin}
              onClick={() => {
                setAdmin((v) => !v);
                setMessage("");
              }}
              className={`flex min-h-11 items-center justify-between border px-3.5 py-2.5 text-left transition-colors ${admin ? "border-foreground bg-foreground text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary/40"}`}
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck size={15} />
                <span className="text-[14px] font-semibold">Login as Admin</span>
              </span>
              <span
                className={`relative h-[17px] w-[30px] rounded-full p-[2px] transition-colors ${admin ? "bg-lime" : "bg-border"}`}
              >
                <span
                  className={`block size-[13px] rounded-full transition-transform ${admin ? "translate-x-[13px] bg-foreground" : "translate-x-0 bg-white"}`}
                />
              </span>
            </button>
            <p className="mt-5 text-center text-[14px] text-muted-foreground">
              Don’t have an account?{" "}
              <Link
                to="/"
                className="font-bold text-foreground underline decoration-coral decoration-2 underline-offset-4 hover:text-coral"
              >
                Sign up
              </Link>
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4 text-[13px] text-muted-foreground">
            <span>© 2026 FitFuel Kitchen</span>
            <span>Good food for your next great thing.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
