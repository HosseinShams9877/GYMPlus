import { CoachJoinScreen } from "@/features/connection/components/coach-join-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JoinCodePage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;
  return <CoachJoinScreen initialCode={decodeURIComponent(code)}/>;
}
