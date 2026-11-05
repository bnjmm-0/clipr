import AuthForm from "@/components/AuthForm";
import { login } from "@/app/actions";
export default function Page() { return <main className="wrap"><AuthForm action={login} mode="login" /></main>; }
