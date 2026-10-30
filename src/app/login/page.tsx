import LoginPage from "@/features/auth/components/LoginPage";

export default function Login() {
  return (
    <LoginPage
      googleWorkspaceLoginEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      )}
    />
  );
}
