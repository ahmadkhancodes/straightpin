import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Two-factor code" };

export default function TwoFactorPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="heading-5 text-text">Enter your authentication code</h1>
        <p className="body-6 text-text-subtle">Open your authenticator app and type the 6 digit code for this account.</p>
      </div>
      <TwoFactorForm />
    </>
  );
}
