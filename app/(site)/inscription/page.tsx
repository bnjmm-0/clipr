import AuthForm from "@/components/AuthForm";
import { register } from "@/app/actions";
export default function Page() { return <main className="wrap"><AuthForm action={register} mode="register" /></main>; }
