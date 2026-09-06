"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "./coach-join-screen.module.css";

const API_BASE = "https://api.gympluspro.ir/api/v1";

export function CoachJoinScreen({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const code = initialCode.trim();
  const [hasToken,setHasToken]=useState(false);
  const [pending,setPending]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>setHasToken(Boolean(localStorage.getItem("gymplus_access"))),[]);

  const connect=async()=>{
    const token=localStorage.getItem("gymplus_access");
    if(!token){router.push(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`);return}
    setPending(true);setError("");
    try{
      const response=await fetch(`${API_BASE}/athlete/join/`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({code})});
      if(response.status===401){localStorage.removeItem("gymplus_access");localStorage.removeItem("gymplus_refresh");router.push(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`);return}
      if(!response.ok){const payload=await response.json().catch(()=>null) as {detail?:string;code?:string[]}|null;throw new Error(payload?.detail||payload?.code?.[0]||"اتصال انجام نشد. کد را بررسی کنید یا با حساب شاگرد وارد شوید.")}
      setSuccess(true);
      window.setTimeout(()=>router.push("/dashboard"),1200);
    }catch(cause){setError(cause instanceof Error?cause.message:"ارتباط با وب‌سرویس انجام نشد.")}finally{setPending(false)}
  };

  return <main className={styles.page} dir="rtl"><section className={styles.card}>
    <header><span className={styles.logo}><Image src="/assets/images/mingcute_fitness.png" width={42} height={42} alt=""/><b>GymPlus+</b></span><small>اتصال به مربی</small></header>
    <div className={styles.icon}><Image src="/assets/images/coach-empty-dashboard.png" width={118} height={118} alt=""/></div>
    {code?<><h1>{success?"اتصال با موفقیت انجام شد":"دعوت‌نامه مربی"}</h1><p>{success?"حساب شما به مربی متصل شد و در حال انتقال به داشبورد هستید.":"برای اضافه‌شدن به فهرست شاگردان مربی، اتصال را تأیید کنید."}</p><div className={styles.code}><span>کد اتصال</span><strong dir="ltr">{code}</strong></div>{error?<p className={styles.error}>{error}</p>:null}{success?<div className={styles.success}>اتصال برقرار شد</div>:<button onClick={()=>void connect()} disabled={pending}>{pending?"در حال اتصال...":hasToken?"تأیید اتصال":"ورود و اتصال"}</button>}</>:<><h1>لینک اتصال ناقص است</h1><p>کد مربی در این آدرس وجود ندارد. لینک یا QR را دوباره از مربی دریافت کنید.</p><Link className={styles.back} href="/login">بازگشت به ورود</Link></>}
  </section></main>;
}
