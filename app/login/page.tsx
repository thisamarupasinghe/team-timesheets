import { redirect } from "next/navigation";
import { getUser, demoMode } from "@/lib/auth";
import LoginCard from "./LoginCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login() {
  if (await getUser()) redirect("/"); // already signed in: straight to the timesheet
  return <LoginCard demo={demoMode} />;
}
