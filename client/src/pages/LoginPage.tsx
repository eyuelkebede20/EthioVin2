import { useState } from "react";
import { authClient } from "../lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false); // False = Sign In, True = Sign Up

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegister) {
      console.log("Attempting to SIGN UP with:", { email, name });
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
      });

      console.log("SIGN UP Response Data:", data);
      console.log("SIGN UP Error:", error);

      if (error) {
        alert("Sign Up Error: " + error.message);
      } else {
        alert("Account Created Successfully! Redirecting...");
        window.location.href = "/";
      }
    } else {
      console.log("Attempting to SIGN IN with:", { email });
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      console.log("SIGN IN Response Data:", data);
      console.log("SIGN IN Error:", error);

      if (error) {
        alert("Sign In Error: " + error.message);
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-center mb-6">{isRegister ? "Create a New Account" : "Sign In to Dashboard"}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isRegister && <input type="text" placeholder="Full Name" required className="p-3 border border-slate-300 rounded-lg" value={name} onChange={(e) => setName(e.target.value)} />}
        <input type="email" placeholder="Email" required className="p-3 border border-slate-300 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required className="p-3 border border-slate-300 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />

        {/* Button changes color based on mode so you know exactly what you are clicking */}
        <button type="submit" className={`p-3 text-white rounded-lg font-bold ${isRegister ? "bg-green-600 hover:bg-green-700" : "bg-slate-800 hover:bg-slate-900"}`}>
          {isRegister ? "EXECUTE SIGN UP" : "EXECUTE SIGN IN"}
        </button>
      </form>

      <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-sm font-bold text-blue-600 hover:text-blue-800">
        {isRegister ? "Wait, I already have an account -> Switch to Sign In" : "I need a new account -> Switch to Sign Up"}
      </button>
    </div>
  );
}
