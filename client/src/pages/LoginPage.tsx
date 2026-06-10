import { useState } from "react";
import { authClient } from "../lib/auth-client";
import Banner from "../components/ui/Banner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister && name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = isRegister
        ? await authClient.signUp.email({ email, password, name: name.trim() })
        : await authClient.signIn.email({ email, password });

      if (error) {
        setError(error.message || "Authentication failed.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-center mb-6">{isRegister ? "Create a New Account" : "Sign In to EthioVin"}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isRegister && (
          <input
            type="text"
            placeholder="Full Name"
            required
            autoComplete="name"
            className="p-3 border border-slate-300 rounded-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          className="p-3 border border-slate-300 rounded-lg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          required
          minLength={8}
          autoComplete={isRegister ? "new-password" : "current-password"}
          className="p-3 border border-slate-300 rounded-lg"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <Banner variant="error">{error}</Banner>}

        <button
          type="submit"
          disabled={submitting}
          className={`p-3 text-white rounded-lg font-bold shadow-lg transition disabled:opacity-60 ${
            isRegister ? "bg-green-600 hover:bg-green-700 shadow-green-500/30" : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/40"
          }`}
        >
          {submitting ? "Please wait…" : isRegister ? "Sign Up" : "Sign In"}
        </button>
      </form>

      <button
        onClick={() => {
          setIsRegister(!isRegister);
          setError("");
        }}
        className="w-full mt-6 text-sm font-bold text-orange-600 hover:text-orange-800"
      >
        {isRegister ? "Already have an account? Sign In" : "Need an account? Sign Up"}
      </button>
    </div>
  );
}
