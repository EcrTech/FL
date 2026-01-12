import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotification } from "@/hooks/useNotification";
import { ForgotPasswordDialog } from "@/components/Auth/ForgotPasswordDialog";
import { Eye, EyeOff } from "lucide-react";

console.log('[Login] Module loaded');

export default function Login() {
  console.log('[Login] Component rendering...');
  
  const navigate = useNavigate();
  const notify = useNotification();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    console.log('[Login] useEffect - setting up auth listener...');
    let mounted = true;

    // Listen for auth changes and redirect on successful login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("[Login] Auth state change:", event, session ? "Session exists" : "No session");
      if (event === 'SIGNED_IN' && session) {
        console.log("[Login] User signed in, redirecting to LOS dashboard");
        navigate("/los/dashboard", { replace: true });
      }
    });

    // Check if user is already logged in - do this after setting up listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log("[Login] Initial session check:", session ? "Session exists" : "No session");
      if (session) {
        console.log("[Login] Redirecting to LOS dashboard");
        navigate("/los/dashboard", { replace: true });
      }
    });

    return () => {
      console.log('[Login] Cleanup - unsubscribing');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Login] handleSubmit called');
    setLoading(true);

    try {
      console.log('[Login] Attempting sign in...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Login] Sign in error:', error);
        throw error;
      }

      console.log('[Login] Sign in successful');
      notify.success("Welcome back!", "You've successfully signed in");

      // Navigation will be handled by the auth state change listener
    } catch (error: any) {
      console.error('[Login] Sign in failed:', error);
      notify.error("Login failed", error);
      setLoading(false);
    }
  };

  console.log('[Login] About to render AuthLayout...');
  
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </form>

      <ForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </AuthLayout>
  );
}
