import { demoMode } from "@/lib/auth";
import SignOutCard from "./SignOutCard";

export default function SignOutPage() {
  return <SignOutCard demo={demoMode} />;
}
