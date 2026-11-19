import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    try {
      const [profile, walletResult] = await Promise.all([
        apiRequest("/auth/me"),
        apiRequest("/wallet"),
      ]);

      setUser(profile.user ?? profile);
      setWallet(walletResult.wallet ?? walletResult);
    } catch {
      localStorage.removeItem("payflow_token");
      setUser(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("payflow_token")) {
      loadSession();
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem("payflow_token", result.token);
    await loadSession();
  }

  async function register(name, email, password) {
    await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    await login(email, password);
  }

  function logout() {
    localStorage.removeItem("payflow_token");
    setUser(null);
    setWallet(null);
  }

  async function refreshWallet() {
    const result = await apiRequest("/wallet");
    setWallet(result.wallet ?? result);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        loading,
        login,
        register,
        logout,
        refreshWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}