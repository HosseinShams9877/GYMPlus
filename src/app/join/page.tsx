import { CoachJoinScreen } from "@/features/connection/components/coach-join-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JoinPage({searchParams}:{searchParams:Promise<{code?:string|string[]}>}) {
  const query=await searchParams;
  const code=Array.isArray(query.code)?query.code[0]??"":query.code??"";
  return <CoachJoinScreen initialCode={code}/>;
}
