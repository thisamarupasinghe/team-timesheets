import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginCard from "./LoginCard";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await getUser()) redirect("/"); // already signed in: straight to the timesheet
  return <LoginCard />;
}
